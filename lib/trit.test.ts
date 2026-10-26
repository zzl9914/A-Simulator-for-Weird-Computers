import { describe, expect, it } from "vitest";
import { addTrits, flipTrits, formatTrits, mulTrits, mustFromInt, shiftBalanced, shiftTrits, toInt, tryFromInt } from "./trit";

describe("平衡三进制", () => {
  it("在正负范围内来回转换", () => {
    for (let value = -200; value <= 200; value += 1) {
      const trits = mustFromInt(value, 9);
      expect(toInt(trits)).toBe(value);
    }
  });

  it("五写成 +−−", () => {
    expect(formatTrits(mustFromInt(5, 9))).toBe("000000+−−");
  });

  it("取负就是对调正负数字", () => {
    const five = mustFromInt(5, 9);
    expect(toInt(flipTrits(five))).toBe(-5);
    expect(formatTrits(flipTrits(five))).toBe("000000−++");
  });

  it("丢掉末位等于舍入到最近", () => {
    for (let value = -80; value <= 80; value += 1) {
      const shifted = shiftTrits(mustFromInt(value, 9), -1).trits;
      const rounded = Math.round(value / 3);
      expect(toInt(shifted)).toBe(rounded === 0 ? 0 : rounded);
    }
  });

  it("左移是乘三", () => {
    for (const value of [-20, -1, 0, 2, 5, 40]) {
      const shifted = shiftTrits(mustFromInt(value, 9), 1);
      expect(shifted.overflow).toBe(false);
      expect(toInt(shifted.trits)).toBe(value * 3);
    }
  });

  it("加法与进位", () => {
    for (let left = -40; left <= 40; left += 1) {
      for (let right = -40; right <= 40; right += 1) {
        const sum = addTrits(mustFromInt(left, 9), mustFromInt(right, 9));
        expect(sum.overflow).toBe(false);
        expect(toInt(sum.sum)).toBe(left + right);
      }
    }
  });

  it("乘法是部分积，大数也不会先变成浮点", () => {
    for (let left = -40; left <= 40; left += 1) {
      for (let right = -30; right <= 30; right += 1) {
        const product = mulTrits(mustFromInt(left, 9), mustFromInt(right, 9), 18);
        expect(product.overflow).toBe(false);
        const expected = left * right;
        expect(toInt(product.product)).toBe(expected === 0 ? 0 : expected);
      }
    }
    const big = mustFromInt(9841, 9);
    const full = mulTrits(big, big, 18);
    expect(full.overflow).toBe(false);
    expect(toInt(full.product)).toBe(9841 * 9841);
    const max = mustFromInt((3 ** 18 - 1) / 2, 18);
    expect(mulTrits(max, mustFromInt(2, 4), 18).overflow).toBe(true);
  });

  it("右移舍入到最近，负的 −2 变成 −1", () => {
    expect(toInt(shiftBalanced(mustFromInt(-2, 9), -1).trits)).toBe(-1);
    expect(toInt(shiftBalanced(mustFromInt(5, 9), -1).trits)).toBe(2);
    expect(shiftBalanced(mustFromInt(1, 9), 40).overflow).toBe(true);
  });

  it("超出位数时失败", () => {
    expect(tryFromInt(9842, 9)).toBeNull();
    expect(tryFromInt(121, 5)).not.toBeNull();
    expect(tryFromInt(122, 5)).toBeNull();
  });
});
