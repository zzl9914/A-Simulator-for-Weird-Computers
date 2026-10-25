import { describe, expect, it } from "vitest";
import {
  accValue,
  assemble650,
  biquinary,
  boot650,
  decodeInstruction,
  IBM650_EXAMPLES,
  lowerWord,
  run650,
  wordValue,
} from "./ibm650";

function run(source: string) {
  const assembled = assemble650(source);
  expect(assembled.ok).toBe(true);
  if (!assembled.ok) throw new Error(assembled.errors.map((error) => error.message).join("；"));
  return { program: assembled.program, state: run650(boot650(assembled.program)) };
}

describe("IBM 650 二五进制", () => {
  it("每个数字位分成 0/5 和 0–4 两组，各组只亮一盏", () => {
    expect(biquinary(0)).toEqual({ bi: 0, quin: 0 });
    expect(biquinary(4)).toEqual({ bi: 0, quin: 4 });
    expect(biquinary(5)).toEqual({ bi: 5, quin: 0 });
    expect(biquinary(7)).toEqual({ bi: 5, quin: 2 });
    expect(biquinary(9)).toEqual({ bi: 5, quin: 4 });
  });

  it("第一条指令编成 65、数据地址、下一条地址", () => {
    const { program } = run(IBM650_EXAMPLES[0].source);
    const first = decodeInstruction(program.mem[program.entry]);
    expect(first.op).toBe(65);
    expect(first.data).toBe(program.labels.A);
    expect(first.next).toBe(program.entry + 1);
  });

  it("27 加 15 得到 42", () => {
    const { program, state } = run(IBM650_EXAMPLES[0].source);
    expect(state.error).toBeUndefined();
    expect(accValue(state.acc)).toBe(42);
    expect(wordValue(state.mem[program.labels.SUM])).toBe(42);
  });

  it("30 减 45 得到 −15", () => {
    const { program, state } = run(IBM650_EXAMPLES[1].source);
    expect(state.error).toBeUndefined();
    expect(wordValue(state.mem[program.labels.NET])).toBe(-15);
    expect(lowerWord(state.acc).sign).toBe(-1);
  });

  it("用负转移数到 10", () => {
    const { program, state } = run(IBM650_EXAMPLES[2].source);
    expect(state.error).toBeUndefined();
    expect(state.halted).toBe(true);
    expect(wordValue(state.mem[program.labels.COUNT])).toBe(10);
  });

  it("下半加一会进位到上半", () => {
    const source = `
        RAL NINES
        ALO ONE
        STOP
NINES   DEC +9999999999
ONE     DEC +1
`;
    const { state } = run(source);
    expect(state.error).toBeUndefined();
    expect(accValue(state.acc)).toBe(10_000_000_000);
  });
});
