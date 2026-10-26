import { addTrits, flipTrits, mulTrits, mustFromInt, shiftBalanced, toInt, tryFromInt, type Trit, zeros } from "./trit";

export const TRYTE = 6;
export const STACK_TRITS = 18;
export const PAGE_SLOTS = 81;
export const RAM_PAGES = 9;
export const ROM_PAGES = 18;
export const DRUM_PAGES = 243;
export const RAM_SLOTS = RAM_PAGES * PAGE_SLOTS;
export const LEVEL1_PAGES = RAM_PAGES + ROM_PAGES;

const WINDOW_TRIT: Trit[] = [-1, 0, 1];

export type AsmError = { line: number; message: string };

type OpName =
  | "add"
  | "sub"
  | "mul"
  | "neg"
  | "store"
  | "print"
  | "dup"
  | "swap"
  | "drop"
  | "halt"
  | "map"
  | "loadp"
  | "storep"
  | "jsr"
  | "rmc"
  | "brt"
  | "dow"
  | "jmp"
  | "sadd"
  | "ssub"
  | "tdn"
  | "lmul"
  | "shf";

const OP_TRITS: Record<OpName, Trit[]> = {
  add: [1, 0, 0],
  sub: [1, 0, -1],
  mul: [1, 0, 1],
  neg: [1, -1, 0],
  store: [1, -1, -1],
  print: [1, -1, 1],
  dup: [1, 1, 0],
  swap: [1, 1, -1],
  drop: [1, 1, 1],
  halt: [-1, 0, 0],
  map: [-1, 0, -1],
  loadp: [-1, 0, 1],
  storep: [-1, 1, 0],
  jsr: [0, 1, 0],
  rmc: [-1, 1, 1],
  brt: [-1, 1, -1],
  dow: [0, -1, 1],
  jmp: [0, 0, 1],
  sadd: [-1, -1, 0],
  ssub: [-1, -1, 1],
  tdn: [0, 1, 1],
  lmul: [-1, -1, -1],
  shf: [0, -1, -1],
};

const OP_BY_KEY = new Map<string, OpName>(
  (Object.entries(OP_TRITS) as [OpName, Trit[]][]).map(([name, trits]) => [trits.join(","), name]),
);

const OP_TEXT: Record<string, OpName> = {
  "+": "add",
  ADD: "add",
  "-": "sub",
  "−": "sub",
  SUB: "sub",
  "*": "mul",
  "×": "mul",
  MUL: "mul",
  NEG: "neg",
  "!": "store",
  STORE: "store",
  ".": "print",
  DOT: "print",
  DUP: "dup",
  SWAP: "swap",
  DROP: "drop",
  HALT: "halt",
  MAP: "map",
  LOADP: "loadp",
  STOREP: "storep",
  JSR: "jsr",
  RMC: "rmc",
  BRT: "brt",
  DOW: "dow",
  JMP: "jmp",
  "S+T": "sadd",
  "S-T": "ssub",
  TDN: "tdn",
  "L*T": "lmul",
  SHF: "shf",
};

type Stmt =
  | { kind: "page"; page: number; line: number }
  | { kind: "win"; window: number; page: number; line: number }
  | { kind: "word"; label?: string; value: number; line: number; text: string }
  | { kind: "op"; op: OpName; at?: string; line: number; text: string }
  | { kind: "call"; op: OpName; targets: string[]; at?: string; line: number; text: string }
  | { kind: "mem"; mode: "value" | "addr"; window: number; label: string; at?: string; line: number; text: string }
  | { kind: "imm"; value: number; at?: string; line: number; text: string };

export type PostfixProgram = {
  mem: Trit[][];
  notes: string[];
  windows: [number, number, number];
  entry: number;
  labels: Record<string, number>;
  lines: string[];
  addrToLine: number[];
};

function stripComment(line: string): string {
  const mark = line.indexOf(";");
  return (mark >= 0 ? line.slice(0, mark) : line).trim();
}

function opTryte(op: OpName): Trit[] {
  return [0, 0, 0, ...OP_TRITS[op]];
}

function addressTryte(window: number, slot: number, mode: "value" | "addr"): Trit[] {
  return [mode === "value" ? 1 : -1, WINDOW_TRIT[window], ...mustFromInt(slot - 40, 4)];
}

export function stackTrits(value: number): Trit[] {
  return tryFromInt(value, STACK_TRITS) ?? zeros(STACK_TRITS);
}

function writeValue(mem: Trit[][], addr: number, value: number) {
  const wide = mustFromInt(value, STACK_TRITS);
  mem[addr] = wide.slice(0, TRYTE);
  mem[addr + 1] = wide.slice(TRYTE, TRYTE * 2);
  mem[addr + 2] = wide.slice(TRYTE * 2);
}

function parseStmts(source: string): { stmts: Stmt[]; errors: AsmError[]; lines: string[] } {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const stmts: Stmt[] = [];
  const errors: AsmError[] = [];
  let pendingLabel: string | undefined;
  let pendingLine = 0;

  const takeLabel = (inline?: string) => {
    const label = inline ?? pendingLabel;
    pendingLabel = undefined;
    return label;
  };

  lines.forEach((raw, index) => {
    const line = index + 1;
    const text = stripComment(raw);
    if (!text) return;
    const tokens = text.split(/\s+/);
    let cursor = 0;
    let inline: string | undefined;
    if (tokens[0].endsWith(":")) {
      inline = tokens[0].slice(0, -1).toUpperCase();
      cursor = 1;
    }
    if (cursor >= tokens.length) {
      if (!inline) return;
      if (pendingLabel) errors.push({ line: pendingLine, message: `标号 ${pendingLabel} 还没落地` });
      pendingLabel = inline;
      pendingLine = line;
      return;
    }

    const head = tokens[cursor].toUpperCase();
    if (head === "PAGE" || head === "ORG") {
      if (inline || pendingLabel) errors.push({ line, message: `${head} 不能带标号` });
      pendingLabel = undefined;
      const page = Number(tokens[cursor + 1]);
      if (!Number.isInteger(page) || page < 0 || page >= RAM_PAGES) {
        errors.push({ line, message: `ОЗУ 页要在 0 到 ${RAM_PAGES - 1}` });
      } else stmts.push({ kind: "page", page, line });
      return;
    }
    if (head === "WIN") {
      if (inline || pendingLabel) errors.push({ line, message: "WIN 不能带标号" });
      pendingLabel = undefined;
      const window = Number(tokens[cursor + 1]);
      const page = Number(tokens[cursor + 2]);
      if (![0, 1, 2].includes(window) || !Number.isInteger(page) || page < 0 || page >= LEVEL1_PAGES) {
        errors.push({ line, message: "WIN 写成 WIN 窗口 页。窗口是 0、1、2，页是 0 到 26" });
      } else stmts.push({ kind: "win", window, page, line });
      return;
    }
    if (head === "WORD" || head === ".T") {
      const label = takeLabel(inline);
      const token = tokens[cursor + 1];
      if (!token) {
        errors.push({ line, message: "WORD 缺一个数" });
        return;
      }
      const value = Number(token);
      if (!Number.isInteger(value) || !tryFromInt(value, STACK_TRITS)) {
        errors.push({ line, message: `${token} 放不进三个 трайт` });
        return;
      }
      stmts.push({ kind: "word", label, value, line, text });
      return;
    }

    if (inline) {
      if (pendingLabel) errors.push({ line: pendingLine, message: `标号 ${pendingLabel} 还没落地` });
      pendingLabel = inline;
      pendingLine = line;
    }
    let claimed = false;
    const codeAt = () => {
      if (claimed || !pendingLabel) return undefined;
      claimed = true;
      const name = pendingLabel;
      pendingLabel = undefined;
      return name;
    };

    for (let i = cursor; i < tokens.length; i += 1) {
      const token = tokens[i];
      const upper = token.toUpperCase();
      const pointed = /^([@&])([012])(?::([A-Z_][A-Z0-9_]*))?$/i.exec(token);
      if (pointed && !pointed[3]) {
        const label = tokens[i + 1]?.replace(/,$/, "");
        if (!label || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) {
          errors.push({ line, message: `${token} 后面要有标号` });
          continue;
        }
        stmts.push({
          kind: "mem",
          mode: pointed[1] === "@" ? "value" : "addr",
          window: Number(pointed[2]),
          label: label.toUpperCase(),
          at: codeAt(),
          line,
          text: `${token} ${label}`,
        });
        i += 1;
        continue;
      }
      if (pointed?.[3]) {
        stmts.push({
          kind: "mem",
          mode: pointed[1] === "@" ? "value" : "addr",
          window: Number(pointed[2]),
          label: pointed[3].toUpperCase(),
          at: codeAt(),
          line,
          text: token,
        });
        continue;
      }
      if (upper === "STOREP" || upper === "LOADP" || upper === "MAP") {
        const spec = tokens[i + 1];
        const pair = spec?.split(",");
        if (!pair || pair.length !== 2 || pair.some((part) => !/^[+-]?\d+$/.test(part))) {
          errors.push({ line, message: `${upper} 写成 ${upper} 前,后` });
          continue;
        }
        const [first, second] = pair.map(Number);
        if (upper === "MAP") {
          stmts.push({ kind: "imm", value: second, at: codeAt(), line, text: second.toString() });
          stmts.push({ kind: "imm", value: first, line, text: first.toString() });
        } else {
          stmts.push({ kind: "imm", value: first, at: codeAt(), line, text: first.toString() });
          stmts.push({ kind: "imm", value: second, line, text: second.toString() });
        }
        stmts.push({ kind: "op", op: OP_TEXT[upper], line, text: `${upper} ${spec}` });
        i += 1;
        continue;
      }
      if (upper === "JSR" || upper === "DOW" || upper === "BRT") {
        const spec = tokens[i + 1] ?? "";
        const targets = spec.split(",").map((part) => part.trim().toUpperCase()).filter(Boolean);
        const expect = upper === "BRT" ? 3 : 1;
        if (targets.length !== expect || targets.some((name) => !/^[A-Z_][A-Z0-9_]*$/.test(name))) {
          errors.push({ line, message: upper === "BRT" ? "BRT 要写三个标号" : `${upper} 要写一个标号` });
          continue;
        }
        stmts.push({ kind: "call", op: OP_TEXT[upper], targets, at: codeAt(), line, text: `${upper} ${spec}` });
        i += 1;
        continue;
      }
      if (upper in OP_TEXT) {
        stmts.push({ kind: "op", op: OP_TEXT[upper], at: codeAt(), line, text: token });
        continue;
      }
      if (/^[+-]?\d+$/.test(token) || token.startsWith("#")) {
        const rawValue = token.startsWith("#") ? token.slice(1) : token;
        const value = Number(rawValue);
        if (!Number.isInteger(value) || !tryFromInt(value, STACK_TRITS)) {
          errors.push({ line, message: `${token} 放不进三个 трайт` });
          continue;
        }
        stmts.push({ kind: "imm", value, at: codeAt(), line, text: token });
        continue;
      }
      errors.push({ line, message: `看不懂 ${token}` });
    }
  });

  if (pendingLabel) errors.push({ line: pendingLine, message: `标号 ${pendingLabel} 没有落地` });
  return { stmts, errors, lines };
}

export function assemblePostfix(
  source: string,
): { ok: true; program: PostfixProgram } | { ok: false; errors: AsmError[] } {
  const { stmts, errors, lines } = parseStmts(source);
  if (!source.trim()) errors.push({ line: 1, message: "程序是空的" });
  if (errors.length > 0) return { ok: false, errors };

  const labels = new Map<string, number>();
  const mem = Array.from({ length: RAM_SLOTS }, () => zeros(TRYTE));
  const notes = Array.from({ length: RAM_SLOTS }, () => "");
  const addrToLine = Array.from({ length: RAM_SLOTS }, () => -1);
  const windows: [number, number, number] = [0, 1, 2];
  const poolTop = Array.from({ length: RAM_PAGES }, () => PAGE_SLOTS);
  const callPatches: { addr: number; label: string; line: number }[] = [];
  let cursor = 0;
  let entry: number | null = null;

  const pageOf = (addr: number) => Math.floor(addr / PAGE_SLOTS);
  const remember = (name: string | undefined, line: number) => {
    if (!name) return;
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) errors.push({ line, message: `标号 ${name} 不合法` });
    else if (labels.has(name)) errors.push({ line, message: `标号 ${name} 重复了` });
    else labels.set(name, cursor);
  };

  const occupy = (addr: number, tryte: Trit[], note: string, line: number) => {
    const page = pageOf(addr);
    const slot = addr % PAGE_SLOTS;
    if (page < 0 || page >= RAM_PAGES) {
      errors.push({ line, message: "写到了 ОЗУ 外面" });
      return;
    }
    if (slot >= poolTop[page] || notes[addr]) {
      errors.push({ line, message: `第 ${page} 页第 ${slot} 槽叠在一起了` });
      return;
    }
    mem[addr] = tryte;
    notes[addr] = note;
    addrToLine[addr] = line;
  };

  const allocPool = (page: number, line: number): number | null => {
    if (poolTop[page] < 3) {
      errors.push({ line, message: `第 ${page} 页放不下三个 трайт 的常数` });
      return null;
    }
    poolTop[page] -= 3;
    return page * PAGE_SLOTS + poolTop[page];
  };

  for (const stmt of stmts) {
    if (stmt.kind === "page") {
      cursor = stmt.page * PAGE_SLOTS;
      continue;
    }
    if (stmt.kind === "win") {
      windows[stmt.window as 0 | 1 | 2] = stmt.page;
      continue;
    }
    if (stmt.kind === "word") {
      if (stmt.label) {
        if (!/^[A-Z_][A-Z0-9_]*$/.test(stmt.label)) errors.push({ line: stmt.line, message: `标号 ${stmt.label} 不合法` });
        else if (labels.has(stmt.label)) errors.push({ line: stmt.line, message: `标号 ${stmt.label} 重复了` });
        else labels.set(stmt.label, cursor);
      }
      if (cursor % PAGE_SLOTS > PAGE_SLOTS - 3) {
        errors.push({ line: stmt.line, message: "三个 трайт 跨过了页边界" });
        cursor += 3;
        continue;
      }
      writeValue(mem, cursor, stmt.value);
      notes[cursor] = `整数 ${stmt.value}`;
      notes[cursor + 1] = "续";
      notes[cursor + 2] = "续";
      addrToLine[cursor] = stmt.line;
      addrToLine[cursor + 1] = stmt.line;
      addrToLine[cursor + 2] = stmt.line;
      cursor += 3;
      continue;
    }
    if (stmt.kind === "imm") {
      const slot = allocPool(pageOf(cursor), stmt.line);
      if (slot === null) continue;
      writeValue(mem, slot, stmt.value);
      notes[slot] = `字面量 ${stmt.value}`;
      notes[slot + 1] = "续";
      notes[slot + 2] = "续";
      addrToLine[slot] = stmt.line;
      if (entry === null) entry = cursor;
      remember(stmt.at, stmt.line);
      occupy(cursor, addressTryte(0, slot % PAGE_SLOTS, "value"), `取字面量 ${stmt.value}`, stmt.line);
      cursor += 1;
      continue;
    }
    if (entry === null) entry = cursor;
    if (stmt.kind === "op" || stmt.kind === "call") {
      remember(stmt.at, stmt.line);
      occupy(cursor, opTryte(stmt.op), stmt.text, stmt.line);
      cursor += 1;
      if (stmt.kind === "call") {
        for (const label of stmt.targets) {
          callPatches.push({ addr: cursor, label, line: stmt.line });
          occupy(cursor, zeros(TRYTE), label, stmt.line);
          cursor += 1;
        }
      }
      continue;
    }
    if (stmt.kind === "mem") remember(stmt.at, stmt.line);
    occupy(cursor, zeros(TRYTE), stmt.text, stmt.line);
    cursor += 1;
  }

  for (const patch of callPatches) {
    const addr = labels.get(patch.label);
    if (addr === undefined) errors.push({ line: patch.line, message: `没有标号 ${patch.label}` });
    else {
      const page = Math.floor(addr / PAGE_SLOTS);
      const slot = addr % PAGE_SLOTS;
      mem[patch.addr] = [...mustFromInt(page - 4, 2), ...mustFromInt(slot - 40, 4)];
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const patches: { addr: number; stmt: Extract<Stmt, { kind: "mem" }> }[] = [];
  cursor = 0;
  for (const stmt of stmts) {
    if (stmt.kind === "page") cursor = stmt.page * PAGE_SLOTS;
    else if (stmt.kind === "word") cursor += 3;
    else if (stmt.kind === "win") continue;
    else if (stmt.kind === "mem") {
      patches.push({ addr: cursor, stmt });
      cursor += 1;
    } else if (stmt.kind === "call") cursor += 1 + stmt.targets.length;
    else cursor += 1;
  }

  for (const { addr, stmt } of patches) {
    const target = labels.get(stmt.label);
    if (target === undefined) {
      errors.push({ line: stmt.line, message: `没有标号 ${stmt.label}` });
      continue;
    }
    const slot = target % PAGE_SLOTS;
    mem[addr] = addressTryte(stmt.window, slot, stmt.mode);
    notes[addr] = stmt.text;
  }

  if (errors.length > 0) return { ok: false, errors };
  if (entry === null) return { ok: false, errors: [{ line: 1, message: "没有可以执行的音节" }] };

  return {
    ok: true,
    program: { mem, notes, windows, entry, labels: Object.fromEntries(labels), lines, addrToLine },
  };
}

export type PostfixState = {
  mem: Trit[][];
  image: Trit[][];
  notes: string[];
  windows: [number, number, number];
  drum: Trit[][];
  rom: Trit[][];
  lastDrum: number | null;
  stack: number[];
  regS: number;
  regR: number;
  returns: number[];
  pc: number;
  halted: boolean;
  error?: string;
  trace: string;
  log: string[];
  output: number[];
  steps: number;
  executed: number | null;
  lines: string[];
  labels: Record<string, number>;
  addrToLine: number[];
  entry: number;
};

function blankTrytes(count: number): Trit[][] {
  const blank = zeros(TRYTE);
  return Array.from({ length: count }, () => blank);
}

export function bootPostfix(program: PostfixProgram): PostfixState {
  return {
    mem: program.mem.map((tryte) => tryte.slice()),
    image: program.mem.map((tryte) => tryte.slice()),
    notes: program.notes.slice(),
    windows: [...program.windows],
    drum: blankTrytes(DRUM_PAGES * PAGE_SLOTS),
    rom: blankTrytes(ROM_PAGES * PAGE_SLOTS),
    lastDrum: null,
    stack: [],
    regS: 0,
    regR: 0,
    returns: [],
    pc: program.entry,
    halted: false,
    trace: `程序从 ОЗУ 第 ${Math.floor(program.entry / PAGE_SLOTS)} 页第 ${program.entry % PAGE_SLOTS} 槽开始。`,
    log: [],
    output: [],
    steps: 0,
    executed: null,
    lines: program.lines.slice(),
    labels: { ...program.labels },
    addrToLine: program.addrToLine.slice(),
    entry: program.entry,
  };
}

function fail(state: PostfixState, message: string, executed: number): PostfixState {
  return {
    ...state,
    halted: true,
    error: message,
    trace: message,
    log: [...state.log, message].slice(-12),
    executed,
    steps: state.steps + 1,
  };
}

function pop(stack: number[], what: string): number {
  const value = stack.pop();
  if (value === undefined) throw new Error(`栈是空的，没有${what}。`);
  return value;
}

function stackAdd(left: number, right: number, subtract: boolean): number {
  const added = addTrits(
    mustFromInt(left, STACK_TRITS),
    subtract ? flipTrits(mustFromInt(right, STACK_TRITS)) : mustFromInt(right, STACK_TRITS),
  );
  if (added.overflow) throw new Error("结果放不进十八位。");
  return toInt(added.sum);
}

function stackMul(left: number, right: number): number {
  const product = mulTrits(mustFromInt(left, STACK_TRITS), mustFromInt(right, STACK_TRITS), STACK_TRITS);
  if (product.overflow) throw new Error("乘积放不进十八位。");
  return toInt(product.product);
}

function stackShift(value: number, count: number): number {
  const shifted = shiftBalanced(mustFromInt(value, STACK_TRITS), count);
  if (shifted.overflow) throw new Error("左移把非零的三进制位推出了十八位。");
  return toInt(shifted.trits);
}

function decodeAddress(tryte: readonly Trit[]): { mode: "value" | "addr"; window: number; slot: number } | null {
  if (tryte[0] !== 1 && tryte[0] !== -1) return null;
  const window = WINDOW_TRIT.indexOf(tryte[1]);
  const slot = toInt(tryte.slice(2)) + 40;
  if (window < 0 || slot < 0 || slot >= PAGE_SLOTS) return null;
  return { mode: tryte[0] === 1 ? "value" : "addr", window, slot };
}

function unpackTarget(tryte: readonly Trit[]): number {
  const page = toInt(tryte.slice(0, 2)) + 4;
  const slot = toInt(tryte.slice(2)) + 40;
  return page * PAGE_SLOTS + slot;
}

function levelAddress(page: number, slot: number): number {
  return page * PAGE_SLOTS + slot;
}

function readLevel(mem: Trit[][], rom: Trit[][], page: number, slot: number): number {
  if (slot > PAGE_SLOTS - 3) throw new Error(`从第 ${slot} 槽取三个 трайт 会跨出这一页。`);
  const base = slot;
  const cells = page < RAM_PAGES ? mem.slice(levelAddress(page, base), levelAddress(page, base) + 3) : rom.slice(levelAddress(page - RAM_PAGES, base), levelAddress(page - RAM_PAGES, base) + 3);
  return toInt(cells.flat());
}

export function stepPostfix(state: PostfixState): PostfixState {
  if (state.halted || state.error) return state;
  const page = Math.floor(state.pc / PAGE_SLOTS);
  const slot = state.pc % PAGE_SLOTS;
  if (page < 0 || page >= RAM_PAGES) return fail(state, "程序计数器不在 ОЗУ 里。", state.pc);
  if (slot < 0 || slot >= PAGE_SLOTS) return fail(state, "这一页的音节走完了。", state.pc);

  const tryte = state.mem[state.pc];
  const mem = state.mem.map((cell) => cell.slice());
  const stack = state.stack.slice();
  const output = state.output.slice();
  const returns = state.returns.slice();
  let regS = state.regS;
  let regR = state.regR;
  const windows: [number, number, number] = [state.windows[0], page, state.windows[2]];
  let nextPc = state.pc + 1;
  const drum = state.drum;
  let lastDrum = state.lastDrum;
  let halted = false;
  let trace = "";

  try {
    if (tryte[0] === 0 && tryte[1] === 0) {
      const op = OP_BY_KEY.get(tryte.slice(3).join(","));
      if (!op || tryte[2] !== 0) return fail(state, `第 ${page} 页第 ${slot} 槽不是基本运算音节。`, state.pc);
      if (op === "jsr" || op === "dow" || op === "brt") {
        const width = op === "brt" ? 3 : 1;
        const targets = Array.from({ length: width }, (_, index) => unpackTarget(mem[state.pc + 1 + index] ?? zeros(TRYTE)));
        if (op === "brt") {
          const sign = pop(stack, "符号");
          const chosen = sign < 0 ? targets[0] : sign === 0 ? targets[1] : targets[2];
          returns.push(state.pc + 4);
          nextPc = chosen;
          trace = `BRT 按栈顶符号调用地址 ${chosen}。`;
        } else if (op === "dow") {
          const condition = stack[stack.length - 1];
          if (condition === undefined) throw new Error("栈是空的，DOW 没有条件。");
          if (condition !== 0) {
            returns.push(state.pc + 2);
            nextPc = targets[0];
            trace = `栈顶 ${condition} 不是零，调用地址 ${targets[0]}。`;
          } else {
            nextPc = state.pc + 2;
            trace = "栈顶是零，跳过 DOW。";
          }
        } else {
          returns.push(state.pc + 2);
          nextPc = targets[0];
          trace = `JSR 调用地址 ${targets[0]}。`;
        }
      } else if (op === "rmc") {
        const back = returns.pop();
        if (back === undefined) throw new Error("返回栈是空的。");
        nextPc = back;
        trace = `RMC 回到地址 ${back}。`;
      } else if (op === "jmp") {
        nextPc = pop(stack, "转移地址");
        trace = `JMP 转到地址 ${nextPc}。`;
      } else if (op === "sadd" || op === "ssub") {
        const value = pop(stack, "栈顶");
        regS = stackAdd(regS, value, op === "ssub");
        trace = `S ${op === "sadd" ? "+" : "−"} ${value} = ${regS}。`;
      } else if (op === "tdn") {
        if (stack.length === 0) throw new Error("栈是空的，没法取负。");
        stack[stack.length - 1] = stackAdd(0, stack[stack.length - 1], true);
        trace = `栈顶取负，现在是 ${stack[stack.length - 1]}。`;
      } else if (op === "lmul") {
        const value = pop(stack, "乘数");
        regR = regS;
        regS = stackMul(value, regR);
        trace = `${value} × R(${regR}) = ${regS}，留在寄存器 S。`;
      } else if (op === "shf") {
        const count = pop(stack, "移位数");
        if (stack.length === 0) throw new Error("栈是空的，没有可以移位的数。");
        const shifted = stackShift(stack[stack.length - 1], count);
        stack[stack.length - 1] = shifted;
        trace = `栈顶按 ${count} 位做平衡三进制移位，得到 ${shifted}。`;
      } else if (op === "halt") {
        halted = true;
        trace = "停机。结果留在栈顶。";
      } else if (op === "print") {
        if (stack.length === 0) throw new Error("栈是空的，没有可以印出的数。");
        output.push(stack[stack.length - 1]);
        trace = `印出栈顶 ${stack[stack.length - 1]}。`;
      } else if (op === "dup") {
        if (stack.length === 0) throw new Error("栈是空的，没法复制。");
        stack.push(stack[stack.length - 1]);
        trace = `复制栈顶 ${stack[stack.length - 1]}。`;
      } else if (op === "drop") {
        trace = `丢掉栈顶 ${pop(stack, "可丢掉的数")}。`;
      } else if (op === "swap") {
        const first = pop(stack, "可交换的数");
        const second = pop(stack, "可交换的数");
        stack.push(first, second);
        trace = `交换栈顶两格：${second} 和 ${first}。`;
      } else if (op === "neg") {
        const value = pop(stack, "可取负的数");
        const negated = stackAdd(0, value, true);
        stack.push(negated);
        trace = `取负：${value} 变成 ${negated}。`;
      } else if (op === "store") {
        const addr = pop(stack, "地址");
        const value = pop(stack, "要写入的数");
        if (!Number.isInteger(addr) || addr < 0 || addr > RAM_SLOTS - 3) {
          throw new Error(`地址 ${addr} 不能写入三个 трайт。ПЗУ 只能读。`);
        }
        writeValue(mem, addr, value);
        trace = `! 把 ${value} 写成三个 трайт，放进地址 ${addr}。`;
      } else if (op === "map") {
        const which = pop(stack, "窗口");
        const target = pop(stack, "页号");
        if (![0, 1, 2].includes(which) || target < 0 || target >= LEVEL1_PAGES) {
          throw new Error("MAP 需要窗口 0–2 和一级页 0–26。");
        }
        windows[which as 0 | 1 | 2] = target;
        trace = `приписка ${which} 改指第 ${target} 页。`;
      } else if (op === "loadp" || op === "storep") {
        const drumPage = pop(stack, "磁鼓页");
        const ramPage = pop(stack, "ОЗУ 页");
        if (ramPage < 0 || ramPage >= RAM_PAGES || drumPage < 0 || drumPage >= DRUM_PAGES) {
          throw new Error(`页交换要在 ОЗУ 0–${RAM_PAGES - 1} 和磁鼓 0–${DRUM_PAGES - 1}。`);
        }
        const ramAt = ramPage * PAGE_SLOTS;
        const drumAt = drumPage * PAGE_SLOTS;
        if (op === "loadp") {
          for (let i = 0; i < PAGE_SLOTS; i += 1) mem[ramAt + i] = drum[drumAt + i].slice();
          trace = `把磁鼓第 ${drumPage} 页读入 ОЗУ 第 ${ramPage} 页。`;
        } else {
          for (let i = 0; i < PAGE_SLOTS; i += 1) drum[drumAt + i] = mem[ramAt + i].slice();
          lastDrum = drumPage;
          trace = `把 ОЗУ 第 ${ramPage} 页写入磁鼓第 ${drumPage} 页。`;
        }
      } else {
        const right = pop(stack, "右操作数");
        const left = pop(stack, "左操作数");
        const value = op === "mul" ? stackMul(left, right) : stackAdd(left, right, op === "sub");
        stack.push(value);
        trace = `${left} ${op === "add" ? "+" : op === "sub" ? "−" : "×"} ${right} = ${value}，压回栈顶。`;
      }
    } else {
      const address = decodeAddress(tryte);
      if (!address) return fail(state, `第 ${page} 页第 ${slot} 槽不是地址音节。`, state.pc);
      const dataPage = windows[address.window];
      if (address.mode === "addr") {
        const located = levelAddress(dataPage, address.slot);
        stack.push(located);
        trace = `地址音节压入地址 ${located}（窗口 ${address.window} → 第 ${dataPage} 页第 ${address.slot} 槽）。`;
      } else {
        const value = readLevel(mem, state.rom, dataPage, address.slot);
        stack.push(value);
        trace = `地址音节从窗口 ${address.window}（第 ${dataPage} 页第 ${address.slot} 槽）取出 ${value}。`;
      }
    }
  } catch (error) {
    return fail(state, error instanceof Error ? error.message : "执行失败", state.pc);
  }

  return {
    ...state,
    mem,
    windows,
    drum,
    lastDrum,
    stack,
    regS,
    regR,
    returns,
    output,
    pc: halted ? state.pc : nextPc,
    halted,
    trace,
    log: [...state.log, trace].slice(-12),
    steps: state.steps + 1,
    executed: state.pc,
  };
}

export function runPostfix(state: PostfixState, limit = 5000): PostfixState {
  let current = state;
  let guard = 0;
  while (!current.halted && !current.error && guard < limit) {
    current = stepPostfix(current);
    guard += 1;
  }
  if (!current.halted && !current.error) {
    const message = `跑了 ${guard} 步还没停，多半是循环没有出口。`;
    return { ...current, halted: true, error: message, trace: message };
  }
  return current;
}

export const POSTFIX_EXAMPLES: { id: string; title: string; blurb: string; source: string }[] = [
  {
    id: "product",
    title: "(a+b)×(c+d)",
    blurb: "地址音节把页里的三个 трайт 压进栈，运算音节再从栈顶取。",
    source: `; 程序和常数都在第 0 页。@0 A 经 приписка 0 去取 A。
        @0 A
        @0 B
        +
        @0 C
        @0 D
        +
        *
        .
        HALT
A:      WORD 2
B:      WORD 3
C:      WORD 4
D:      WORD 5
`,
  },
  {
    id: "neg",
    title: "取负",
    blurb: "NEG 把栈顶十八位里的 + 和 − 对调。",
    source: `        @0 N
        NEG
        .
        HALT
N:      WORD 5
`,
  },
  {
    id: "store",
    title: "写回内存",
    blurb: "&0 SUM 压入的是槽地址。! 再把三个 трайт 写回去。",
    source: `        @0 A
        @0 B
        +
        &0 SUM
        !
        HALT
A:      WORD 8
B:      WORD -3
SUM:    WORD 0
`,
  },
  {
    id: "page",
    title: "整页交换",
    blurb: "STOREP 把当前 ОЗУ 页抄上磁鼓，LOADP 装进另一页，再改 приписка 去读。",
    source: `        STOREP 0,1
        LOADP 2,1
        MAP 0,2
        @0 A
        .
        HALT
A:      WORD 7
`,
  },
  {
    id: "call",
    title: "调用子程序",
    blurb: "JSR 记下返回地址，RMC 再跳回来。和、差仍在栈上。",
    source: `        JSR   BODY
        .
        HALT
BODY:   @0 A
        @0 B
        +
        RMC
A:      WORD 20
B:      WORD 22
`,
  },
];
