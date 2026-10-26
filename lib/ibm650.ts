import { MachineFault } from "./fault";

export const DRUM_WORDS = 2000;
const WIDTH = 10;

export type Sign = 1 | -1;

/** digits[0] 是个位。 */
export type Word = { sign: Sign; digits: number[] };

export type AsmError = { line: number; message: string };

type OpName =
  | "NOP"
  | "STOP"
  | "AU"
  | "SU"
  | "DIV"
  | "ALO"
  | "SLO"
  | "AABL"
  | "SABL"
  | "MULT"
  | "STL"
  | "STU"
  | "STDA"
  | "STIA"
  | "STD"
  | "SRT"
  | "SRD"
  | "SLT"
  | "SCT"
  | "BRNZU"
  | "BRNZ"
  | "BMI"
  | "BROV"
  | "RAU"
  | "RSU"
  | "DIVRU"
  | "RAL"
  | "RSL"
  | "RAABL"
  | "RSABL"
  | "LDD"
  | "RD"
  | "PCH"
  | "TLU"
  | "BRD10"
  | "BRD9"
  | "BRD8"
  | "BRD7"
  | "BRD6"
  | "BRD5"
  | "BRD4"
  | "BRD3"
  | "BRD2"
  | "BRD1";

type OpKind = "data" | "branch" | "stop";

const OPS: Record<OpName, { code: number; title: string; kind: OpKind }> = {
  NOP: { code: 0, title: "空操作", kind: "data" },
  STOP: { code: 1, title: "停机", kind: "stop" },
  AU: { code: 10, title: "加到上半", kind: "data" },
  SU: { code: 11, title: "从上半减去", kind: "data" },
  DIV: { code: 14, title: "除，保留上半", kind: "data" },
  ALO: { code: 15, title: "加到下半", kind: "data" },
  SLO: { code: 16, title: "从下半减去", kind: "data" },
  AABL: { code: 17, title: "绝对值加到下半", kind: "data" },
  SABL: { code: 18, title: "绝对值从下半减去", kind: "data" },
  MULT: { code: 19, title: "上半乘以内存", kind: "data" },
  STL: { code: 20, title: "存下半", kind: "data" },
  STU: { code: 21, title: "存上半", kind: "data" },
  STDA: { code: 22, title: "把下半的数据地址写入分配器再存", kind: "data" },
  STIA: { code: 23, title: "把下半的指令地址写入分配器再存", kind: "data" },
  STD: { code: 24, title: "分配器写入", kind: "data" },
  SRT: { code: 30, title: "右移", kind: "data" },
  SRD: { code: 31, title: "右移并舍入", kind: "data" },
  SLT: { code: 35, title: "左移", kind: "data" },
  SCT: { code: 36, title: "左移并计数", kind: "data" },
  BRNZU: { code: 44, title: "上半非零则转移", kind: "branch" },
  BRNZ: { code: 45, title: "累加器非零则转移", kind: "branch" },
  BMI: { code: 46, title: "负则转到数据地址", kind: "branch" },
  BROV: { code: 47, title: "溢出则转移", kind: "branch" },
  RAU: { code: 60, title: "清零后加到上半", kind: "data" },
  RSU: { code: 61, title: "清零后从上半减去", kind: "data" },
  DIVRU: { code: 64, title: "清上半后除", kind: "data" },
  RAL: { code: 65, title: "清零后加到下半", kind: "data" },
  RSL: { code: 66, title: "清零后从下半减去", kind: "data" },
  RAABL: { code: 67, title: "清零后把绝对值加到下半", kind: "data" },
  RSABL: { code: 68, title: "清零后把绝对值从下半减去", kind: "data" },
  LDD: { code: 69, title: "装入分配器", kind: "data" },
  RD: { code: 70, title: "读一张卡片", kind: "data" },
  PCH: { code: 71, title: "穿一张卡片", kind: "data" },
  TLU: { code: 84, title: "查表", kind: "data" },
  BRD10: { code: 90, title: "分配器第 10 位是 8 或 9", kind: "branch" },
  BRD9: { code: 91, title: "分配器第 9 位是 8 或 9", kind: "branch" },
  BRD8: { code: 92, title: "分配器第 8 位是 8 或 9", kind: "branch" },
  BRD7: { code: 93, title: "分配器第 7 位是 8 或 9", kind: "branch" },
  BRD6: { code: 94, title: "分配器第 6 位是 8 或 9", kind: "branch" },
  BRD5: { code: 95, title: "分配器第 5 位是 8 或 9", kind: "branch" },
  BRD4: { code: 96, title: "分配器第 4 位是 8 或 9", kind: "branch" },
  BRD3: { code: 97, title: "分配器第 3 位是 8 或 9", kind: "branch" },
  BRD2: { code: 98, title: "分配器第 2 位是 8 或 9", kind: "branch" },
  BRD1: { code: 99, title: "分配器第 1 位是 8 或 9", kind: "branch" },
};

const ALIASES: Record<string, OpName> = { BRMIN: "BMI", AL: "ALO", SL: "SLO", LD: "LDD", NOOP: "NOP" };

export type IbmProgram = {
  mem: Word[];
  notes: string[];
  entry: number;
  labels: Record<string, number>;
  lines: string[];
  addrToLine: number[];
  cards: Word[][];
};

export function zeroWord(): Word {
  return { sign: 1, digits: Array.from({ length: WIDTH }, () => 0) };
}

export function biquinary(digit: number): { bi: 0 | 5; quin: number } {
  return { bi: digit >= 5 ? 5 : 0, quin: digit % 5 };
}

export function formatWord(word: Word): string {
  return `${word.sign < 0 ? "−" : "+"}${word.digits.slice().reverse().join("")}`;
}

export function wordValue(word: Word): number {
  let value = 0;
  for (let i = word.digits.length - 1; i >= 0; i -= 1) value = value * 10 + word.digits[i];
  return value * word.sign;
}

function pack(sign: Sign, groups: number[]): Word {
  const digits = Array.from({ length: WIDTH }, () => 0);
  let place = 0;
  for (const group of groups) {
    let rest = group;
    const width = place === 8 ? 2 : 4;
    for (let i = 0; i < width; i += 1) {
      digits[place + i] = rest % 10;
      rest = Math.floor(rest / 10);
    }
    place += width;
  }
  return { sign, digits };
}

export function decodeInstruction(word: Word): { op: number; data: number; next: number } {
  const op = word.digits[9] * 10 + word.digits[8];
  const data =
    word.digits[7] * 1000 + word.digits[6] * 100 + word.digits[5] * 10 + word.digits[4];
  const next = word.digits[3] * 1000 + word.digits[2] * 100 + word.digits[1] * 10 + word.digits[0];
  return { op, data, next };
}

function parseSigned(token: string, line: number): Word {
  if (!/^[+-]?\d+$/.test(token)) throw new MachineFault(`第 ${line} 行：${token} 不是十进制数`);
  const negative = token.startsWith("-");
  const digitsText = token.replace(/^[+-]/, "");
  if (digitsText.length > WIDTH) throw new MachineFault(`第 ${line} 行：超过十位`);
  const digits = Array.from({ length: WIDTH }, () => 0);
  for (let i = 0; i < digitsText.length; i += 1) {
    digits[i] = Number(digitsText[digitsText.length - 1 - i]);
  }
  return { sign: negative ? -1 : 1, digits };
}

function strip(line: string): string {
  const mark = line.indexOf(";");
  return (mark >= 0 ? line.slice(0, mark) : line).trim();
}

type Item =
  | { kind: "org"; addr: number; line: number }
  | { kind: "word"; label?: string; word: Word; line: number; note: string }
  | { kind: "card"; words: Word[]; line: number }
  | { kind: "op"; label?: string; op: OpName; data?: string; next?: string; line: number };

function canonicalOp(token: string): OpName | null {
  const head = ALIASES[token] ?? token;
  return head in OPS ? (head as OpName) : null;
}

export function assemble650(source: string): { ok: true; program: IbmProgram } | { ok: false; errors: AsmError[] } {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const items: Item[] = [];
  const cards: Word[][] = [];
  const errors: AsmError[] = [];
  if (!source.trim()) errors.push({ line: 1, message: "程序是空的" });

  lines.forEach((raw, index) => {
    const line = index + 1;
    const text = strip(raw);
    if (!text || text.startsWith("*")) return;
    const tokens = text.split(/\s+/);
    let cursor = 0;
    let label: string | undefined;
    if (tokens[0].endsWith(":")) {
      label = tokens[0].slice(0, -1).toUpperCase();
      cursor = 1;
    } else if (tokens.length >= 2) {
      const second = tokens[1].toUpperCase();
      if (canonicalOp(second) || second === "DEC" || second === "ORG" || second === "CARD") {
        label = tokens[0].toUpperCase();
        cursor = 1;
      }
    }
    if (cursor >= tokens.length) {
      errors.push({ line, message: "这一行只有标号" });
      return;
    }
    const head = tokens[cursor].toUpperCase();
    try {
      if (head === "ORG") {
        const addr = Number(tokens[cursor + 1]);
        if (!Number.isInteger(addr) || addr < 0 || addr >= DRUM_WORDS) throw new MachineFault("ORG 超出磁鼓");
        items.push({ kind: "org", addr, line });
        return;
      }
      if (head === "DEC") {
        const word = parseSigned(tokens[cursor + 1] ?? "", line);
        items.push({ kind: "word", label, word, line, note: `数据 ${formatWord(word)}` });
        return;
      }
      if (head === "CARD") {
        const words = tokens.slice(cursor + 1).map((token) => parseSigned(token, line));
        if (words.length < 1 || words.length > 8) throw new MachineFault("一张卡片要有 1 到 8 个十字");
        while (words.length < 8) words.push(zeroWord());
        items.push({ kind: "card", words, line });
        return;
      }
      const op = canonicalOp(head);
      if (!op) throw new MachineFault(`不认识的操作 ${tokens[cursor]}`);
      const rest = tokens.slice(cursor + 1).join("");
      const parts = rest.split(",").map((part) => part.trim()).filter(Boolean);
      if (op === "STOP" || (op === "NOP" && parts.length === 0)) {
        items.push({ kind: "op", label, op, line });
        return;
      }
      if (OPS[op].kind === "branch" && parts.length !== 2) {
        throw new MachineFault("转移要写两个地址：条件成立去第一个，不成立去第二个");
      }
      if (OPS[op].kind === "data" && op !== "NOP" && parts.length < 1) throw new MachineFault(`${op} 需要数据地址`);
      items.push({
        kind: "op",
        label,
        op,
        data: parts[0]?.toUpperCase(),
        next: parts[1]?.toUpperCase(),
        line,
      });
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : "汇编失败" });
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const labels = new Map<string, number>();
  const placed: { addr: number; item: Item }[] = [];
  let cursor = 0;
  for (const item of items) {
    if (item.kind === "org" || item.kind === "card") {
      if (item.kind === "card") cards.push(item.words);
      if (item.kind === "org") cursor = item.addr;
      continue;
    }
    if (cursor >= DRUM_WORDS) {
      errors.push({ line: item.line, message: `程序超出 ${DRUM_WORDS} 个字` });
      break;
    }
    if (item.label) {
      if (labels.has(item.label)) errors.push({ line: item.line, message: `标号 ${item.label} 重复了` });
      else labels.set(item.label, cursor);
    }
    placed.push({ addr: cursor, item });
    cursor += 1;
  }
  if (errors.length > 0) return { ok: false, errors };

  const resolve = (token: string | undefined, line: number, fallback: number): number | null => {
    if (!token) return fallback;
    if (/^\d+$/.test(token)) {
      const value = Number(token);
      if (value >= DRUM_WORDS) {
        errors.push({ line, message: `地址 ${token} 超出磁鼓` });
        return null;
      }
      return value;
    }
    const found = labels.get(token);
    if (found === undefined) {
      errors.push({ line, message: `没有标号 ${token}` });
      return null;
    }
    return found;
  };

  const mem = Array.from({ length: DRUM_WORDS }, () => zeroWord());
  const notes = Array.from({ length: DRUM_WORDS }, () => "空");
  const addrToLine = Array.from({ length: DRUM_WORDS }, () => -1);
  let entry: number | null = null;

  for (let index = 0; index < placed.length; index += 1) {
    const { addr, item } = placed[index];
    addrToLine[addr] = item.line;
    if (item.kind === "word") {
      mem[addr] = item.word;
      notes[addr] = item.note;
      continue;
    }
    if (item.kind !== "op") continue;
    if (entry === null) entry = addr;
    const following = placed[index + 1]?.addr ?? addr;
    const data = resolve(item.data, item.line, 0);
    const next = resolve(item.next, item.line, item.op === "STOP" ? addr : following);
    if (data === null || next === null) continue;
    mem[addr] = pack(1, [next, data, OPS[item.op].code]);
    const nextText = item.next ?? (item.op === "STOP" ? "" : "（顺序）");
    notes[addr] = `${item.op} ${item.data ?? ""} ${nextText}`.trim();
  }
  if (errors.length > 0) return { ok: false, errors };
  if (entry === null) return { ok: false, errors: [{ line: 1, message: "没有指令" }] };

  return {
    ok: true,
    program: { mem, notes, entry, labels: Object.fromEntries(labels), lines, addrToLine, cards },
  };
}

export type Acc = { mag: number[]; sign: Sign };

export type IbmState = {
  mem: Word[];
  notes: string[];
  image: Word[];
  acc: Acc;
  distributor: Word;
  cards: Word[][];
  cardAt: number;
  punch: Word[][];
  overflow: boolean;
  remainderSign: Sign | null;
  pc: number;
  halted: boolean;
  error?: string;
  trace: string;
  log: string[];
  steps: number;
  executed: number | null;
  entry: number;
  labels: Record<string, number>;
  lines: string[];
  addrToLine: number[];
};

function blankAcc(): Acc {
  return { mag: Array.from({ length: 20 }, () => 0), sign: 1 };
}

function cloneWord(word: Word): Word {
  return { sign: word.sign, digits: word.digits.slice() };
}

export function boot650(program: IbmProgram): IbmState {
  return {
    mem: program.mem.map(cloneWord),
    image: program.mem.map(cloneWord),
    notes: program.notes.slice(),
    acc: blankAcc(),
    distributor: zeroWord(),
    cards: program.cards.map((card) => card.map(cloneWord)),
    cardAt: 0,
    punch: [],
    overflow: false,
    remainderSign: null,
    pc: program.entry,
    halted: false,
    trace: "程序已放上磁鼓。每条指令的最后四位写着下一条在哪。",
    log: [],
    steps: 0,
    executed: null,
    entry: program.entry,
    labels: program.labels,
    lines: program.lines.slice(),
    addrToLine: program.addrToLine.slice(),
  };
}

function lowerDigits(acc: Acc): number[] {
  return acc.mag.slice(0, WIDTH);
}

export function lowerWord(acc: Acc): Word {
  return { sign: acc.sign, digits: lowerDigits(acc) };
}

export function accValue(acc: Acc): number {
  let value = 0;
  for (let i = acc.mag.length - 1; i >= 0; i -= 1) value = value * 10 + acc.mag[i];
  return value * acc.sign;
}

function isZero(mag: readonly number[]): boolean {
  return mag.every((digit) => digit === 0);
}

function fail(state: IbmState, message: string, executed: number): IbmState {
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

const OP_BY_CODE = new Map<number, OpName>(Object.entries(OPS).map(([name, spec]) => [spec.code, name as OpName]));

function cmpMag(left: readonly number[], right: readonly number[]): number {
  const width = Math.max(left.length, right.length);
  for (let i = width - 1; i >= 0; i -= 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function addMagDigits(left: readonly number[], right: readonly number[], width: number): { mag: number[]; carry: boolean } {
  const mag = Array.from({ length: width }, () => 0);
  let carry = 0;
  for (let i = 0; i < width; i += 1) {
    const sum = (left[i] ?? 0) + (right[i] ?? 0) + carry;
    mag[i] = sum % 10;
    carry = Math.floor(sum / 10);
  }
  return { mag, carry: carry !== 0 };
}

function subMagDigits(big: readonly number[], small: readonly number[], width: number): number[] {
  const mag = Array.from({ length: width }, () => 0);
  let borrow = 0;
  for (let i = 0; i < width; i += 1) {
    let diff = (big[i] ?? 0) - (small[i] ?? 0) - borrow;
    if (diff < 0) {
      diff += 10;
      borrow = 1;
    } else borrow = 0;
    mag[i] = diff;
  }
  return mag;
}

function placeWord(word: Word, shift: number): number[] {
  const mag = Array.from({ length: 20 }, () => 0);
  for (let i = 0; i < WIDTH; i += 1) mag[i + shift] = word.digits[i];
  return mag;
}

function loadSigned(mag: number[], sign: Sign): { acc: Acc; overflow: boolean } {
  return { acc: { mag, sign: isZero(mag) ? 1 : sign }, overflow: false };
}

function addSigned(acc: Acc, mag: number[], sign: Sign): { acc: Acc; overflow: boolean } {
  const accSign: Sign = isZero(acc.mag) ? 1 : acc.sign;
  const addSign: Sign = isZero(mag) ? 1 : sign;
  if (accSign === addSign) {
    const added = addMagDigits(acc.mag, mag, 20);
    return { acc: { mag: added.mag, sign: isZero(added.mag) ? 1 : accSign }, overflow: added.carry };
  }
  const order = cmpMag(acc.mag, mag);
  if (order === 0) return { acc: blankAcc(), overflow: false };
  if (order > 0) return { acc: { mag: subMagDigits(acc.mag, mag, 20), sign: accSign }, overflow: false };
  return { acc: { mag: subMagDigits(mag, acc.mag, 20), sign: addSign }, overflow: false };
}

function opposite(sign: Sign, mag: readonly number[]): Sign {
  if (isZero(mag)) return 1;
  return sign === 1 ? -1 : 1;
}

function mulDigits(left: readonly number[], right: readonly number[]): number[] {
  const prod = Array.from({ length: 20 }, () => 0);
  for (let i = 0; i < right.length; i += 1) {
    let carry = 0;
    for (let j = 0; j < left.length; j += 1) {
      const sum = prod[i + j] + left[j] * right[i] + carry;
      prod[i + j] = sum % 10;
      carry = Math.floor(sum / 10);
    }
    let at = i + left.length;
    while (carry > 0) {
      const sum = prod[at] + carry;
      prod[at] = sum % 10;
      carry = Math.floor(sum / 10);
      at += 1;
    }
  }
  return prod;
}

/** 从高位起逐位试商。前十位商不是零就是溢出，低十位商和余数留下。 */
function divMag20by10(dividend: readonly number[], divisor: readonly number[]): { quot: number[]; rem: number[]; overflow: boolean } {
  let rem = Array.from({ length: WIDTH }, () => 0);
  const quot = Array.from({ length: 20 }, () => 0);
  for (let step = 0; step < 20; step += 1) {
    const shifted = Array.from({ length: WIDTH + 1 }, () => 0);
    shifted[0] = dividend[19 - step];
    for (let i = 0; i < WIDTH; i += 1) shifted[i + 1] = rem[i];
    let count = 0;
    let cur = shifted;
    while (count < 10 && cmpMag(cur, divisor) >= 0) {
      cur = subMagDigits(cur, divisor, cur.length);
      count += 1;
    }
    rem = Array.from({ length: WIDTH }, (_, i) => cur[i] ?? 0);
    quot[19 - step] = count;
  }
  return { quot: quot.slice(0, WIDTH), rem, overflow: quot.slice(WIDTH).some((digit) => digit !== 0) };
}

function compareWords(left: Word, right: Word): number {
  const leftZero = isZero(left.digits);
  const rightZero = isZero(right.digits);
  if (leftZero && rightZero) return 0;
  if (!leftZero && !rightZero && left.sign !== right.sign) return left.sign > right.sign ? 1 : -1;
  if (leftZero) return right.sign < 0 ? 1 : -1;
  if (rightZero) return left.sign < 0 ? -1 : 1;
  const mag = cmpMag(left.digits, right.digits);
  return left.sign < 0 ? -mag : mag;
}

export function accText(acc: Acc): string {
  const digits = acc.mag.slice().reverse().join("").replace(/^0+(?=\d)/, "");
  return `${acc.sign < 0 ? "-" : ""}${digits}`;
}

function shiftCount(data: number): number {
  const digit = data % 10;
  return digit === 0 ? 10 : digit;
}

function upperWord(acc: Acc, sign: Sign): Word {
  return { sign, digits: acc.mag.slice(10, 20) };
}

export function step650(state: IbmState): IbmState {
  if (state.halted || state.error) return state;
  if (state.pc < 0 || state.pc >= DRUM_WORDS) return fail(state, "下一条指令的地址不在磁鼓上", state.pc);
  const word = state.mem[state.pc];
  const decoded = decodeInstruction(word);
  const op = OP_BY_CODE.get(decoded.op);
  if (!op) return fail(state, `地址 ${state.pc} 的操作码 ${decoded.op} 不是 650 的操作码`, state.pc);
  if (op !== "STOP" && (decoded.data < 0 || decoded.data >= DRUM_WORDS)) {
    return fail(state, `数据地址 ${decoded.data} 超出磁鼓`, state.pc);
  }

  const mem = state.mem.map(cloneWord);
  let acc = { mag: state.acc.mag.slice(), sign: state.acc.sign };
  let distributor = cloneWord(state.distributor);
  let pc = decoded.next;
  let halted = false;
  let trace = "";
  let overflow = state.overflow;
  let remainderSign = state.remainderSign;
  let cardAt = state.cardAt;
  const punch = state.punch.map((card) => card.map(cloneWord));

  const commit = (placed: { acc: Acc; overflow: boolean }) => {
    acc = placed.acc;
    if (placed.overflow) overflow = true;
    remainderSign = null;
  };

  try {
    if (op === "STOP") {
      halted = true;
      pc = state.pc;
      trace = "停机。";
    } else if (op === "NOP") {
      trace = `空操作。下一条在 ${pc}。`;
    } else if (op === "LDD") {
      distributor = cloneWord(mem[decoded.data]);
      trace = `只把 ${formatWord(distributor)} 装进分配器，累加器不动。下一条在 ${pc}。`;
    } else if (op === "STD") {
      mem[decoded.data] = cloneWord(distributor);
      trace = `分配器里的 ${formatWord(distributor)} 写入地址 ${decoded.data}。下一条在 ${pc}。`;
    } else if (op === "STL" || op === "STU") {
      const sign = op === "STU" && remainderSign ? remainderSign : acc.sign;
      const stored = op === "STL" ? { sign: acc.sign, digits: lowerDigits(acc) } : upperWord(acc, sign);
      mem[decoded.data] = stored;
      distributor = cloneWord(stored);
      trace = `${op === "STL" ? "下半" : "上半"} ${formatWord(stored)} 写入地址 ${decoded.data}。下一条在 ${pc}。`;
    } else if (op === "STDA" || op === "STIA") {
      const source = op === "STDA" ? acc.mag.slice(4, 8) : acc.mag.slice(0, 4);
      const next = distributor.digits.slice();
      for (let i = 0; i < 4; i += 1) next[op === "STDA" ? 4 + i : i] = source[i];
      distributor = { sign: distributor.sign, digits: next };
      mem[decoded.data] = cloneWord(distributor);
      trace = `把下半里的${op === "STDA" ? "数据地址" : "指令地址"}嵌进分配器，再写入 ${decoded.data}。下一条在 ${pc}。`;
    } else if (op === "SRT" || op === "SRD" || op === "SLT" || op === "SCT") {
      const count = shiftCount(decoded.data);
      if (op === "SCT") {
        let zeros = 0;
        for (let i = 19; i >= 10 && acc.mag[i] === 0 && zeros < count; i -= 1) zeros += 1;
        const shifted = Array.from({ length: 20 }, () => 0);
        for (let i = zeros; i < 20; i += 1) shifted[i] = acc.mag[i - zeros];
        acc = { mag: shifted, sign: acc.sign };
        distributor = parseSigned(`+${zeros}`, state.pc);
        trace = `上半有 ${zeros} 个高位零，左移这么多位。下一条在 ${pc}。`;
      } else if (op === "SLT") {
        const shifted = Array.from({ length: 20 }, () => 0);
        for (let i = 20 - count; i < 20; i += 1) if (acc.mag[i] !== 0) overflow = true;
        for (let i = count; i < 20; i += 1) shifted[i] = acc.mag[i - count];
        acc = { mag: shifted, sign: isZero(shifted) ? 1 : acc.sign };
        trace = `累加器左移 ${count} 位。${overflow ? "高位推出了非零数字，溢出灯亮。" : ""}下一条在 ${pc}。`;
      } else {
        const roundDigit = count > 0 ? acc.mag[count - 1] : 0;
        const shifted = Array.from({ length: 20 }, () => 0);
        for (let i = 0; i + count < 20; i += 1) shifted[i] = acc.mag[i + count];
        acc = { mag: shifted, sign: acc.sign };
        if (op === "SRD" && roundDigit >= 5) {
          const bumped = addMagDigits(acc.mag, [1], 20);
          if (bumped.carry) {
            acc = blankAcc();
            overflow = true;
          } else {
            acc = { mag: bumped.mag, sign: isZero(bumped.mag) ? 1 : acc.sign };
          }
        }
        trace = `累加器右移 ${count} 位${op === "SRD" ? "，舍入位不小于 5 时个位再加一" : ""}。下一条在 ${pc}。`;
      }
      remainderSign = null;
    } else if (op === "RD" || op === "PCH") {
      if (op === "RD") {
        const card = state.cards[cardAt];
        if (!card) throw new MachineFault("读卡机里没有下一张卡片");
        for (let i = 0; i < 8; i += 1) mem[decoded.data + i] = cloneWord(card[i] ?? zeroWord());
        cardAt += 1;
        trace = `读进一张卡片，八个字从地址 ${decoded.data} 排开。下一条在 ${pc}。`;
      } else {
        punch.push(Array.from({ length: 8 }, (_, i) => cloneWord(mem[decoded.data + i] ?? zeroWord())));
        trace = `从地址 ${decoded.data} 起穿出一张八个字的卡片。下一条在 ${pc}。`;
      }
    } else if (op === "TLU") {
      const band = Math.floor(decoded.data / 50) * 50;
      const limit = Math.min(decoded.data + 48, band + 50, DRUM_WORDS);
      const argument = distributor;
      let found = -1;
      for (let addr = decoded.data; addr < limit; addr += 1) {
        if (compareWords(mem[addr], argument) >= 0) {
          found = addr;
          break;
        }
      }
      if (found < 0) {
        overflow = true;
        trace = `分配器里的 ${wordValue(argument)} 比这条带上的表项都大，溢出灯亮。下一条在 ${pc}。`;
      } else {
        const mag = Array.from({ length: 20 }, () => 0);
        let rest = found;
        for (let i = 0; i < 4; i += 1) {
          mag[i] = rest % 10;
          rest = Math.floor(rest / 10);
        }
        acc = loadSigned(mag, 1).acc;
        remainderSign = null;
        trace = `查到地址 ${found} 的 ${formatWord(mem[found])}。地址留在下半。下一条在 ${pc}。`;
      }
    } else if (OPS[op].kind === "branch") {
      const upperZero = isZero(acc.mag.slice(10));
      // 90 看最高位（第 10 位），99 看个位（第 1 位）。digits[0] 是个位，不是镜像。
      const place = op.startsWith("BRD") ? 99 - decoded.op : -1;
      const digit = place >= 0 ? distributor.digits[place] : 0;
      const taken =
        op === "BMI"
          ? acc.sign < 0
          : op === "BRNZU"
            ? !upperZero
            : op === "BRNZ"
              ? !isZero(acc.mag)
              : op === "BROV"
                ? overflow
                : digit === 8 || digit === 9;
      if (op === "BROV" && taken) overflow = false;
      pc = taken ? decoded.data : decoded.next;
      trace = `${OPS[op].title}。${taken ? `转到数据地址 ${pc}` : `转到指令地址 ${pc}`}。`;
    } else {
      const operand = mem[decoded.data];
      distributor = cloneWord(operand);
      const lower = placeWord(operand, 0);
      const upper = placeWord(operand, 10);
      if (op === "MULT") {
        const product = mulDigits(acc.mag.slice(10, 20), operand.digits);
        acc = { mag: product, sign: !isZero(product) && acc.sign !== operand.sign ? -1 : 1 };
        remainderSign = null;
        trace = `上半与 ${formatWord(operand)} 逐位做部分积，二十位积是 ${accText(acc)}。下一条在 ${pc}。`;
      } else if (op === "DIV" || op === "DIVRU") {
        if (isZero(operand.digits)) throw new MachineFault("除数是 0");
        const dividend = op === "DIV" ? acc.mag.slice() : [...acc.mag.slice(0, WIDTH), ...Array.from({ length: WIDTH }, () => 0)];
        const dividendSign = acc.sign;
        const divided = divMag20by10(dividend, operand.digits);
        const mag = Array.from({ length: 20 }, (_, i) => (i < WIDTH ? divided.quot[i] : divided.rem[i - WIDTH]));
        const quotientZero = isZero(divided.quot) && !divided.overflow;
        acc = { mag, sign: !quotientZero && dividendSign !== operand.sign ? -1 : 1 };
        remainderSign = !isZero(divided.rem) && dividendSign < 0 ? -1 : 1;
        if (divided.overflow) overflow = true;
        trace = `从高位逐位试商。商在下半，余数在上半。下一条在 ${pc}。`;
      } else if (op === "RAU") commit(loadSigned(upper, operand.sign));
      else if (op === "RSU") commit(loadSigned(upper, opposite(operand.sign, operand.digits)));
      else if (op === "AU") commit(addSigned(acc, upper, operand.sign));
      else if (op === "SU") commit(addSigned(acc, upper, opposite(operand.sign, operand.digits)));
      else if (op === "RAL") commit(loadSigned(lower, operand.sign));
      else if (op === "RSL") commit(loadSigned(lower, opposite(operand.sign, operand.digits)));
      else if (op === "RSABL") commit(loadSigned(lower, opposite(1, operand.digits)));
      else if (op === "ALO") commit(addSigned(acc, lower, operand.sign));
      else if (op === "SLO") commit(addSigned(acc, lower, opposite(operand.sign, operand.digits)));
      else if (op === "AABL") commit(addSigned(acc, lower, 1));
      else if (op === "SABL") commit(addSigned(acc, lower, opposite(1, operand.digits)));
      else if (op === "RAABL") commit(loadSigned(lower, 1));
      else throw new MachineFault(`操作 ${op} 没有执行步骤`);
      if (!trace) trace = `${OPS[op].title} ${formatWord(operand)}。累加器现在是 ${accText(acc)}。下一条在 ${pc}。`;
    }
  } catch (error) {
    const message = error instanceof MachineFault ? error.message : "执行失败";
    return fail(state, message, state.pc);
  }

  if (!halted && (pc < 0 || pc >= DRUM_WORDS)) return fail(state, "下一条地址超出磁鼓", state.pc);

  return {
    ...state,
    mem,
    acc,
    distributor,
    cardAt,
    punch,
    overflow,
    remainderSign,
    pc,
    halted,
    trace,
    log: [...state.log, trace].slice(-8),
    steps: state.steps + 1,
    executed: state.pc,
  };
}

export function run650(state: IbmState, limit = 5000): IbmState {
  let current = state;
  let guard = 0;
  while (!current.halted && !current.error && guard < limit) {
    current = step650(current);
    guard += 1;
  }
  if (!current.halted && !current.error) {
    return fail(current, `跑了 ${limit} 步还没停。`, current.pc);
  }
  return current;
}

export function sameWord(left: Word, right: Word): boolean {
  return left.sign === right.sign && left.digits.every((digit, index) => digit === right.digits[index]);
}

export const IBM650_EXAMPLES: { id: string; title: string; blurb: string; source: string }[] = [
  {
    id: "add",
    title: "27 加 15",
    blurb: "65 先把累加器清掉再加，15 再加一个数，20 把下半存回去。",
    source: `; 指令是十位：两位操作码、四位数据地址、四位下一条地址。
; 下面没写后一个地址的，教学汇编按纸上的下一行补上。
        RAL   A
        ALO   B
        STL   SUM
        STOP
A       DEC   +27
B       DEC   +15
SUM     DEC   +0
`,
  },
  {
    id: "debt",
    title: "30 减 45",
    blurb: "减完如果是负的，二五进制的灯不变，符号位单独翻成负。",
    source: `        RAL   GROSS
        SLO   DED
        STL   NET
        STOP
GROSS   DEC   +30
DED     DEC   +45
NET     DEC   +0
`,
  },
  {
    id: "loop",
    title: "数到 10",
    blurb: "负则去数据地址，否则去指令地址。下一条不靠自动加一。",
    source: `; BMI 的第一个地址是「为负就去」，第二个是「否则就去」。
        RAL   ZERO
        STL   COUNT
LOOP    RAL   COUNT
        ALO   ONE
        STL   COUNT
        SLO   TEN
        BMI   LOOP, DONE
DONE    STOP
ZERO    DEC   +0
ONE     DEC   +1
TEN     DEC   +10
COUNT   DEC   +0
`,
  },
  {
    id: "mul",
    title: "27 乘 15",
    blurb: "先把被乘数移到上半，MULT 用上半去乘内存里的十字。",
    source: `        RAL   A
        SLT   0000
        MULT  B
        STL   PROD
        STOP
A       DEC   +27
B       DEC   +15
PROD    DEC   +0
`,
  },
];
