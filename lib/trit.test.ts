import { describe, expect, it } from "vitest";
import { addTrits, flipTrits, formatTrits, mustFromInt, shiftTrits, toInt, tryFromInt } from "./trit";

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

  it("超出位数时失败", () => {
    expect(tryFromInt(9842, 9)).toBeNull();
    expect(tryFromInt(121, 5)).not.toBeNull();
    expect(tryFromInt(122, 5)).toBeNull();
  });
});
