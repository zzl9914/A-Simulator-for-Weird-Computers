import { MachineFault } from "./fault";

export const DECIMAL_CELLS = 1400;
export const PRINT_LO = 201;
export const PRINT_HI = 332;

export type Zone = "none" | "ab" | "b" | "a";

export type Cell = {
  digit: number | null;
  zone: Zone;
  wm: boolean;
  literal: string | null;
};

export type AsmError = { line: number; message: string };

export function blankCell(): Cell {
  return { digit: null, zone: "none", wm: false, literal: null };
}

export function glyphOf(cell: Cell): string {
  if (cell.literal) return cell.literal;
  if (cell.digit === null) return " ";
  const digit = cell.digit;
  if (cell.zone === "none") return String(digit);
  if (cell.zone === "ab") return digit === 0 ? "&" : "ABCDEFGHI"[digit - 1];
  if (cell.zone === "b") return digit === 0 ? "-" : "JKLMNOPQR"[digit - 1];
  if (digit === 0) return "‡";
  if (digit === 1) return "/";
  return "STUVWXYZ"[digit - 2];
}

export function pad3(value: number): string {
  return value.toString().padStart(3, "0");
}

type OpKind = "ab" | "branch" | "sw" | "none" | "cs" | "one" | "bce" | "bss" | "cw";

type OpSpec = { mnemonic: string; glyph: string; kind: OpKind; dchar?: string };

const OPS: Record<string, OpSpec> = {
  A: { mnemonic: "A", glyph: "A", kind: "ab" },
  S: { mnemonic: "S", glyph: "S", kind: "ab" },
  ZA: { mnemonic: "ZA", glyph: "?", kind: "ab" },
  ZS: { mnemonic: "ZS", glyph: "!", kind: "ab" },
  MCW: { mnemonic: "MCW", glyph: "M", kind: "ab" },
  LCA: { mnemonic: "LCA", glyph: "L", kind: "ab" },
  C: { mnemonic: "C", glyph: "C", kind: "ab" },
  B: { mnemonic: "B", glyph: "B", kind: "branch" },
  BE: { mnemonic: "BE", glyph: "B", kind: "branch", dchar: "S" },
  BH: { mnemonic: "BH", glyph: "B", kind: "branch", dchar: "U" },
  BL: { mnemonic: "BL", glyph: "B", kind: "branch", dchar: "T" },
  BU: { mnemonic: "BU", glyph: "B", kind: "branch", dchar: "/" },
  BAV: { mnemonic: "BAV", glyph: "B", kind: "branch", dchar: "Z" },
  H: { mnemonic: "H", glyph: ".", kind: "none" },
  W: { mnemonic: "W", glyph: "2", kind: "none" },
  SW: { mnemonic: "SW", glyph: ",", kind: "sw" },
  CW: { mnemonic: "CW", glyph: ")", kind: "cw" },
  NOP: { mnemonic: "NOP", glyph: "N", kind: "none" },
  MN: { mnemonic: "MN", glyph: "D", kind: "ab" },
  MZ: { mnemonic: "MZ", glyph: "Y", kind: "ab" },
  MCS: { mnemonic: "MCS", glyph: "Z", kind: "ab" },
  MCE: { mnemonic: "MCE", glyph: "E", kind: "ab" },
  MUL: { mnemonic: "MUL", glyph: "@", kind: "ab" },
  DIV: { mnemonic: "DIV", glyph: "%", kind: "ab" },
  MA: { mnemonic: "MA", glyph: "#", kind: "ab" },
  CS: { mnemonic: "CS", glyph: "/", kind: "cs" },
  SAR: { mnemonic: "SAR", glyph: "Q", kind: "one" },
  SBR: { mnemonic: "SBR", glyph: "H", kind: "one" },
  R: { mnemonic: "R", glyph: "1", kind: "none" },
  WR: { mnemonic: "WR", glyph: "3", kind: "none" },
  P: { mnemonic: "P", glyph: "4", kind: "none" },
  RP: { mnemonic: "RP", glyph: "5", kind: "none" },
  WP: { mnemonic: "WP", glyph: "6", kind: "none" },
  WRP: { mnemonic: "WRP", glyph: "7", kind: "none" },
  BCE: { mnemonic: "BCE", glyph: "B", kind: "bce" },
  BLC: { mnemonic: "BLC", glyph: "B", kind: "branch", dchar: "A" },
  BSS: { mnemonic: "BSS", glyph: "B", kind: "bss" },
};

const DIRECTIVES = new Set(["ORG", "END", "DCW", "DC", "DS", "CARD", "SWON"]);

const A_ZONE_HUNDREDS: Record<string, number> = {
  "‡": 0,
  "/": 1,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

function charCell(glyph: string, wm = false): Cell {
  if (/^[0-9]$/.test(glyph)) {
    return { digit: Number(glyph), zone: "none", wm, literal: null };
  }
  if (glyph in A_ZONE_HUNDREDS) {
    return { digit: A_ZONE_HUNDREDS[glyph], zone: "a", wm, literal: null };
  }
  return { digit: null, zone: "none", wm, literal: glyph };
}

export type LabelMeta = { addr: number; kind: "code" | "data" };

export type DecimalProgram = {
  mem: Cell[];
  entry: number;
  labels: Record<string, LabelMeta>;
  addrToLine: number[];
  lines: string[];
  cards: string[];
  switches: string;
};

type Stmt =
  | { kind: "org"; addr: number; line: number }
  | { kind: "end"; entry?: string; line: number }
  | { kind: "card"; text: string; line: number }
  | { kind: "swon"; letter: string; line: number }
  | { kind: "data"; label?: string; line: number; cells: Cell[] }
  | { kind: "ins"; label?: string; line: number; spec: OpSpec; operands: string[]; width: number };

function stripComment(line: string): string {
  let at = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "@") at = !at;
    if (line[i] === ";" && !at) return line.slice(0, i);
  }
  return line;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) {
      i += 1;
      continue;
    }
    if (input[i] === "@") {
      const end = input.indexOf("@", i + 1);
      if (end < 0) throw new MachineFault("常数以 @ 开头，却没有收尾的 @");
      tokens.push(input.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < input.length && !/\s/.test(input[j])) j += 1;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

const STRING_CHARS = /^[A-Z0-9 =+\-*/.,$&%?!]+$/;

function constantCells(token: string, wordMark: boolean): Cell[] {
  if (token.startsWith("@")) {
    const body = token.slice(1, -1).toUpperCase();
    if (body.length === 0) throw new MachineFault("空的字符常数");
    if (!STRING_CHARS.test(body)) throw new MachineFault(`打印链上没有这些字符：${body}`);
    const cells = [...body].map((char) => charCell(char));
    if (wordMark) cells[0].wm = true;
    return cells;
  }
  if (!/^[+-]?\d+$/.test(token)) throw new MachineFault(`看不懂常数 ${token}`);
  const negative = token.startsWith("-");
  const positive = token.startsWith("+");
  const digits = token.replace(/^[+-]/, "");
  if (digits.length === 0 || digits.length > 12) throw new MachineFault("数字段要在 1 到 12 位");
  const cells: Cell[] = digits.split("").map((char) => ({
    digit: Number(char),
    zone: "none" as Zone,
    wm: false,
    literal: null,
  }));
  if (negative) cells[cells.length - 1].zone = "b";
  else if (positive) cells[cells.length - 1].zone = "ab";
  if (wordMark) cells[0].wm = true;
  return cells;
}

function instructionWidth(spec: OpSpec, operands: string[]): number {
  if (spec.kind === "none") return 1;
  if (spec.kind === "ab") return 7;
  if (spec.kind === "branch") return spec.dchar ? 5 : 4;
  if (spec.kind === "one") return 4;
  if (spec.kind === "bce") return 8;
  if (spec.kind === "bss") return 5;
  if (spec.kind === "cs" || spec.kind === "cw") return operands.length === 2 ? 7 : 4;
  return operands.length === 2 ? 7 : 4;
}

function parseProgram(source: string): { stmts: Stmt[]; errors: AsmError[]; lines: string[] } {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const stmts: Stmt[] = [];
  const errors: AsmError[] = [];
  let pendingLabel: string | undefined;
  let pendingLine = 0;

  lines.forEach((raw, index) => {
    const line = index + 1;
    const stripped = stripComment(raw).trim();
    if (!stripped || stripped.startsWith("*")) return;
    let tokens: string[];
    try {
      tokens = tokenize(stripped);
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : "这一行读不通" });
      return;
    }
    let cursor = 0;
    let inline: string | undefined;
    if (tokens[0].endsWith(":")) {
      inline = tokens[0].slice(0, -1);
      cursor = 1;
    }
    if (cursor >= tokens.length) {
      if (!inline) return;
      if (pendingLabel) errors.push({ line: pendingLine, message: `标号 ${pendingLabel} 悬空了` });
      pendingLabel = inline;
      pendingLine = line;
      return;
    }
    if (!inline && tokens.length >= 2) {
      const second = tokens[1].toUpperCase();
      if (OPS[second] || DIRECTIVES.has(second)) {
        inline = tokens[0];
        cursor = 1;
      }
    }
    if (inline && pendingLabel) {
      errors.push({ line, message: `标号 ${pendingLabel} 还没落地` });
      pendingLabel = undefined;
    }
    const label = (inline ?? pendingLabel)?.toUpperCase();
    pendingLabel = undefined;
    const op = tokens[cursor].toUpperCase();
    const blob = tokens.slice(cursor + 1).join("");
    const operands = blob
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    try {
      if (op === "ORG") {
        if (label) throw new MachineFault("ORG 不能带标号");
        const addr = Number(operands[0]);
        if (!Number.isInteger(addr) || addr < 0 || addr >= DECIMAL_CELLS) {
          throw new MachineFault("ORG 超出 0–1399");
        }
        stmts.push({ kind: "org", addr, line });
        return;
      }
      if (op === "END") {
        stmts.push({ kind: "end", entry: operands[0]?.toUpperCase(), line });
        return;
      }
      if (op === "DS") {
        const count = Number(operands[0]);
        if (!Number.isInteger(count) || count < 1 || count > 40) {
          throw new MachineFault("DS 的长度要在 1 到 40");
        }
        const cells = Array.from({ length: count }, () => blankCell());
        cells[0].wm = true;
        stmts.push({ kind: "data", label, line, cells });
        return;
      }
      if (op === "CARD") {
        const body = operands[0]?.startsWith("@") ? operands[0].slice(1, -1) : (operands[0] ?? "");
        if (!body) throw new MachineFault("CARD 需要一串字符，写在一对 @ 里面");
        stmts.push({ kind: "card", text: body.toUpperCase().padEnd(80, " ").slice(0, 80), line });
        return;
      }
      if (op === "SWON") {
        const letter = (operands[0] ?? "").toUpperCase();
        if (!/^[B-G]$/.test(letter)) throw new MachineFault("SWON 的开关是 B 到 G");
        stmts.push({ kind: "swon", letter, line });
        return;
      }
      if (op === "DCW" || op === "DC") {
        if (operands.length !== 1) throw new MachineFault(`${op} 需要一个常数`);
        const cells = constantCells(operands[0], op === "DCW");
        stmts.push({ kind: "data", label, line, cells });
        return;
      }
      const spec = OPS[op];
      if (!spec) throw new MachineFault(`不认识的操作 ${tokens[cursor]}`);
      if (spec.kind === "none" && operands.length !== 0) throw new MachineFault(`${op} 不带地址`);
      if (spec.kind === "ab" && operands.length !== 2) throw new MachineFault(`${op} 需要 A、B 两个地址`);
      if (spec.kind === "branch" && operands.length !== 1) throw new MachineFault(`${op} 需要一个转移地址`);
      if ((spec.kind === "sw" || spec.kind === "cw") && (operands.length < 1 || operands.length > 2)) {
        throw new MachineFault(`${op} 需要一或两个地址`);
      }
      if (spec.kind === "cs" && (operands.length < 1 || operands.length > 2)) throw new MachineFault("CS 需要一或两个地址");
      if (spec.kind === "one" && operands.length !== 1) throw new MachineFault(`${op} 需要一个地址`);
      if (spec.kind === "bce" && (operands.length !== 3 || operands[2].length !== 1)) {
        throw new MachineFault("BCE 要写转移地址、比较地址和一个字符");
      }
      if (spec.kind === "bss" && (operands.length !== 2 || !/^[B-G]$/.test(operands[1].toUpperCase()))) {
        throw new MachineFault("BSS 要写转移地址和开关 B–G");
      }
      stmts.push({
        kind: "ins",
        label,
        line,
        spec,
        operands: operands.map((operand) => operand.toUpperCase()),
        width: instructionWidth(spec, operands),
      });
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : "汇编失败" });
    }
  });

  if (pendingLabel) errors.push({ line: pendingLine, message: `标号 ${pendingLabel} 没有落地` });
  return { stmts, errors, lines };
}

export function assembleDecimal(
  source: string,
): { ok: true; program: DecimalProgram } | { ok: false; errors: AsmError[] } {
  const { stmts, errors, lines } = parseProgram(source);
  if (!source.trim()) errors.push({ line: 1, message: "程序是空的" });
  if (errors.length > 0) return { ok: false, errors };

  const labels = new Map<string, LabelMeta>();
  const placed: { addr: number; stmt: Stmt }[] = [];
  let cursor = 0;
  for (const stmt of stmts) {
    if (stmt.kind === "org") {
      cursor = stmt.addr;
      continue;
    }
    if (stmt.kind === "end" || stmt.kind === "card" || stmt.kind === "swon") continue;
    const width = stmt.kind === "data" ? stmt.cells.length : stmt.width;
    if (cursor + width > DECIMAL_CELLS) {
      errors.push({ line: stmt.line, message: `程序超出 ${DECIMAL_CELLS} 个字符` });
      break;
    }
    if (stmt.label) {
      if (!/^[A-Z][A-Z0-9]{0,11}$/.test(stmt.label)) {
        errors.push({ line: stmt.line, message: `标号 ${stmt.label} 不合法` });
      } else if (labels.has(stmt.label)) {
        errors.push({ line: stmt.line, message: `标号 ${stmt.label} 重复了` });
      } else {
        const addr = stmt.kind === "data" ? cursor + width - 1 : cursor;
        labels.set(stmt.label, { addr, kind: stmt.kind === "ins" ? "code" : "data" });
      }
    }
    placed.push({ addr: cursor, stmt });
    cursor += width;
  }

  const ends = stmts.filter((stmt) => stmt.kind === "end");
  if (ends.length > 1) errors.push({ line: ends[1].line, message: "END 只能有一个" });
  if (errors.length > 0) return { ok: false, errors };

  const mem = Array.from({ length: DECIMAL_CELLS }, () => blankCell());
  const addrToLine = Array.from({ length: DECIMAL_CELLS }, () => -1);
  const occupied = Array.from({ length: DECIMAL_CELLS }, () => false);

  const resolve = (token: string, line: number): number | null => {
    if (/^\d+$/.test(token)) {
      const value = Number(token);
      if (value >= DECIMAL_CELLS) {
        errors.push({ line, message: `地址 ${token} 超出内存` });
        return null;
      }
      return value;
    }
    const found = labels.get(token);
    if (!found) {
      errors.push({ line, message: `没有标号 ${token}` });
      return null;
    }
    return found.addr;
  };

  const writeCell = (addr: number, cell: Cell, line: number) => {
    if (occupied[addr]) errors.push({ line, message: `地址 ${pad3(addr)} 被写了两次` });
    occupied[addr] = true;
    mem[addr] = cell;
    addrToLine[addr] = line;
  };

  for (const { addr, stmt } of placed) {
    if (stmt.kind === "data") {
      stmt.cells.forEach((cell, offset) => writeCell(addr + offset, cell, stmt.line));
      continue;
    }
    if (stmt.kind !== "ins") continue;
    const spec = stmt.spec;
    const chars: string[] = [spec.glyph];
    if (spec.kind === "ab" || spec.kind === "sw" || spec.kind === "cw" || spec.kind === "branch" || spec.kind === "cs" || spec.kind === "one" || spec.kind === "bce" || spec.kind === "bss") {
      const addressOperands = spec.kind === "bce" ? stmt.operands.slice(0, 2) : spec.kind === "bss" ? stmt.operands.slice(0, 1) : stmt.operands;
      for (const operand of addressOperands) {
        const resolved = resolve(operand, stmt.line);
        if (resolved === null) continue;
        chars.push(...addressGlyphs(resolved));
      }
      if (spec.dchar) chars.push(spec.dchar);
      if (spec.kind === "bce") chars.push(stmt.operands[2].toUpperCase());
      if (spec.kind === "bss") chars.push(stmt.operands[1].toUpperCase());
    }
    chars.forEach((glyph, offset) => {
      const cell = charCell(glyph, offset === 0);
      writeCell(addr + offset, cell, stmt.line);
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  let entry: number | null = null;
  const end = ends[0];
  if (end?.entry) {
    const found = labels.get(end.entry);
    if (!found) errors.push({ line: end.line, message: `END 找不到 ${end.entry}` });
    else entry = found.addr;
  } else {
    const first = placed.find((item) => item.stmt.kind === "ins");
    entry = first ? first.addr : null;
  }
  if (errors.length > 0) return { ok: false, errors };
  if (entry === null) return { ok: false, errors: [{ line: 1, message: "没有可以执行的指令" }] };

  return {
    ok: true,
    program: {
      mem,
      entry,
      labels: Object.fromEntries(labels),
      addrToLine,
      lines,
      cards: stmts.filter((stmt) => stmt.kind === "card").map((stmt) => stmt.text),
      switches: stmts
        .filter((stmt) => stmt.kind === "swon")
        .map((stmt) => stmt.letter)
        .join(""),
    },
  };
}

export type Indicator = "high" | "low" | "equal";

export type DecimalState = {
  mem: Cell[];
  pc: number;
  halted: boolean;
  indicator: Indicator | null;
  overflow: boolean;
  printer: string[];
  punch: string[];
  cards: string[];
  cardAt: number;
  lastCard: boolean;
  switches: string;
  aReg: number;
  bReg: number;
  error?: string;
  trace: string;
  log: string[];
  steps: number;
  touched: number[];
  executedAddr: number | null;
  entry: number;
  labels: Record<string, LabelMeta>;
  addrToLine: number[];
  lines: string[];
};

function cloneMem(mem: Cell[]): Cell[] {
  return mem.map((cell) => ({ ...cell }));
}

export function bootDecimal(program: DecimalProgram): DecimalState {
  return {
    mem: cloneMem(program.mem),
    pc: program.entry,
    halted: false,
    indicator: null,
    overflow: false,
    printer: [],
    punch: [],
    cards: program.cards.slice(),
    cardAt: 0,
    lastCard: false,
    switches: program.switches,
    aReg: 0,
    bReg: 0,
    trace: `程序已装入。从地址 ${pad3(program.entry)} 取指令，操作码上应当有字标。`,
    log: [],
    steps: 0,
    touched: [],
    executedAddr: null,
    entry: program.entry,
    labels: program.labels,
    addrToLine: program.addrToLine.slice(),
    lines: program.lines.slice(),
  };
}

type Field = { digits: number[]; sign: 1 | -1; cells: number[]; longer: boolean };

function cellDigit(cell: Cell): number {
  if (cell.digit !== null) return cell.digit;
  if (cell.literal === null) return 0;
  throw new MachineFault(`字符「${cell.literal}」不是十进制数字`);
}

function readUntilMark(mem: Cell[], addr: number): Field {
  const digits: number[] = [];
  const cells: number[] = [];
  let sign: 1 | -1 = 1;
  let i = addr;
  for (let count = 0; count < 12; count += 1) {
    if (i < 0) throw new MachineFault("往左找字标时越过了地址 000");
    const cell = mem[i];
    digits.push(cellDigit(cell));
    cells.push(i);
    if (count === 0 && cell.zone === "b") sign = -1;
    if (cell.wm) return { digits, sign, cells, longer: false };
    i -= 1;
  }
  throw new MachineFault("这个字段超过 12 位还没有字标，机器不知道在哪里停");
}

function readUpTo(mem: Cell[], addr: number, length: number): Field {
  const digits: number[] = [];
  const cells: number[] = [];
  let sign: 1 | -1 = 1;
  let i = addr;
  for (let count = 0; count < length; count += 1) {
    if (i < 0) throw new MachineFault("A 字段往左越过了地址 000");
    const cell = mem[i];
    digits.push(cellDigit(cell));
    cells.push(i);
    if (count === 0 && cell.zone === "b") sign = -1;
    if (cell.wm) return { digits, sign, cells, longer: false };
    i -= 1;
  }
  return { digits, sign, cells, longer: true };
}

function compareMagnitude(left: readonly number[], right: readonly number[]): number {
  const width = Math.max(left.length, right.length);
  for (let i = width - 1; i >= 0; i -= 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function addMagnitude(left: number[], right: number[]): { digits: number[]; overflow: boolean } {
  const digits: number[] = [];
  let carry = 0;
  for (let i = 0; i < left.length; i += 1) {
    const sum = left[i] + right[i] + carry;
    digits.push(sum % 10);
    carry = Math.floor(sum / 10);
  }
  return { digits, overflow: carry !== 0 };
}

function subMagnitude(big: readonly number[], small: readonly number[]): number[] {
  const digits: number[] = [];
  let borrow = 0;
  for (let i = 0; i < big.length; i += 1) {
    let diff = big[i] - (small[i] ?? 0) - borrow;
    if (diff < 0) {
      diff += 10;
      borrow = 1;
    } else borrow = 0;
    digits.push(diff);
  }
  return digits;
}

function fit(digits: readonly number[], length: number): number[] {
  const fitted = digits.slice(0, length);
  while (fitted.length < length) fitted.push(0);
  return fitted;
}

function algebraic(
  aField: Field,
  bField: Field,
  subtract: boolean,
): { digits: number[]; sign: 1 | -1; overflow: boolean; note: string } {
  const length = bField.digits.length;
  const aDigits = fit(aField.digits, length);
  const bDigits = fit(bField.digits, length);
  const signA: 1 | -1 = subtract ? (aField.sign === 1 ? -1 : 1) : aField.sign;
  const signB = bField.sign;
  const note = aField.longer ? "A 字段比 B 长，字标以外的高位没有参加运算。" : "";
  let digits: number[];
  let sign: 1 | -1;
  let overflow = false;
  if (signA === signB) {
    const added = addMagnitude(aDigits, bDigits);
    digits = added.digits;
    overflow = added.overflow;
    sign = signA;
  } else {
    const order = compareMagnitude(aDigits, bDigits);
    if (order === 0) {
      digits = bDigits.map(() => 0);
      sign = 1;
    } else if (order > 0) {
      digits = subMagnitude(aDigits, bDigits);
      sign = signA;
    } else {
      digits = subMagnitude(bDigits, aDigits);
      sign = signB;
    }
  }
  if (digits.every((digit) => digit === 0)) sign = 1;
  return { digits: fit(digits, length), sign, overflow, note };
}

function writeField(mem: Cell[], field: Field, digits: number[], sign: 1 | -1) {
  field.cells.forEach((addr, index) => {
    const previous = mem[addr];
    mem[addr] = {
      digit: digits[index] ?? 0,
      literal: null,
      wm: previous.wm,
      zone: index === 0 ? (sign < 0 ? "b" : "ab") : "none",
    };
  });
}

function digitsText(digits: readonly number[], sign: 1 | -1): string {
  const body = digits.slice().reverse().join("").replace(/^0+(?=\d)/, "");
  if (body === "0") return "0";
  return `${sign < 0 ? "-" : ""}${body}`;
}

function resultSign(sign: 1 | -1, digits: readonly number[]): 1 | -1 {
  return digits.every((digit) => digit === 0) ? 1 : sign;
}

function mulDigits(left: readonly number[], right: readonly number[]): number[] {
  const prod = Array.from({ length: left.length + right.length }, () => 0);
  for (let i = 0; i < right.length; i += 1) {
    let carry = 0;
    for (let j = 0; j < left.length; j += 1) {
      const sum = prod[i + j] + left[j] * right[i] + carry;
      prod[i + j] = sum % 10;
      carry = Math.floor(sum / 10);
    }
    let at = i + left.length;
    while (carry > 0) {
      if (at >= prod.length) throw new MachineFault("乘积超出 A、B 字段长度之和");
      const sum = prod[at] + carry;
      prod[at] = sum % 10;
      carry = Math.floor(sum / 10);
      at += 1;
    }
  }
  return prod;
}

function shiftedDivisor(divisor: readonly number[], shift: number, width: number): number[] | null {
  const shifted = Array.from({ length: width }, () => 0);
  for (let i = 0; i < divisor.length; i += 1) {
    const dest = i + shift;
    if (dest >= width) {
      if (divisor[i] !== 0) return null;
    } else shifted[dest] = divisor[i];
  }
  return shifted;
}

/** 从高位起，能减几次除数就得到那一位商。 */
function divDigits(dividend: readonly number[], divisor: readonly number[]): { quot: number[]; rem: number[] } {
  const width = dividend.length;
  let rem = fit(dividend, width);
  const quot = Array.from({ length: width }, () => 0);
  for (let shift = width - 1; shift >= 0; shift -= 1) {
    const shifted = shiftedDivisor(divisor, shift, width);
    let count = 0;
    while (shifted && compareMagnitude(rem, shifted) >= 0) {
      rem = subMagnitude(rem, shifted);
      count += 1;
      if (count > 9) throw new MachineFault("商超出字段");
    }
    quot[shift] = count;
  }
  return { quot, rem };
}

function writeDigits(mem: Cell[], cells: number[], digits: readonly number[], sign: 1 | -1) {
  cells.forEach((addr, index) => {
    mem[addr] = {
      digit: digits[index] ?? 0,
      literal: null,
      wm: index === cells.length - 1,
      zone: index === 0 ? (sign < 0 ? "b" : "ab") : "none",
    };
  });
}

function fieldValue(field: Field): number {
  let value = 0;
  for (let i = field.digits.length - 1; i >= 0; i -= 1) value = value * 10 + field.digits[i];
  return value * field.sign;
}

function zonePhrase(digit: number, sign: 1 | -1): string {
  if (sign < 0) {
    const glyph = digit === 0 ? "-" : "JKLMNOPQR"[digit - 1];
    return `个位带负号区位，打印出来是 ${glyph}`;
  }
  const glyph = digit === 0 ? "&" : "ABCDEFGHI"[digit - 1];
  return `个位带正号区位，打印出来是 ${glyph}`;
}

function readInstruction(mem: Cell[], pc: number) {
  if (pc < 0 || pc >= DECIMAL_CELLS) throw new MachineFault("指令地址超出内存");
  if (!mem[pc].wm) {
    throw new MachineFault(`地址 ${pad3(pc)} 没有字标。1401 靠操作码上的字标认出一条指令的开头。`);
  }
  const span = [pc];
  const chars = [glyphOf(mem[pc])];
  let i = pc + 1;
  while (i < DECIMAL_CELLS && !mem[i].wm && chars.length < 8) {
    chars.push(glyphOf(mem[i]));
    span.push(i);
    i += 1;
  }
  return { op: chars[0], body: chars.slice(1), next: i, span };
}

function addressGlyphs(value: number): string[] {
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  const hundreds = Math.floor(rest / 100);
  const tens = Math.floor((rest % 100) / 10);
  const units = rest % 10;
  const head = thousands === 0 ? String(hundreds) : glyphOf({ digit: hundreds, zone: "a", wm: false, literal: null });
  return [head, String(tens), String(units)];
}

function parseAddr(chars: string[]): number {
  if (chars.length !== 3) throw new MachineFault("地址应是三个字符");
  let thousands = 0;
  let hundreds: number;
  if (/^[0-9]$/.test(chars[0])) hundreds = Number(chars[0]);
  else if (chars[0] in A_ZONE_HUNDREDS) {
    hundreds = A_ZONE_HUNDREDS[chars[0]];
    thousands = 1;
  } else throw new MachineFault(`百位「${chars[0]}」不是 1401 的地址码`);
  if (!/^[0-9]$/.test(chars[1]) || !/^[0-9]$/.test(chars[2])) {
    throw new MachineFault("十位和个位仍是普通数字。超过 999 时只给百位加 A 区位。");
  }
  const value = thousands * 1000 + hundreds * 100 + Number(chars[1]) * 10 + Number(chars[2]);
  if (value >= DECIMAL_CELLS) throw new MachineFault(`地址 ${value} 超出 1400 个字符`);
  return value;
}

function fail(state: DecimalState, message: string, executedAddr: number): DecimalState {
  return {
    ...state,
    halted: true,
    error: message,
    trace: message,
    log: [...state.log, message].slice(-12),
    executedAddr,
    steps: state.steps + 1,
    touched: [],
  };
}

export function stepDecimal(state: DecimalState): DecimalState {
  if (state.halted || state.error) return state;
  const mem = cloneMem(state.mem);
  try {
    const instruction = readInstruction(mem, state.pc);
    const { op, body } = instruction;
    let pc = instruction.next;
    let halted = false;
    let indicator = state.indicator;
    let overflow = state.overflow;
    let trace = "";
    const touched = instruction.span.slice();
    const printer = state.printer.slice();
    const punch = state.punch.slice();
    let cardAt = state.cardAt;
    let lastCard = state.lastCard;
    let aReg = state.aReg;
    let bReg = state.bReg;

    const readCard = () => {
      const card = state.cards[cardAt];
      if (!card) {
        lastCard = true;
        return;
      }
      cardAt += 1;
      for (let i = 0; i < 80; i += 1) mem[1 + i] = charCell(card[i] === " " ? " " : card[i]);
      if (cardAt >= state.cards.length) lastCard = true;
    };
    const punchCard = () => {
      let text = "";
      for (let addr = 101; addr <= 180; addr += 1) text += glyphOf(mem[addr] ?? blankCell());
      punch.push(text);
    };
    const printLine = () => {
      let line = "";
      for (let addr = PRINT_LO; addr <= PRINT_HI; addr += 1) line += glyphOf(mem[addr]);
      printer.push(line);
    };

    const takeAB = () => {
      if (body.length !== 6) {
        throw new MachineFault("这条指令应有两个三位地址。后面的字标来得太早，指令被截短了。");
      }
      return [parseAddr(body.slice(0, 3)), parseAddr(body.slice(3, 6))] as const;
    };

    if (op === "A" || op === "S" || op === "?" || op === "!") {
      const [aAddr, bAddr] = takeAB();
      const bField = readUntilMark(mem, bAddr);
      const aField = readUpTo(mem, aAddr, bField.digits.length);
      const subtract = op === "S" || op === "!";
      const zeroFirst = op === "?" || op === "!";
      const base = zeroFirst ? { ...bField, digits: bField.digits.map(() => 0), sign: 1 as const } : bField;
      const result = algebraic(aField, base, subtract);
      writeField(mem, bField, result.digits, result.sign);
      overflow = result.overflow;
      touched.push(...aField.cells, ...bField.cells);
      const names: Record<string, string> = { A: "加", S: "减", "?": "清零后加", "!": "清零后减" };
      trace = `${names[op]}：A 字段 ${fieldValue(aField)}，B 字段得到 ${result.sign < 0 ? "−" : "+"}${fieldValue({ ...bField, digits: result.digits, sign: 1 })}。${zonePhrase(result.digits[0] ?? 0, result.sign)}。${result.note}${result.overflow ? "结果超出 B 字段，溢出灯亮。" : ""}`;
    } else if (op === "C") {
      const [aAddr, bAddr] = takeAB();
      const aField = readUntilMark(mem, aAddr);
      const bField = readUntilMark(mem, bAddr);
      const aValue = fieldValue(aField);
      const bValue = fieldValue(bField);
      indicator = bValue > aValue ? "high" : bValue < aValue ? "low" : "equal";
      touched.push(...aField.cells, ...bField.cells);
      const lamp = indicator === "high" ? "高" : indicator === "low" ? "低" : "等";
      trace = `比较：A = ${aValue}，B = ${bValue}。B ${indicator === "equal" ? "等于" : indicator === "high" ? "大于" : "小于"} A，指示灯「${lamp}」亮。`;
    } else if (op === "M" || op === "L") {
      const [aAddr, bAddr] = takeAB();
      let a = aAddr;
      let b = bAddr;
      const moved: number[] = [];
      for (let guard = 0; guard < DECIMAL_CELLS; guard += 1) {
        if (a < 0 || b < 0) throw new MachineFault("搬家时越过了地址 000，字段缺少字标");
        const stop = mem[a].wm || mem[b].wm;
        mem[b] = {
          digit: mem[a].digit,
          zone: mem[a].zone,
          literal: mem[a].literal,
          wm: op === "L" ? mem[a].wm : mem[b].wm,
        };
        moved.push(b);
        if (stop) break;
        a -= 1;
        b -= 1;
      }
      touched.push(...moved);
      trace =
        op === "M"
          ? `MCW：从地址 ${pad3(aAddr)} 向左搬到 ${pad3(bAddr)}，遇到任一字标就停。字标本身不搬走。`
          : `LCA：和 MCW 一样往左搬，但字标也一起复制。`;
    } else if (op === "B" && body.length === 7) {
      const target = parseAddr(body.slice(0, 3));
      const probe = parseAddr(body.slice(3, 6));
      const character = body[6];
      const taken = glyphOf(mem[probe]) === character;
      if (taken) pc = target;
      aReg = probe;
      bReg = target;
      touched.push(probe);
      trace = `BCE：地址 ${pad3(probe)} 的「${glyphOf(mem[probe])}」${taken ? "等于" : "不等于"}「${character}」。${taken ? `转到 ${pad3(target)}` : `去 ${pad3(pc)}`}。`;
    } else if (op === "B") {
      if (body.length !== 3 && body.length !== 4) {
        throw new MachineFault("转移指令的长度不对。下一条字标的位置决定这条指令有多长。");
      }
      const target = parseAddr(body.slice(0, 3));
      bReg = target;
      const modifier = body.length === 4 ? body[3] : undefined;
      let taken = false;
      if (modifier === undefined) taken = true;
      else if (modifier === "S") taken = indicator === "equal";
      else if (modifier === "U") taken = indicator === "high";
      else if (modifier === "T") taken = indicator === "low";
      else if (modifier === "/") taken = indicator !== null && indicator !== "equal";
      else if (modifier === "Z") taken = overflow;
      else if (modifier === "A") taken = lastCard;
      else if (/^[A-G]$/.test(modifier ?? "")) taken = state.switches.includes(modifier ?? "");
      else throw new MachineFault(`不认识的转移特征字符 ${modifier}`);
      if (modifier === "Z") overflow = false;
      if (taken) pc = target;
      const detail =
        modifier === undefined
          ? "无条件转移"
          : modifier === "S"
            ? "相等才转移"
            : modifier === "U"
              ? "B 大于 A 才转移"
              : modifier === "T"
                ? "B 小于 A 才转移"
                : modifier === "/"
                  ? "不相等才转移"
                  : modifier === "A"
                  ? "最后一张卡片才转移"
                  : /^[B-G]$/.test(modifier ?? "")
                    ? `开关 ${modifier} 接通才转移`
                    : "溢出才转移";
      trace = `${detail}。${taken ? `转到 ${pad3(target)}` : `条件不成立，去 ${pad3(pc)}`}。`;
    } else if (op === ".") {
      if (body.length !== 0) throw new MachineFault("停机指令后面没有字标，后面的字符被吃进来了。");
      halted = true;
      pc = state.pc;
      trace = "停机。";
    } else if (op === "2") {
      if (body.length !== 0) throw new MachineFault("打印指令被后面的字符沾上了。检查下一条指令有没有字标。");
      let line = "";
      for (let addr = PRINT_LO; addr <= PRINT_HI; addr += 1) line += glyphOf(mem[addr]);
      printer.push(line);
      trace = `W：把 ${PRINT_LO}–${PRINT_HI} 送到打印机。带区位的个位会印成字母或符号。`;
    } else if (op === ",") {
      if (body.length !== 3 && body.length !== 6) throw new MachineFault("SW 需要一或两个三位地址");
      const addresses = [parseAddr(body.slice(0, 3))];
      if (body.length === 6) addresses.push(parseAddr(body.slice(3, 6)));
      for (const addr of addresses) {
        mem[addr] = { ...mem[addr], wm: true };
        touched.push(addr);
      }
      trace = `在地址 ${addresses.map(pad3).join(" 和 ")} 设下字标。`;
    } else if (op === "N") {
      trace = "空操作。";
    } else if (op === "D" || op === "Y" || op === "Z") {
      const [aAddr, bAddr] = takeAB();
      aReg = aAddr;
      bReg = bAddr;
      let a = aAddr;
      let b = bAddr;
      let significant = false;
      const seen: number[] = [];
      for (let guard = 0; guard < DECIMAL_CELLS; guard += 1) {
        if (a < 0 || b < 0) throw new MachineFault("搬家时越过了地址 000");
        const stop = mem[a].wm || mem[b].wm;
        if (op === "D") mem[b] = { ...mem[b], digit: mem[a].digit, literal: null };
        else if (op === "Y") mem[b] = { ...mem[b], zone: mem[a].zone };
        else {
          const digit = mem[a].digit;
          const show = significant || digit !== 0 || stop;
          if (digit !== 0 && digit !== null) significant = true;
          mem[b] = show ? { digit: mem[a].digit, zone: mem[a].zone, literal: mem[a].literal, wm: mem[b].wm } : { ...blankCell(), wm: mem[b].wm };
        }
        seen.push(b);
        if (stop) break;
        a -= 1;
        b -= 1;
      }
      touched.push(...seen);
      trace = op === "D" ? "MN：只搬数字位，区位留在原地。" : op === "Y" ? "MZ：只搬区位。" : "MCS：搬家，并把左边的零换成空白。";
    } else if (op === "E") {
      const [aAddr, bAddr] = takeAB();
      aReg = aAddr;
      bReg = bAddr;
      const source = readUntilMark(mem, aAddr);
      const mask: number[] = [];
      for (let addr = bAddr; addr >= 0; addr -= 1) {
        mask.push(addr);
        if (mem[addr].wm) break;
      }
      let digitAt = 0;
      let significant = false;
      const negative = source.sign < 0;
      for (const addr of mask) {
        const glyph = glyphOf(mem[addr]);
        const select = glyph === " " || glyph === "0";
        if (select) {
          const digit = source.digits[digitAt] ?? 0;
          digitAt += 1;
          if (digit !== 0) significant = true;
          const printZero = glyph === "0" || significant;
          mem[addr] = printZero ? { digit, zone: "none", wm: mem[addr].wm, literal: null } : { ...blankCell(), wm: mem[addr].wm };
          if (glyph === "0") significant = true;
        } else if (glyph === "," || glyph === "." || glyph === "$") {
          if (!significant) mem[addr] = { ...blankCell(), wm: mem[addr].wm };
        } else if (glyph === "-") {
          mem[addr] = negative ? mem[addr] : { ...blankCell(), wm: mem[addr].wm };
        }
      }
      touched.push(...source.cells, ...mask);
      trace = `MCE：按编辑字把 ${fieldValue(source)} 填进 B 字段。`;
    } else if (op === "@" || op === "%") {
      const [aAddr, bAddr] = takeAB();
      aReg = aAddr;
      bReg = bAddr;
      const aField = readUntilMark(mem, aAddr);
      const bField = readUntilMark(mem, bAddr);
      if (op === "%") {
        if (aField.digits.every((digit) => digit === 0)) throw new MachineFault("除数是 0");
        const divided = divDigits(bField.digits, aField.digits);
        const quotSign = resultSign(aField.sign === bField.sign ? 1 : -1, divided.quot);
        const remSign = resultSign(bField.sign, divided.rem);
        writeDigits(mem, bField.cells, divided.rem, remSign);
        const quotCells: number[] = [];
        const high = bField.cells[bField.cells.length - 1] - 1;
        for (let n = 0; n < bField.cells.length; n += 1) quotCells.push(high - n);
        if (quotCells.some((addr) => addr < 0)) throw new MachineFault("商向左越过了地址 000");
        writeDigits(mem, quotCells, divided.quot, quotSign);
        touched.push(...aField.cells, ...bField.cells, ...quotCells);
        trace = `除法逐位试商：${digitsText(bField.digits, bField.sign)} ÷ ${digitsText(aField.digits, aField.sign)}。商 ${digitsText(divided.quot, quotSign)} 写在被除数左边，余数 ${digitsText(divided.rem, remSign)} 留在 B 字段。`;
      } else {
        const product = mulDigits(aField.digits, bField.digits);
        const sign = resultSign(aField.sign === bField.sign ? 1 : -1, product);
        const cells: number[] = [];
        for (let n = 0; n < product.length; n += 1) cells.push(bAddr - n);
        if (cells.some((addr) => addr < 0)) throw new MachineFault("积向左越过了地址 000");
        writeDigits(mem, cells, product, sign);
        touched.push(...cells);
        trace = `乘法逐位做部分积：${digitsText(aField.digits, aField.sign)} × ${digitsText(bField.digits, bField.sign)} = ${digitsText(product, sign)}，个位仍在 ${pad3(bAddr)}。`;
      }
    } else if (op === "#") {
      const [aAddr, bAddr] = takeAB();
      aReg = aAddr;
      bReg = bAddr;
      const readAddress = (addr: number) => parseAddr([glyphOf(mem[addr - 2]), glyphOf(mem[addr - 1]), glyphOf(mem[addr])]);
      const sum = readAddress(aAddr) + readAddress(bAddr);
      if (sum >= DECIMAL_CELLS) throw new MachineFault(`地址和 ${sum} 超出内存`);
      addressGlyphs(sum).forEach((glyph, index) => {
        const addr = bAddr - 2 + index;
        mem[addr] = { ...charCell(glyph), wm: mem[addr].wm };
        touched.push(addr);
      });
      trace = `MA：两个三位地址相加，结果写回 B。`;
    } else if (op === "/") {
      if (body.length !== 3 && body.length !== 6) throw new MachineFault("CS 需要一或两个三位地址");
      const start = parseAddr(body.slice(0, 3));
      aReg = start;
      for (let addr = start; addr >= 0; addr -= 1) {
        mem[addr] = blankCell();
        touched.push(addr);
        if (addr % 100 === 0) break;
      }
      if (body.length === 6) {
        pc = parseAddr(body.slice(3, 6));
        bReg = pc;
      }
      trace = `从 ${pad3(start)} 向左清到这个百位。${body.length === 6 ? `然后转到 ${pad3(pc)}。` : ""}`;
    } else if (op === ")") {
      if (body.length !== 3 && body.length !== 6) throw new MachineFault("CW 需要一或两个三位地址");
      const addresses = [parseAddr(body.slice(0, 3))];
      if (body.length === 6) addresses.push(parseAddr(body.slice(3, 6)));
      for (const addr of addresses) {
        mem[addr] = { ...mem[addr], wm: false };
        touched.push(addr);
      }
      trace = `清掉地址 ${addresses.map(pad3).join(" 和 ")} 的字标。`;
    } else if (op === "Q" || op === "H") {
      if (body.length !== 3) throw new MachineFault("存地址寄存器需要一个三位地址");
      const addr = parseAddr(body);
      const value = op === "Q" ? aReg : bReg;
      addressGlyphs(value).forEach((glyph, index) => {
        const at = addr - 2 + index;
        mem[at] = { ...charCell(glyph), wm: index === 0 ? true : mem[at].wm };
        touched.push(at);
      });
      trace = `${op === "Q" ? "SAR" : "SBR"}：把${op === "Q" ? " A " : " B "}地址寄存器 ${pad3(value)} 写到 ${pad3(addr)}。`;
    } else if (op === "1" || op === "3" || op === "4" || op === "5" || op === "6" || op === "7") {
      if (op === "3" || op === "6" || op === "7") printLine();
      if (op === "4" || op === "5" || op === "6" || op === "7") punchCard();
      if (op === "1" || op === "3" || op === "5" || op === "7") readCard();
      trace = `输入输出 ${op}。${lastCard ? "最后一张卡片的指示灯亮了。" : ""}`;
    } else {
      throw new MachineFault(`地址 ${pad3(state.pc)} 的字符「${op}」不是 1401 的操作码`);
    }

    return {
      ...state,
      mem,
      pc,
      halted,
      indicator,
      overflow,
      printer,
      punch,
      cardAt,
      lastCard,
      aReg,
      bReg,
      trace,
      log: [...state.log, trace].slice(-12),
      steps: state.steps + 1,
      touched,
      executedAddr: state.pc,
    };
  } catch (error) {
    if (error instanceof MachineFault) return fail(state, error.message, state.pc);
    throw error;
  }
}

export function runDecimal(state: DecimalState, limit = 5000): DecimalState {
  let current = state;
  let guard = 0;
  while (!current.halted && !current.error && guard < limit) {
    current = stepDecimal(current);
    guard += 1;
  }
  if (!current.halted && !current.error) {
    return fail(current, `跑了 ${limit} 步还没停，多半是循环没有出口。`, current.pc);
  }
  return current;
}

export type FieldWatch = {
  name: string;
  addr: number;
  kind: "code" | "number" | "text" | "open";
  text: string;
  value: number | null;
  glyphs: string;
};

export function watchFields(mem: Cell[], labels: Record<string, LabelMeta>): FieldWatch[] {
  return Object.entries(labels)
    .map(([name, meta]) => {
      if (meta.kind === "code") {
        return {
          name,
          addr: meta.addr,
          kind: "code" as const,
          text: glyphOf(mem[meta.addr] ?? blankCell()),
          value: null,
          glyphs: glyphOf(mem[meta.addr] ?? blankCell()),
        };
      }
      try {
        const field = readUntilMark(mem, meta.addr);
        const glyphs = field.cells
          .slice()
          .reverse()
          .map((addr) => glyphOf(mem[addr]))
          .join("");
        const numeric = field.cells.every((addr) => mem[addr].literal === null);
        if (!numeric) {
          return {
            name,
            addr: meta.addr,
            kind: "text" as const,
            text: glyphs,
            value: null,
            glyphs,
          };
        }
        return {
          name,
          addr: meta.addr,
          kind: "number" as const,
          text: glyphs,
          value: fieldValue(field),
          glyphs,
        };
      } catch {
        return {
          name,
          addr: meta.addr,
          kind: "open" as const,
          text: "没有字标",
          value: null,
          glyphs: "",
        };
      }
    })
    .sort((a, b) => a.addr - b.addr);
}

export function bcdBits(cell: Cell): { name: string; on: boolean }[] {
  const digit = cell.digit ?? 0;
  const numeric = cell.digit !== null;
  return [
    { name: "B", on: cell.zone === "ab" || cell.zone === "b" },
    { name: "A", on: cell.zone === "ab" || cell.zone === "a" },
    { name: "8", on: numeric && (digit === 0 || digit === 8 || digit === 9) },
    { name: "4", on: numeric && digit >= 4 && digit <= 7 },
    { name: "2", on: numeric && (digit === 0 || digit === 2 || digit === 3 || digit === 6 || digit === 7) },
    { name: "1", on: numeric && digit % 2 === 1 },
  ];
}

export function bcdRows(mem: Cell[], addr: number): { glyph: string; bits: { name: string; on: boolean }[] }[] {
  try {
    const field = readUntilMark(mem, addr);
    return field.cells
      .slice()
      .reverse()
      .map((cellAddr) => ({ glyph: glyphOf(mem[cellAddr]), bits: bcdBits(mem[cellAddr]) }));
  } catch {
    return [];
  }
}

export function printLine(mem: Cell[]): string {
  let line = "";
  for (let addr = PRINT_LO; addr <= PRINT_HI; addr += 1) line += glyphOf(mem[addr]);
  return line;
}

export const DECIMAL_EXAMPLES: { id: string; title: string; blurb: string; source: string }[] = [
  {
    id: "add",
    title: "27 加 15",
    blurb: "字段地址指向个位。加完之后个位带上正号区位，2 会印成字母 B。",
    source: `; 字段从个位往左，直到高位上的字标。
; ZA 先把目的地清零再装入，A 再把第二个字段加进去。
        ORG  250
START   ZA   N27,SUM
        A    N15,SUM
        MCW  SUM,230
        MCW  MSG,220
        W
        H
N27     DCW  27
N15     DCW  15
SUM     DCW  000
MSG     DCW  @SUM=@
        END  START
`,
  },
  {
    id: "loop",
    title: "数到 10",
    blurb: "C 比较两个字段，BE 看的是「等」灯。B 不带特征字符就是无条件转回去。",
    source: `; COUNT 和 TEN 都是三位，高位补零，比较才和数值一致。
        ORG  250
START   ZA   ZERO,COUNT
LOOP    A    ONE,COUNT
        C    COUNT,TEN
        BE   DONE
        B    LOOP
DONE    H
ZERO    DCW  000
ONE     DCW  001
TEN     DCW  010
COUNT   DCW  000
        END  START
`,
  },
  {
    id: "debt",
    title: "30 减 45",
    blurb: "负号写在个位的区位上。−5 打印出来是字母 N，不是减号加 5。",
    source: `; 实发 = 应发 − 扣款。30 减 45，得到 −15。
        ORG  250
START   ZA   GROSS,NET
        S    DED,NET
        MCW  NET,230
        MCW  TAG,224
        W
        H
GROSS   DCW  030
DED     DCW  045
NET     DCW  000
TAG     DCW  @NET=@
        END  START
`,
  },
  {
    id: "mul",
    title: "6 乘 7",
    blurb: "MUL 的积写在乘数个位上。正号区位让个位 2 印成 B，所以 42 看起来是 4B。",
    source: `        ORG  200
START   MUL  A,B
        H
A       DCW  6
        DCW  0
B       DCW  7
        END  START
`,
  },
];
