export type Trit = -1 | 0 | 1;

export function formatTrits(trits: readonly Trit[]): string {
  return trits.map((t) => (t === 1 ? "+" : t === -1 ? "−" : "0")).join("");
}

export function toInt(trits: readonly Trit[]): number {
  return trits.reduce<number>((acc, trit) => acc * 3 + trit, 0);
}

export function tryFromInt(value: number, width: number): Trit[] | null {
  if (!Number.isInteger(value) || width < 1) return null;
  const digits: Trit[] = [];
  let n = value;
  while (n !== 0) {
    let rem = n % 3;
    n = Math.trunc(n / 3);
    if (rem < 0) {
      rem += 3;
      n -= 1;
    }
    if (rem === 2) {
      digits.push(-1);
      n += 1;
    } else {
      digits.push(rem as Trit);
    }
    if (digits.length > width) return null;
  }
  while (digits.length < width) digits.push(0);
  return digits.reverse();
}

export function mustFromInt(value: number, width: number): Trit[] {
  const trits = tryFromInt(value, width);
  if (!trits) {
    throw new Error(`值 ${value} 放不进 ${width} 位平衡三进制`);
  }
  return trits;
}

export function flipTrits(trits: readonly Trit[]): Trit[] {
  return trits.map((t) => (t === 0 ? 0 : -t) as Trit);
}

export function signOf(trits: readonly Trit[]): Trit {
  for (const trit of trits) {
    if (trit !== 0) return trit;
  }
  return 0;
}

export function addTrits(
  left: readonly Trit[],
  right: readonly Trit[],
): { sum: Trit[]; overflow: boolean } {
  if (left.length !== right.length) {
    throw new Error("位数不同，不能相加");
  }
  const sum: Trit[] = new Array(left.length);
  let carry = 0;
  for (let i = left.length - 1; i >= 0; i -= 1) {
    let total = left[i] + right[i] + carry;
    carry = 0;
    if (total > 1) {
      total -= 3;
      carry = 1;
    } else if (total < -1) {
      total += 3;
      carry = -1;
    }
    sum[i] = total as Trit;
  }
  return { sum, overflow: carry !== 0 };
}

export function shiftTrits(
  trits: readonly Trit[],
  count: number,
): { trits: Trit[]; overflow: boolean } {
  let current = trits.slice();
  let overflow = false;
  if (count > 0) {
    for (let step = 0; step < count; step += 1) {
      if (current[0] !== 0) overflow = true;
      current = [...current.slice(1), 0];
    }
  } else if (count < 0) {
    for (let step = 0; step < -count; step += 1) {
      current = [0, ...current.slice(0, -1)];
    }
  }
  return { trits: current, overflow };
}

/** 移出寄存器宽度时不再逐位循环。右移把低位丢掉，结果就是舍入到最近。 */
export function shiftBalanced(
  trits: readonly Trit[],
  count: number,
): { trits: Trit[]; overflow: boolean } {
  if (!Number.isInteger(count)) throw new Error("移位数不是整数");
  if (count === 0) return { trits: trits.slice(), overflow: false };
  if (Math.abs(count) >= trits.length) {
    const nonzero = trits.some((trit) => trit !== 0);
    return { trits: zeros(trits.length), overflow: count > 0 && nonzero };
  }
  return shiftTrits(trits, count);
}

function addGrow(left: readonly Trit[], right: readonly Trit[]): Trit[] {
  const width = Math.max(left.length, right.length, 1);
  const a = [...zeros(width - left.length), ...left];
  const b = [...zeros(width - right.length), ...right];
  const sum: Trit[] = new Array(width);
  let carry: Trit = 0;
  for (let i = width - 1; i >= 0; i -= 1) {
    let total = a[i] + b[i] + carry;
    carry = 0;
    if (total > 1) {
      total -= 3;
      carry = 1;
    } else if (total < -1) {
      total += 3;
      carry = -1;
    }
    sum[i] = total as Trit;
  }
  return carry === 0 ? sum : [carry, ...sum];
}

/** 按位做部分积。乘积放不进 width 位时 overflow。 */
export function mulTrits(
  left: readonly Trit[],
  right: readonly Trit[],
  width: number,
): { product: Trit[]; overflow: boolean } {
  let acc: Trit[] = [];
  for (let i = 0; i < right.length; i += 1) {
    const trit = right[right.length - 1 - i];
    if (trit === 0) continue;
    const term = [...(trit === 1 ? left : flipTrits(left)), ...zeros(i)];
    acc = addGrow(acc, term);
  }
  let trimmed = acc;
  while (trimmed.length > width && trimmed[0] === 0) trimmed = trimmed.slice(1);
  if (trimmed.length > width) return { product: zeros(width), overflow: true };
  return { product: [...zeros(width - trimmed.length), ...trimmed], overflow: false };
}

const TRIT_MINUS = new Set(["-", "−", "–", "T", "t"]);

/** 从左到右、高位在前。含有非三进制字符时返回 null。 */
export function parseTritLiteral(token: string): Trit[] | null {
  if (token.length === 0) return null;
  const trits: Trit[] = [];
  for (const char of token) {
    if (char === "+") trits.push(1);
    else if (TRIT_MINUS.has(char)) trits.push(-1);
    else if (char === "0") trits.push(0);
    else return null;
  }
  return trits;
}

export function parseBalanced(
  token: string,
  width: number,
): { ok: true; trits: Trit[] } | { ok: false; reason: "format" | "range" } {
  const literal = parseTritLiteral(token);
  if (literal) {
    if (literal.length > width) return { ok: false, reason: "range" };
    const trits = tryFromInt(toInt(literal), width);
    return trits ? { ok: true, trits } : { ok: false, reason: "range" };
  }
  if (/^[+-]?\d+$/.test(token)) {
    const trits = tryFromInt(Number(token), width);
    return trits ? { ok: true, trits } : { ok: false, reason: "range" };
  }
  return { ok: false, reason: "format" };
}

export function zeros(width: number): Trit[] {
  return Array.from({ length: width }, () => 0 as Trit);
}
