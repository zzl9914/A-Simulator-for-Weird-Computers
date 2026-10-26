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

  it("27 乘 15，低十位是 405", () => {
    const state = run(ENIAC_EXAMPLES[2].source);
    expect(state.error).toBeUndefined();
    expect(accValue(state.acc[2])).toBe(405);
    expect(accValue(state.acc[3])).toBe(0);
  });

  it("45 除以 7，商 6 余 3", () => {
    const state = run(`
SET 1, +45
SET 2, +7
DIV 1, 2, 3
HLT
`);
    expect(state.error).toBeUndefined();
    expect(accValue(state.acc[2])).toBe(6);
    expect(accValue(state.acc[0])).toBe(3);
  });

  it("开方器对 144 逐对求根得到 12", () => {
    const state = run(`
SET 1, +144
SQRT 1, 2
HLT
`);
    expect(state.error).toBeUndefined();
    expect(accValue(state.acc[1])).toBe(12);
  });

  it("灯环加过 9999999999 后回到 0", () => {
    const state = run(`
SET 1, +9999999999
SET 2, +1
ADD 2, 1
HLT
`);
    expect(state.error).toBeUndefined();
    expect(accValue(state.acc[0])).toBe(0);
    expect(state.acc[0].digits[0]).toBe(0);
  });

  it("30 减 45 得到 −15", () => {
    const state = run(ENIAC_EXAMPLES[1].source);
    expect(accValue(state.acc[0])).toBe(-15);
    expect(state.acc[0].sign).toBe(-1);
    expect(state.acc[0].digits[0]).toBe(5);
  });
});
