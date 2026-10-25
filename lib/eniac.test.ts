import { describe, expect, it } from "vitest";
import { ACCUMULATORS, accValue, assembleEniac, bootEniac, decadeLamps, ENIAC_EXAMPLES, runEniac } from "./eniac";

function run(source: string) {
  const assembled = assembleEniac(source);
  expect(assembled.ok).toBe(true);
  if (!assembled.ok) throw new Error(assembled.errors.map((error) => error.message).join("；"));
  return runEniac(bootEniac(assembled.program));
}

describe("ENIAC 十进制编码", () => {
  it("每一位恰好点亮十个灯里的一个", () => {
    for (let digit = 0; digit <= 9; digit += 1) {
      const lamps = decadeLamps(digit);
      expect(lamps.filter(Boolean)).toEqual([true]);
      expect(lamps[digit]).toBe(true);
    }
  });

  it("27 加 15 得到 42，个位灯停在 2", () => {
    const state = run(ENIAC_EXAMPLES[0].source);
    expect(state.error).toBeUndefined();
    expect(accValue(state.acc[0])).toBe(42);
    expect(state.acc[0].digits[0]).toBe(2);
    expect(state.printer).toEqual(["+42"]);
  });

  it("有 20 台累加器", () => {
    const assembled = assembleEniac(ENIAC_EXAMPLES[0].source);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    expect(bootEniac(assembled.program).acc).toHaveLength(ACCUMULATORS);
    expect(ACCUMULATORS).toBe(20);
  });

  it("30 减 45 得到 −15", () => {
    const state = run(ENIAC_EXAMPLES[1].source);
    expect(accValue(state.acc[0])).toBe(-15);
    expect(state.acc[0].sign).toBe(-1);
    expect(state.acc[0].digits[0]).toBe(5);
  });
});
