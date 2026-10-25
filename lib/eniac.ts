import { MachineFault } from "./fault";

export const ACCUMULATORS = 20;
export const DECADES = 10;

export type Sign = 1 | -1;

/** digits[0] 是个位。十进制编码：每一位正好是 0–9 里的一个状态。 */
export type Accumulator = { digits: number[]; sign: Sign };

export type AsmError = { line: number; message: string };

export type Pulse =
  | { op: "SET"; acc: number; value: number; line: number; text: string }
  | { op: "ADD" | "SUB"; src: number; dst: number; line: number; text: string }
  | { op: "MUL"; icand: number; ier: number; low: number; high: number; line: number; text: string }
  | { op: "DIV"; num: number; den: number; quot: number; line: number; text: string }
  | { op: "SQRT"; src: number; dest: number; line: number; text: string }
  | { op: "FTSET"; table: number; index: number; value: number; line: number; text: string }
  | { op: "FT"; table: number; arg: number; dest: number; line: number; text: string }
  | { op: "CTSET"; index: number; value: number; line: number; text: string }
  | { op: "CT"; index: number; dest: number; line: number; text: string }
  | { op: "MPSET"; stepper: number; count: number; line: number; text: string }
  | { op: "MP"; stepper: number; target: number; line: number; text: string }
  | { op: "OUT"; acc: number; line: number; text: string }
  | { op: "HLT"; line: number; text: string };

export type EniacProgram = { pulses: Pulse[]; lines: string[] };

export function decadeLamps(digit: number): boolean[] {
  return Array.from({ length: 10 }, (_, state) => state === digit);
}

export function blankAcc(): Accumulator {
  return { digits: Array.from({ length: DECADES }, () => 0), sign: 1 };
}

export function accValue(acc: Accumulator): number {
  let value = 0;
  for (let i = acc.digits.length - 1; i >= 0; i -= 1) value = value * 10 + acc.digits[i];
  return value * acc.sign;
}

function fromValue(value: number): Accumulator {
  if (!Number.isInteger(value) || Math.abs(value) > 9_999_999_999) {
    throw new MachineFault("这个数放不进十位环形计数器");
  }
  const digits = Array.from({ length: DECADES }, () => 0);
  let rest = Math.abs(value);
  for (let i = 0; i < DECADES; i += 1) {
    digits[i] = rest % 10;
    rest = Math.floor(rest / 10);
  }
  return { digits, sign: value < 0 ? -1 : 1 };
}

function parseAcc(token: string, line: number): number {
  const acc = Number(token);
  if (!Number.isInteger(acc) || acc < 1 || acc > ACCUMULATORS) {
    throw new MachineFault(`第 ${line} 行：累加器是 1 到 ${ACCUMULATORS}。`);
  }
  return Number(token) - 1;
}

function strip(line: string): string {
  const mark = line.indexOf(";");
  return (mark >= 0 ? line.slice(0, mark) : line).trim();
}

function parseCount(token: string | undefined, line: number, min: number, max: number, name: string): number {
  if (!token || !/^\d+$/.test(token)) throw new MachineFault(`第 ${line} 行：${name} 要是 ${min} 到 ${max} 的整数`);
  const value = Number(token);
  if (value < min || value > max) throw new MachineFault(`第 ${line} 行：${name} 要是 ${min} 到 ${max} 的整数`);
  return value;
}

function parseSigned(token: string | undefined, line: number): number {
  if (!token || !/^[+-]?\d+$/.test(token)) throw new MachineFault(`第 ${line} 行：这里要有一个十进制数`);
  const value = Number(token);
  fromValue(value);
  return value;
}

export function assembleEniac(source: string): { ok: true; program: EniacProgram } | { ok: false; errors: AsmError[] } {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const pulses: Pulse[] = [];
  const errors: AsmError[] = [];
  const labels = new Map<string, number>();
  const pending: { index: number; stepper: number; name: string }[] = [];
  if (!source.trim()) errors.push({ line: 1, message: "接线表是空的" });

  lines.forEach((raw, index) => {
    const line = index + 1;
    const text = strip(raw);
    if (!text || text.startsWith("*")) return;
    const tokens = text.split(/[\s,]+/).filter(Boolean);
    if (tokens.length === 1 && tokens[0].endsWith(":")) {
      const name = tokens[0].slice(0, -1).toUpperCase();
      if (labels.has(name)) errors.push({ line, message: `标号 ${name} 重复了` });
      else labels.set(name, pulses.length);
      return;
    }
    const op = tokens[0]?.toUpperCase();
    try {
      if (op === "SET") {
        pulses.push({ op: "SET", acc: parseAcc(tokens[1] ?? "", line), value: parseSigned(tokens[2], line), line, text });
      } else if (op === "ADD" || op === "SUB") {
        pulses.push({ op, src: parseAcc(tokens[1] ?? "", line), dst: parseAcc(tokens[2] ?? "", line), line, text });
      } else if (op === "MUL") {
        pulses.push({
          op: "MUL",
          icand: parseAcc(tokens[1] ?? "", line),
          ier: parseAcc(tokens[2] ?? "", line),
          low: parseAcc(tokens[3] ?? "", line),
          high: parseAcc(tokens[4] ?? "", line),
          line,
          text,
        });
      } else if (op === "DIV") {
        pulses.push({
          op: "DIV",
          num: parseAcc(tokens[1] ?? "", line),
          den: parseAcc(tokens[2] ?? "", line),
          quot: parseAcc(tokens[3] ?? "", line),
          line,
          text,
        });
      } else if (op === "SQRT") {
        pulses.push({ op: "SQRT", src: parseAcc(tokens[1] ?? "", line), dest: parseAcc(tokens[2] ?? "", line), line, text });
      } else if (op === "FTSET") {
        pulses.push({
          op: "FTSET",
          table: parseCount(tokens[1], line, 1, 3, "函数表") - 1,
          index: parseCount(tokens[2], line, 0, 99, "自变量"),
          value: parseSigned(tokens[3], line),
          line,
          text,
        });
      } else if (op === "FT") {
        pulses.push({
          op: "FT",
          table: parseCount(tokens[1], line, 1, 3, "函数表") - 1,
          arg: parseAcc(tokens[2] ?? "", line),
          dest: parseAcc(tokens[3] ?? "", line),
          line,
          text,
        });
      } else if (op === "CTSET") {
        pulses.push({
          op: "CTSET",
          index: parseCount(tokens[1], line, 0, 99, "常数号"),
          value: parseSigned(tokens[2], line),
          line,
          text,
        });
      } else if (op === "CT") {
        pulses.push({ op: "CT", index: parseCount(tokens[1], line, 0, 99, "常数号"), dest: parseAcc(tokens[2] ?? "", line), line, text });
      } else if (op === "MPSET") {
        pulses.push({
          op: "MPSET",
          stepper: parseCount(tokens[1], line, 1, 10, "步进器") - 1,
          count: parseCount(tokens[2], line, 0, 999999, "次数"),
          line,
          text,
        });
      } else if (op === "MP") {
        const name = (tokens[2] ?? "").toUpperCase();
        if (!/^[A-Z][A-Z0-9]*$/.test(name)) throw new MachineFault("MP 要写步进器和标号");
        pending.push({ index: pulses.length, stepper: parseCount(tokens[1], line, 1, 10, "步进器") - 1, name });
        pulses.push({ op: "MP", stepper: 0, target: 0, line, text });
      } else if (op === "OUT") {
        pulses.push({ op: "OUT", acc: parseAcc(tokens[1] ?? "", line), line, text });
      } else if (op === "HLT") {
        pulses.push({ op: "HLT", line, text });
      } else {
        throw new MachineFault(`不认识的脉冲 ${tokens[0]}`);
      }
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : "这一行读不通" });
    }
  });

  for (const item of pending) {
    const target = labels.get(item.name);
    const pulse = pulses[item.index];
    if (target === undefined) errors.push({ line: pulse.line, message: `没有标号 ${item.name}` });
    else if (pulse.op === "MP") pulses[item.index] = { ...pulse, stepper: item.stepper, target };
  }

  if (errors.length > 0) return { ok: false, errors };
  if (pulses.length === 0) return { ok: false, errors: [{ line: 1, message: "没有程序脉冲" }] };
  return { ok: true, program: { pulses, lines } };
}

export type EniacState = {
  acc: Accumulator[];
  pc: number;
  halted: boolean;
  error?: string;
  trace: string;
  log: string[];
  printer: string[];
  tables: number[][];
  constants: number[];
  steppers: number[];
  steps: number;
  focus: number;
  pulses: Pulse[];
  lines: string[];
  executed: number | null;
};

export function bootEniac(program: EniacProgram): EniacState {
  return {
    acc: Array.from({ length: ACCUMULATORS }, () => blankAcc()),
    pc: 0,
    halted: false,
    trace: "接线表已装上。每个数字位是一圈十个灯，只能亮一个。",
    log: [],
    printer: [],
    tables: Array.from({ length: 3 }, () => Array.from({ length: 100 }, () => 0)),
    constants: Array.from({ length: 100 }, () => 0),
    steppers: Array.from({ length: 10 }, () => 0),
    steps: 0,
    focus: 0,
    pulses: program.pulses,
    lines: program.lines,
    executed: null,
  };
}

function fail(state: EniacState, message: string, executed: number): EniacState {
  return {
    ...state,
    halted: true,
    error: message,
    trace: message,
    log: [...state.log, message].slice(-8),
    executed,
    steps: state.steps + 1,
  };
}

function formatAcc(acc: Accumulator): string {
  const digits = acc.digits.slice().reverse().join("");
  return `${acc.sign < 0 ? "−" : "+"}${digits.replace(/^0+(?=\d)/, "")}`;
}

export function stepEniac(state: EniacState): EniacState {
  if (state.halted || state.error) return state;
  const pulse = state.pulses[state.pc];
  if (!pulse) return fail(state, "脉冲链走完了，还没有 HLT。", state.pc);
  const acc = state.acc.map((item) => ({ digits: item.digits.slice(), sign: item.sign }));
  const printer = state.printer.slice();
  const tables = state.tables.map((row) => row.slice());
  const constants = state.constants.slice();
  const steppers = state.steppers.slice();
  let halted = false;
  let focus = state.focus;
  let trace = "";
  let pc = state.pc + 1;

  try {
    if (pulse.op === "SET") {
      acc[pulse.acc] = fromValue(pulse.value);
      focus = pulse.acc;
      trace = `把常数 ${pulse.value} 拨进累加器 ${pulse.acc + 1}。个位的灯环停在 ${acc[pulse.acc].digits[0]}。`;
    } else if (pulse.op === "ADD" || pulse.op === "SUB") {
      const left = accValue(acc[pulse.dst]);
      const right = accValue(acc[pulse.src]);
      const value = pulse.op === "ADD" ? left + right : left - right;
      acc[pulse.dst] = fromValue(value);
      focus = pulse.dst;
      trace = `累加器 ${pulse.src + 1} 送出 ${formatAcc(state.acc[pulse.src])}，累加器 ${pulse.dst + 1} ${pulse.op === "ADD" ? "加上" : "减去"}它，得到 ${formatAcc(acc[pulse.dst])}。`;
    } else if (pulse.op === "MUL") {
      const product = BigInt(accValue(acc[pulse.icand])) * BigInt(accValue(acc[pulse.ier]));
      const negative = product < 0n;
      const mag = negative ? -product : product;
      const low = mag % 10_000_000_000n;
      const high = mag / 10_000_000_000n;
      const sign = negative ? -1 : 1;
      acc[pulse.low] = fromValue(Number(low) * sign);
      acc[pulse.high] = fromValue(Number(high) * sign);
      focus = pulse.low;
      trace = `乘法器：累加器 ${pulse.icand + 1} × 累加器 ${pulse.ier + 1}。低十位进累加器 ${pulse.low + 1}，高十位进累加器 ${pulse.high + 1}，积是 ${product.toString()}。`;
    } else if (pulse.op === "DIV") {
      const numerator = BigInt(accValue(acc[pulse.num]));
      const denominator = BigInt(accValue(acc[pulse.den]));
      if (denominator === 0n) throw new MachineFault("除法器的除数是 0");
      const quotient = numerator / denominator;
      const remainder = numerator % denominator;
      acc[pulse.quot] = fromValue(Number(quotient));
      acc[pulse.num] = fromValue(Number(remainder));
      focus = pulse.quot;
      trace = `除法器：${numerator.toString()} ÷ ${denominator.toString()}。商 ${quotient.toString()} 进累加器 ${pulse.quot + 1}，余数 ${remainder.toString()} 留在累加器 ${pulse.num + 1}。`;
    } else if (pulse.op === "SQRT") {
      const value = accValue(acc[pulse.src]);
      if (value < 0) throw new MachineFault("开方器不接受负数");
      const rad = BigInt(value);
      let rootN = rad;
      let next = (rootN + 1n) / 2n;
      while (next < rootN) {
        rootN = next;
        next = (rootN + rad / rootN) / 2n;
      }
      const root = Number(rootN);
      acc[pulse.dest] = fromValue(root);
      focus = pulse.dest;
      trace = `开方器：累加器 ${pulse.src + 1} 的 ${value} 开方，整数根 ${root} 进累加器 ${pulse.dest + 1}。`;
    } else if (pulse.op === "FTSET") {
      tables[pulse.table][pulse.index] = pulse.value;
      trace = `函数表 ${pulse.table + 1} 的自变量 ${pulse.index} 拨成 ${pulse.value}。`;
    } else if (pulse.op === "FT") {
      const argument = Math.abs(accValue(acc[pulse.arg])) % 100;
      const stored = tables[pulse.table][argument] ?? 0;
      const value = accValue(acc[pulse.arg]) < 0 ? -stored : stored;
      acc[pulse.dest] = fromValue(value);
      focus = pulse.dest;
      trace = `函数表 ${pulse.table + 1} 按自变量 ${argument} 送出 ${value}，进入累加器 ${pulse.dest + 1}。`;
    } else if (pulse.op === "CTSET") {
      constants[pulse.index] = pulse.value;
      trace = `常数发送器第 ${pulse.index} 号拨成 ${pulse.value}。`;
    } else if (pulse.op === "CT") {
      acc[pulse.dest] = fromValue(constants[pulse.index] ?? 0);
      focus = pulse.dest;
      trace = `常数发送器第 ${pulse.index} 号的 ${constants[pulse.index]} 送进累加器 ${pulse.dest + 1}。`;
    } else if (pulse.op === "MPSET") {
      steppers[pulse.stepper] = pulse.count;
      trace = `主编程器的步进器 ${pulse.stepper + 1} 拨到 ${pulse.count}。`;
    } else if (pulse.op === "MP") {
      if (steppers[pulse.stepper] > 0) steppers[pulse.stepper] -= 1;
      if (steppers[pulse.stepper] > 0) {
        pc = pulse.target;
        trace = `步进器 ${pulse.stepper + 1} 还剩 ${steppers[pulse.stepper]}，程序脉冲回到第 ${pulse.target + 1} 步。`;
      } else {
        trace = `步进器 ${pulse.stepper + 1} 走完了，程序脉冲继续往下。`;
      }
    } else if (pulse.op === "OUT") {
      printer.push(formatAcc(acc[pulse.acc]));
      focus = pulse.acc;
      trace = `把累加器 ${pulse.acc + 1} 的 ${formatAcc(acc[pulse.acc])} 送到打印机。`;
    } else {
      halted = true;
      pc = state.pc;
      trace = "停机。灯环保持最后的状态。";
    }
  } catch (error) {
    const message = error instanceof MachineFault ? error.message : "执行失败";
    return fail(state, message, state.pc);
  }

  return {
    ...state,
    acc,
    printer,
    tables,
    constants,
    steppers,
    pc: halted ? state.pc : pc,
    halted,
    focus,
    trace,
    log: [...state.log, trace].slice(-8),
    steps: state.steps + 1,
    executed: state.pc,
  };
}

export function runEniac(state: EniacState, limit = 5000): EniacState {
  let current = state;
  let guard = 0;
  while (!current.halted && !current.error && guard < limit) {
    current = stepEniac(current);
    guard += 1;
  }
  if (!current.halted && !current.error) {
    return fail(current, `走了 ${limit} 个脉冲还没停。`, current.pc);
  }
  return current;
}

export const ENIAC_EXAMPLES: { id: string; title: string; blurb: string; source: string }[] = [
  {
    id: "add",
    title: "27 加 15",
    blurb: "先把常数拨进两个累加器，再让 2 号把数送到 1 号去做加法。",
    source: `; 每一行是一个程序脉冲。真机上这是一根接线，不是存在内存里的指令。
SET  1, +27
SET  2, +15
ADD  2, 1
OUT  1
HLT
`,
  },
  {
    id: "sub",
    title: "30 减 45",
    blurb: "减法也走十位环形计数器。符号是单独一盏灯，不占数字位。",
    source: `SET  1, +30
SET  2, +45
SUB  2, 1
OUT  1
HLT
`,
  },
  {
    id: "mul",
    title: "27 乘 15",
    blurb: "乘法器把两个十位数的积拆进两台累加器，低十位和高十位各一台。",
    source: `SET  1, +27
SET  2, +15
MUL  1, 2, 3, 4
OUT  3
HLT
`,
  },
];
