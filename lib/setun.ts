import { MachineFault } from "./fault";
import {
  addTrits,
  flipTrits,
  formatTrits,
  mulTrits,
  mustFromInt,
  parseBalanced,
  shiftTrits,
  signOf,
  toInt,
  tryFromInt,
  type Trit,
  zeros,
} from "./trit";

export const SETUN_WORDS = 162;
export const ZONE_WORDS = 54;
export const RAM_ZONES = 3;
export const DRUM_ZONES = 36;
export const DRUM_WORDS = DRUM_ZONES * ZONE_WORDS;
const WORD = 9;
const ADDR = 5;
const WIDE = 18;
const ZONE_SIGN: Trit[] = [1, 0, -1];

export type SetunOp =
  | "LDA"
  | "ADD"
  | "SUB"
  | "STA"
  | "BR"
  | "BM"
  | "BZ"
  | "BP"
  | "HLT"
  | "SHF"
  | "TMUL"
  | "LDR"
  | "LDF"
  | "STF"
  | "ADF"
  | "STC"
  | "RZONE"
  | "WZONE"
  | "MUL"
  | "NORM"
  | "MADD"
  | "ADDC"
  | "IN"
  | "OUT";

const OPS: Record<SetunOp, { code: string; title: string }> = {
  LDA: { code: "30", title: "送入 S" },
  ADD: { code: "33", title: "加到 S" },
  SUB: { code: "3!3", title: "从 S 减去" },
  STA: { code: "!23", title: "S 写入内存" },
  BR: { code: "00", title: "无条件转移" },
  BM: { code: "1!3", title: "w 为 − 则转移" },
  BZ: { code: "10", title: "w 为 0 则转移" },
  BP: { code: "13", title: "w 为 + 则转移" },
  HLT: { code: "2!3", title: "停机" },
  SHF: { code: "!20", title: "移位" },
  TMUL: { code: "20", title: "按位相乘" },
  LDR: { code: "23", title: "送入 R" },
  LDF: { code: "!10", title: "送入 F" },
  STF: { code: "0!3", title: "F 写入内存" },
  ADF: { code: "!1!3", title: "加到 F" },
  STC: { code: "03", title: "写下 C" },
  RZONE: { code: "40", title: "磁鼓区读入快存" },
  WZONE: { code: "43", title: "快存区写入磁鼓" },
  MUL: { code: "4!3", title: "算术乘法" },
  NORM: { code: "!40", title: "规格化" },
  MADD: { code: "!43", title: "加上乘积" },
  ADDC: { code: "!4!3", title: "地址加进 F" },
  IN: { code: "!30", title: "从纸带读入" },
  OUT: { code: "!33", title: "送到输出" },
};

const NEEDS_ADDRESS = new Set<SetunOp>([
  "LDA",
  "ADD",
  "SUB",
  "STA",
  "BR",
  "BM",
  "BZ",
  "BP",
  "SHF",
  "TMUL",
  "LDR",
  "LDF",
  "STF",
  "ADF",
  "STC",
  "RZONE",
  "WZONE",
  "MUL",
  "NORM",
  "MADD",
  "ADDC",
  "IN",
  "OUT",
]);

function digitToPair(digit: number): [Trit, Trit] {
  for (const hi of [-1, 0, 1] as const) {
    for (const lo of [-1, 0, 1] as const) {
      if (hi * 3 + lo === digit) return [hi, lo];
    }
  }
  throw new Error(`九进制数字 ${digit} 无法写成两位三进制`);
}

export function parseNovenary(code: string): Trit[] {
  const digits: number[] = [];
  let negative = false;
  for (const char of code) {
    if (char === "!") {
      negative = true;
      continue;
    }
    if (!/[0-4]/.test(char)) throw new Error(code);
    digits.push(negative ? -Number(char) : Number(char));
    negative = false;
  }
  if (negative || digits.length !== 2) throw new Error(code);
  return [...digitToPair(digits[0]), ...digitToPair(digits[1])];
}

function formatDigit(digit: number): string {
  return digit < 0 ? `!${-digit}` : String(digit);
}

export function opcodeNovenary(word: readonly Trit[]): string {
  const high = word[5] * 3 + word[6];
  const low = word[7] * 3 + word[8];
  return formatDigit(high) + formatDigit(low);
}

const OP_BY_KEY = new Map<string, SetunOp>();
for (const [name, spec] of Object.entries(OPS) as [SetunOp, { code: string }][]) {
  const four = parseNovenary(spec.code);
  OP_BY_KEY.set(formatTrits(four.slice(0, 3)), name);
}

export function matchOpcode(word: readonly Trit[]): SetunOp | null {
  return OP_BY_KEY.get(formatTrits(word.slice(5, 8))) ?? null;
}

function encode(addr: number, op: SetunOp, mod: Trit): Trit[] {
  const address = op === "RZONE" || op === "WZONE" ? zoneAddress(addr) : linearToAddress(addr);
  const four = parseNovenary(OPS[op].code);
  return [...address, four[0], four[1], four[2], mod];
}

export function zoneName(index: number): string {
  return index === 0 ? "Ф+1" : index === 1 ? "Ф0" : "Ф−1";
}

export function placeOf(addr: number): { zone: string; cell: number; half: string } {
  const zone = Math.floor(addr / ZONE_WORDS);
  const within = addr % ZONE_WORDS;
  return { zone: zoneName(zone), cell: Math.floor(within / 2), half: within % 2 === 0 ? "高" : "低" };
}

export function linearToAddress(addr: number): Trit[] {
  if (!Number.isInteger(addr) || addr < 0 || addr >= SETUN_WORDS) {
    throw new MachineFault(`短字地址 ${addr} 不在 0–${SETUN_WORDS - 1}`);
  }
  const zone = Math.floor(addr / ZONE_WORDS);
  const within = addr % ZONE_WORDS;
  const cell = mustFromInt(Math.floor(within / 2) - 13, 3);
  const half: Trit = within % 2 === 0 ? 0 : 1;
  return [ZONE_SIGN[zone], cell[0], cell[1], cell[2], half];
}

function zoneAddress(packed: number): Trit[] {
  const ram = Math.floor(packed / DRUM_ZONES);
  const drum = packed % DRUM_ZONES;
  return [ZONE_SIGN[ram], ...mustFromInt(drum, 4)];
}

export function unpackZone(field: readonly Trit[]): { ram: number; drum: number } | null {
  const ram = ZONE_SIGN.indexOf(field[0]);
  const drum = toInt(field.slice(1, 5));
  if (ram < 0 || drum < 0 || drum >= DRUM_ZONES) return null;
  return { ram, drum };
}

export function addressToLinear(field: readonly Trit[]): number | null {
  const zone = ZONE_SIGN.indexOf(field[0]);
  if (zone < 0) return null;
  const cell = toInt(field.slice(1, 4)) + 13;
  const half = field[4];
  if (cell < 0 || cell > 26 || (half !== 0 && half !== 1)) return null;
  return zone * ZONE_WORDS + cell * 2 + half;
}

function parseZoneOperand(text: string, line: number, errors: AsmError[]): number | null {
  const match = /^(\d+):([+-]?1|0)$/.exec(text.replace("−", "-"));
  if (!match) {
    errors.push({ line, message: "区交换写成 磁鼓区:快存区，例如 5:+1、12:0、0:-1" });
    return null;
  }
  const drum = Number(match[1]);
  const ram = ZONE_SIGN.indexOf(Number(match[2]) as Trit);
  if (drum >= DRUM_ZONES || ram < 0) {
    errors.push({ line, message: `磁鼓区要在 0–${DRUM_ZONES - 1}，快存区是 +1、0 或 −1` });
    return null;
  }
  return ram * DRUM_ZONES + drum;
}

export function widenHigh(word: readonly Trit[]): Trit[] {
  return [...word, ...zeros(WORD)];
}

export function highNine(wide: readonly Trit[]): Trit[] {
  return wide.slice(0, WORD);
}

export function readShort(word: readonly Trit[]): number {
  return toInt(word.slice(0, ADDR));
}

function writeShort(value: number): Trit[] | null {
  const high = tryFromInt(value, ADDR);
  if (!high) return null;
  return [...high, 0, 0, 0, 0];
}

export type AsmError = { line: number; message: string };

export type SetunProgram = {
  mem: Trit[][];
  drum: Trit[][];
  notes: string[];
  entry: number;
  labels: Record<string, number>;
  addrToLine: number[];
  lines: string[];
  input: number[];
};

type Item =
  | { kind: "org"; addr: number; line: number }
  | { kind: "tape"; value: number; line: number }
  | { kind: "word"; label?: string; trits: Trit[]; note: string; line: number }
  | {
      kind: "op";
      label?: string;
      op: SetunOp;
      operand?: string;
      mod: Trit;
      line: number;
    };

function stripComment(line: string): string {
  const mark = line.indexOf(";");
  return (mark >= 0 ? line.slice(0, mark) : line).trim();
}

function parseModifier(token: string | undefined, line: number, errors: AsmError[]): Trit | null {
  if (!token || token === "0") return 0;
  if (token === "+") return 1;
  if (token === "-" || token === "−") return -1;
  errors.push({ line, message: "变址标志只能是 +、− 或 0" });
  return null;
}

function parseItems(source: string): { items: Item[]; errors: AsmError[]; lines: string[] } {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const items: Item[] = [];
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
    if (!text || text.startsWith("*")) return;
    const tokens = text.split(/\s+/);
    let cursor = 0;
    let inline: string | undefined;
    if (tokens[0].endsWith(":")) {
      inline = tokens[0].slice(0, -1).toUpperCase();
      cursor = 1;
    }
    if (cursor >= tokens.length) {
      if (!inline) return;
      if (pendingLabel) errors.push({ line: pendingLine, message: `标号 ${pendingLabel} 还没落到指令上` });
      pendingLabel = inline;
      pendingLine = line;
      return;
    }

    const head = tokens[cursor].toUpperCase();
    const label = takeLabel(inline);
    if (head === "TAPE") {
      const value = Number(tokens[cursor + 1]);
      if (!Number.isInteger(value)) errors.push({ line, message: "TAPE 后面要有一个整数" });
      else items.push({ kind: "tape", value, line });
      return;
    }
    if (head === ".ORG" || head === "ORG") {
      if (label) errors.push({ line, message: "ORG 不能带标号" });
      const addr = Number(tokens[cursor + 1]);
      if (!Number.isInteger(addr) || addr < 0 || addr >= SETUN_WORDS) {
        errors.push({ line, message: `ORG 地址要在 0 到 ${SETUN_WORDS - 1} 之间` });
      } else {
        items.push({ kind: "org", addr, line });
      }
      return;
    }
    if (head === ".T" || head === ".SHORT" || head === "WORD" || head === "SHORT") {
      const token = tokens[cursor + 1];
      if (!token) {
        errors.push({ line, message: "这里缺一个数" });
        return;
      }
      const short = head === ".SHORT" || head === "SHORT";
      const parsed = parseBalanced(token, short ? ADDR : WORD);
      if (!parsed.ok) {
        errors.push({
          line,
          message:
            parsed.reason === "range"
              ? short
                ? "这个短字超出五位三进制（−121 到 121）"
                : "这个数超出九位三进制（−9841 到 9841）"
              : `看不懂这个数：${token}`,
        });
        return;
      }
      const trits = short ? [...parsed.trits, ...zeros(4)] : parsed.trits;
      const shown = toInt(short ? parsed.trits : trits);
      items.push({
        kind: "word",
        label,
        trits,
        note: short ? `短字 ${shown}` : `整数 ${shown}`,
        line,
      });
      return;
    }
    if (!(head in OPS)) {
      errors.push({ line, message: `不认识的操作 ${tokens[cursor]}` });
      return;
    }
    const op = head as SetunOp;
    const rest = tokens.slice(cursor + 1).join("");
    const parts = rest.split(",").map((part) => part.trim()).filter(Boolean);
    if (op === "HLT") {
      if (parts.length > 0) errors.push({ line, message: "教学机的停机指令不带地址" });
      items.push({ kind: "op", label, op, mod: 0, line });
      return;
    }
    if (parts.length === 0) {
      errors.push({ line, message: `${op} 需要一个地址` });
      return;
    }
    const mod = parseModifier(parts[1], line, errors);
    if (parts.length > 2) errors.push({ line, message: "操作数里逗号太多" });
    if (mod === null) return;
    items.push({ kind: "op", label, op, operand: parts[0].toUpperCase(), mod, line });
  });

  if (pendingLabel) errors.push({ line: pendingLine, message: `标号 ${pendingLabel} 没有落到指令或数据上` });
  return { items, errors, lines };
}

export function assembleSetun(source: string): { ok: true; program: SetunProgram } | { ok: false; errors: AsmError[] } {
  const { items, errors, lines } = parseItems(source);
  if (!source.trim()) errors.push({ line: 1, message: "程序是空的" });
  if (errors.length > 0) return { ok: false, errors };

  const labels = new Map<string, number>();
  const placed: { addr: number; item: Item }[] = [];
  let cursor = 0;
  for (const item of items) {
    if (item.kind === "org" || item.kind === "tape") {
      if (item.kind === "org") cursor = item.addr;
      continue;
    }
    if (cursor >= SETUN_WORDS) {
      errors.push({ line: item.line, message: `程序超出 ${SETUN_WORDS} 个短字` });
      break;
    }
    if (item.label) {
      if (!/^[A-Z_][A-Z0-9_]*$/.test(item.label)) {
        errors.push({ line: item.line, message: `标号 ${item.label} 不合法` });
      } else if (labels.has(item.label)) {
        errors.push({ line: item.line, message: `标号 ${item.label} 重复了` });
      } else {
        labels.set(item.label, cursor);
      }
    }
    placed.push({ addr: cursor, item });
    cursor += 1;
  }
  if (errors.length > 0) return { ok: false, errors };

  const mem = Array.from({ length: SETUN_WORDS }, () => zeros(WORD));
  const drum = Array.from({ length: DRUM_WORDS }, () => zeros(WORD));
  const notes = Array.from({ length: SETUN_WORDS }, () => "空");
  const addrToLine = Array.from({ length: SETUN_WORDS }, () => -1);
  let entry: number | null = null;

  for (const { addr, item } of placed) {
    addrToLine[addr] = item.line;
    if (item.kind === "word") {
      mem[addr] = item.trits;
      notes[addr] = item.note;
      continue;
    }
    if (item.kind !== "op") continue;
    if (entry === null) entry = addr;
    let address = 0;
    if (item.op === "RZONE" || item.op === "WZONE") {
      const packed = parseZoneOperand(item.operand ?? "", item.line, errors);
      if (packed === null) continue;
      address = packed;
    } else if (item.operand) {
      if (/^\d+$/.test(item.operand)) address = Number(item.operand);
      else if (labels.has(item.operand)) address = labels.get(item.operand)!;
      else {
        errors.push({ line: item.line, message: `没有标号 ${item.operand}` });
        continue;
      }
      if (address < 0 || address >= SETUN_WORDS) {
        errors.push({ line: item.line, message: `地址 ${address} 超出快存` });
        continue;
      }
    } else if (NEEDS_ADDRESS.has(item.op)) {
      errors.push({ line: item.line, message: `${item.op} 需要地址` });
      continue;
    }
    mem[addr] = encode(address, item.op, item.mod);
    const modText = item.mod === 0 ? "" : item.mod === 1 ? ",+" : ",−";
    notes[addr] = `${item.op} ${item.operand ?? ""}${modText}`.trim();
  }

  if (errors.length > 0) return { ok: false, errors };
  if (entry === null) return { ok: false, errors: [{ line: 1, message: "没有可以执行的指令" }] };

  return {
    ok: true,
    program: {
      mem,
      drum,
      notes,
      entry,
      labels: Object.fromEntries(labels),
      addrToLine,
      lines,
      input: items.filter((item) => item.kind === "tape").map((item) => item.value),
    },
  };
}

export type SetunState = {
  mem: Trit[][];
  drum: Trit[][];
  image: Trit[][];
  notes: string[];
  S: Trit[];
  R: Trit[];
  F: Trit[];
  C: number;
  w: Trit;
  halted: boolean;
  error?: string;
  trace: string;
  log: string[];
  steps: number;
  touched: number[];
  executedAddr: number | null;
  addrToLine: number[];
  lines: string[];
  labels: Record<string, number>;
  entry: number;
  input: number[];
  inputAt: number;
  output: number[];
};

function cloneMem(mem: Trit[][]): Trit[][] {
  return mem.map((word) => word.slice());
}

export function bootSetun(program: SetunProgram): SetunState {
  return {
    mem: cloneMem(program.mem),
    drum: program.drum,
    image: cloneMem(program.mem),
    notes: program.notes.slice(),
    S: zeros(WIDE),
    R: zeros(WIDE),
    F: zeros(ADDR),
    C: program.entry,
    w: 0,
    halted: false,
    trace: `程序已装入。指令计数器 C 指向地址 ${program.entry}。`,
    log: [],
    steps: 0,
    touched: [],
    executedAddr: null,
    addrToLine: program.addrToLine.slice(),
    lines: program.lines.slice(),
    labels: { ...program.labels },
    input: program.input.slice(),
    inputAt: 0,
    output: [],
    entry: program.entry,
  };
}

function fmtW(w: Trit): string {
  return w === 1 ? "+" : w === -1 ? "−" : "0";
}

function fail(state: SetunState, message: string, executedAddr: number): SetunState {
  return {
    ...state,
    halted: true,
    error: message,
    trace: message,
    log: [...state.log, message].slice(-12),
    executedAddr,
    touched: [],
    steps: state.steps + 1,
  };
}

function exchangeZone(state: SetunState, op: "RZONE" | "WZONE", field: readonly Trit[], C: number): SetunState {
  const zones = unpackZone(field);
  if (!zones) return fail(state, "区号不在快存三区或磁鼓 36 区里", C);
  const mem = cloneMem(state.mem);
  const drum = state.drum.slice();
  const ramAt = zones.ram * ZONE_WORDS;
  const drumAt = zones.drum * ZONE_WORDS;
  for (let i = 0; i < ZONE_WORDS; i += 1) {
    if (op === "RZONE") mem[ramAt + i] = drum[drumAt + i].slice();
    else drum[drumAt + i] = mem[ramAt + i].slice();
  }
  const trace =
    op === "RZONE"
      ? `把磁鼓第 ${zones.drum} 区的 54 个短字读入快存 ${zoneName(zones.ram)}。`
      : `把快存 ${zoneName(zones.ram)} 的 54 个短字写入磁鼓第 ${zones.drum} 区。`;
  return {
    ...state,
    mem,
    drum,
    C: C + 1,
    trace,
    log: [...state.log, trace].slice(-12),
    steps: state.steps + 1,
    touched: Array.from({ length: ZONE_WORDS }, (_, i) => ramAt + i),
    executedAddr: C,
  };
}

export function stepSetun(state: SetunState): SetunState {
  if (state.halted || state.error) return state;
  const { C } = state;
  if (C < 0 || C >= SETUN_WORDS) return fail(state, "指令计数器走出了内存", C);
  const word = state.mem[C];
  const op = matchOpcode(word);
  if (!op) {
    return fail(state, `地址 ${C} 的 ${formatTrits(word)} 不是 Сетунь 的操作码`, C);
  }
  const field = word.slice(0, ADDR);
  const mod = word[8];
  const index = toInt(state.F);
  if (op === "RZONE" || op === "WZONE") return exchangeZone(state, op, field, C);
  const addressField = addressToLinear(field);
  if (addressField === null) return fail(state, `地址字段 ${formatTrits(field)} 对不上 162 个短字`, C);
  let effective = addressField;
  if (mod === 1) effective += index;
  else if (mod === -1) effective -= index;
  const modNote =
    mod === 0
      ? ""
      : mod === 1
        ? `地址 ${addressField} 加变址 F（${index}）得到 ${effective}。`
        : `地址 ${addressField} 减变址 F（${index}）得到 ${effective}。`;

  const usesMemory = op !== "HLT";
  if (usesMemory && (effective < 0 || effective >= SETUN_WORDS)) {
    return fail(state, `${modNote}有效地址 ${effective} 超出 0–${SETUN_WORDS - 1}。`, C);
  }

  const mem = cloneMem(state.mem);
  let S = state.S.slice();
  let R = state.R.slice();
  let F = state.F.slice();
  let w = state.w;
  let halted = false;
  let nextC = C + 1;
  let trace = "";
  let inputAt = state.inputAt;
  const output = state.output.slice();
  const touched = usesMemory ? [effective] : [];

  const cell = () => mem[effective];

  try {
    switch (op) {
      case "LDA": {
        S = widenHigh(cell());
        w = signOf(S);
        trace = `把地址 ${effective} 的整数 ${toInt(cell())} 送入 S 的高九位。w 变成 ${fmtW(w)}。${modNote}`;
        break;
      }
      case "ADD":
      case "SUB": {
        const operand = widenHigh(op === "SUB" ? flipTrits(cell()) : cell());
        const added = addTrits(S, operand);
        if (added.overflow) {
          return fail(state, "寄存器 S 溢出。Сетунь 遇到这种情况会停机。", C);
        }
        S = added.sum;
        w = signOf(S);
        const verb = op === "ADD" ? "加上" : "减去";
        trace = `S ${verb}地址 ${effective} 的 ${toInt(cell())}。高九位现在是 ${toInt(highNine(S))}。w = ${fmtW(w)}。${modNote}`;
        break;
      }
      case "STA": {
        mem[effective] = highNine(S);
        w = signOf(S);
        trace = `把 S 的高九位 ${toInt(highNine(S))} 写入地址 ${effective}。${modNote}`;
        break;
      }
      case "LDR": {
        R = widenHigh(cell());
        w = signOf(R);
        trace = `把地址 ${effective} 送入乘数寄存器 R。w = ${fmtW(w)}。${modNote}`;
        break;
      }
      case "LDF": {
        const value = readShort(cell());
        F = mustFromInt(value, ADDR);
        w = signOf(F);
        trace = `变址 F 装入地址 ${effective} 的高五位短字 ${value}。w = ${fmtW(w)}。${modNote}`;
        break;
      }
      case "STF": {
        const written = writeShort(toInt(F));
        if (!written) return fail(state, "F 写不回内存", C);
        mem[effective] = written;
        w = signOf(F);
        trace = `把变址 F（${toInt(F)}）按短字写入地址 ${effective} 的高五位。${modNote}`;
        break;
      }
      case "ADF": {
        const addend = readShort(cell());
        const sum = toInt(F) + addend;
        const next = tryFromInt(sum, ADDR);
        if (!next) return fail(state, `变址 F 变成 ${sum}，超出五位三进制`, C);
        F = next;
        w = signOf(F);
        trace = `F 加上地址 ${effective} 的短字 ${addend}，得到 ${sum}。w = ${fmtW(w)}。${modNote}`;
        break;
      }
      case "STC": {
        const written = writeShort(C);
        if (!written) return fail(state, "指令地址写不进短字", C);
        mem[effective] = written;
        trace = `把正在执行的这条地址 C = ${C} 写入地址 ${effective}。返回时要自己加一。${modNote}`;
        break;
      }
      case "SHF": {
        const count = readShort(cell());
        if (Math.abs(count) > WIDE) {
          return fail(state, `移位 ${count} 位，超出寄存器长度`, C);
        }
        const before = toInt(highNine(S));
        const shifted = shiftTrits(S, count);
        if (shifted.overflow) {
          return fail(state, "左移把非零的三进制位推出了 S，机器停机。", C);
        }
        S = shifted.trits;
        w = signOf(S);
        const after = toInt(highNine(S));
        const direction = count > 0 ? "左移，相当于乘以 3 的幂" : count < 0 ? "右移，丢掉的低位就是舍入" : "移位 0 次";
        trace = `按地址 ${effective} 的短字 ${count} ${direction}。高九位从 ${before} 变成 ${after}。w = ${fmtW(w)}。`;
        break;
      }
      case "TMUL": {
        const operand = widenHigh(cell());
        S = S.map((trit, index) => (trit * operand[index]) as Trit);
        w = signOf(S);
        trace = `按位相乘，没有进位。w = ${fmtW(w)}。`;
        break;
      }
      case "MUL":
      case "MADD": {
        const factor = op === "MUL" ? S : R;
        const multiplied = mulTrits(factor, cell(), WIDE);
        if (multiplied.overflow) {
          return fail(state, "乘积放不进十八位寄存器。Сетунь 按部分积逐位累加，高位超出就停机。", C);
        }
        let next = multiplied.product;
        if (op === "MADD") {
          const added = addTrits(S, next);
          if (added.overflow) return fail(state, "加上乘积后 S 溢出。Сетунь 遇到这种情况会停机。", C);
          next = added.sum;
        }
        S = next;
        w = signOf(S);
        trace =
          op === "MUL"
            ? `算术乘法：S 的每一位去乘地址 ${effective} 的 ${toInt(cell())}，部分积相加后高九位是 ${toInt(highNine(S))}。w = ${fmtW(w)}。`
            : `R 与地址 ${effective} 的 ${toInt(cell())} 按位做部分积，再加进 S。高九位是 ${toInt(highNine(S))}。w = ${fmtW(w)}。`;
        break;
      }
      case "NORM": {
        let trits = S.slice();
        let count = 0;
        while (trits.some((trit) => trit !== 0) && trits[0] !== 0 && count > -WIDE) {
          trits = shiftTrits(trits, -1).trits;
          count -= 1;
        }
        while (trits.some((trit) => trit !== 0) && trits[0] === 0 && trits[1] === 0 && count < WIDE) {
          trits = shiftTrits(trits, 1).trits;
          count += 1;
        }
        mem[effective] = highNine(trits);
        const shift = tryFromInt(count, WORD);
        if (!shift) return fail(state, "规格化的移位数存不进 S", C);
        S = widenHigh(shift);
        w = signOf(S);
        trace = `规格化后的高九位写入地址 ${effective}，移位 ${count} 留在 S。w = ${fmtW(w)}。`;
        break;
      }
      case "ADDC": {
        const sum = readShort(cell()) + C;
        const next = tryFromInt(sum, ADDR);
        if (!next) return fail(state, `地址 ${sum} 超出五位变址`, C);
        F = next;
        w = signOf(F);
        trace = `地址 ${effective} 的短字加上指令地址 ${C}，得到 ${sum}，写入 F。w = ${fmtW(w)}。`;
        break;
      }
      case "IN": {
        if (inputAt >= state.input.length) return fail(state, "纸带已经读完", C);
        const value = state.input[inputAt];
        const word = tryFromInt(value, WORD);
        if (!word) return fail(state, `纸带上的 ${value} 超出九位三进制`, C);
        mem[effective] = word;
        inputAt += 1;
        trace = `从纸带读入 ${value}，写入地址 ${effective}。`;
        break;
      }
      case "OUT": {
        const value = toInt(cell());
        output.push(value);
        trace = `把地址 ${effective} 的 ${value} 送到输出。`;
        break;
      }
      case "BR":
      case "BP":
      case "BZ":
      case "BM": {
        const want = op === "BP" ? 1 : op === "BM" ? -1 : op === "BZ" ? 0 : null;
        const taken = want === null || w === want;
        if (taken) nextC = effective;
        const why =
          op === "BR"
            ? "无条件转移"
            : `w 现在是 ${fmtW(w)}，${taken ? "条件成立" : "条件不成立"}`;
        trace = `${why}。${taken ? `转到地址 ${effective}` : `顺序执行地址 ${C + 1}`}。${modNote}`;
        break;
      }
      case "HLT": {
        halted = true;
        nextC = C;
        trace = "停机。";
        break;
      }
      default:
        return fail(state, "未实现的操作", C);
    }
  } catch (error) {
    if (error instanceof MachineFault) return fail(state, error.message, C);
    throw error;
  }

  if (!halted && (nextC < 0 || nextC >= SETUN_WORDS)) {
    return fail(state, "下一条指令的地址走出了内存", C);
  }

  const logLine = trace;
  return {
    ...state,
    mem,
    S,
    R,
    F,
    w,
    drum: state.drum,
    C: nextC,
    inputAt,
    output,
    halted,
    trace,
    log: [...state.log, logLine].slice(-12),
    steps: state.steps + 1,
    touched,
    executedAddr: C,
  };
}

export function runSetun(state: SetunState, limit = 5000): SetunState {
  let current = state;
  let guard = 0;
  while (!current.halted && !current.error && guard < limit) {
    current = stepSetun(current);
    guard += 1;
  }
  if (!current.halted && !current.error) {
    return fail(current, `跑了 ${limit} 步还没停，多半是循环没有出口。`, current.C);
  }
  return current;
}

export const SETUN_EXAMPLES: { id: string; title: string; blurb: string; source: string }[] = [
  {
    id: "add",
    title: "两数相加",
    blurb: "单地址：先送入 S，再把第二个数加进去，最后写回内存。",
    source: `; Сетунь 是单地址机器。结果先留在寄存器 S，再单独写回。
        LDA   A
        ADD   B
        STA   SUM
        HLT
A:      .t    2
B:      .t    3
SUM:    .t    0
`,
  },
  {
    id: "neg",
    title: "取负",
    blurb: "没有符号位。减去一个数，等于把每一位的 + 和 − 对调。",
    source: `; 5 写成九位是 000000+−−。
; 它的相反数是 000000−++，也就是 −5。
        LDA   ZERO
        SUB   FIVE
        STA   NEG
        HLT
ZERO:   .t    0
FIVE:   .t    5
NEG:    .t    0
`,
  },
  {
    id: "shift",
    title: "右移即舍入",
    blurb: "丢掉末位就是舍入到最近。左移则是乘 3。写回内存只带走 S 的高九位。",
    source: `; 5 是 +−−（9−3−1）。右移一位变成 +−，也就是 2。
; 被挤出去的那位还留在 S 的低九位，所以乘 3 之前要重新装入。
        LDA   FIVE
        SHF   RIGHT
        STA   ROUNDED
        LDA   ROUNDED
        SHF   LEFT
        STA   TIMES3
        HLT
FIVE:   .t     5
RIGHT:  .short -1
LEFT:   .short 1
ROUNDED: .t    0
TIMES3: .t     0
`,
  },
  {
    id: "index",
    title: "变址求和",
    blurb: "最低那位三进制决定地址加 F 还是减 F。转移看的是上一步留下的 w。",
    source: `; F 从 2 减到 −1。每次用「地址 + F」取 BASE 里的一个数。
; ADF 会按结果的符号重写 w，紧接着的转移看的就是它。
        LDA   ZERO
        STA   SUM
        LDF   TWO
LOOP:   LDA   BASE,+
        ADD   SUM
        STA   SUM
        ADF   NEG1
        BP    LOOP
        BZ    LOOP
        HLT
ZERO:   .t     0
SUM:    .t     0
TWO:    .short 2
NEG1:   .short -1
BASE:   .t     4
        .t     7
        .t     1
`,
  },
  {
    id: "mul",
    title: "六乘七",
    blurb: "MUL 是算术乘法。乘积按高九位对齐，所以结果仍能用整数读出来。",
    source: `        LDA   A
        MUL   B
        STA   PROD
        OUT   PROD
        HLT
A:      .t    6
B:      .t    7
PROD:   .t    0
`,
  },
];
