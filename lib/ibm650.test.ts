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

  it("上半乘 15 得到 405", () => {
    const { program, state } = run(IBM650_EXAMPLES[3].source);
    expect(state.error).toBeUndefined();
    expect(wordValue(state.mem[program.labels.PROD])).toBe(405);
  });

  it("45 除以 7，商在下半，余数在上半", () => {
    const source = `
        RAL N
        DIV D
        STL Q
        STU R
        STOP
N       DEC +45
D       DEC +7
Q       DEC +0
R       DEC +0
`;
    const { program, state } = run(source);
    expect(state.error).toBeUndefined();
    expect(wordValue(state.mem[program.labels.Q])).toBe(6);
    expect(wordValue(state.mem[program.labels.R])).toBe(3);
  });

  it("负数除法的余数跟着被除数", () => {
    const source = `
        RAL N
        DIV D
        STL Q
        STU R
        STOP
N       DEC -45
D       DEC +7
Q       DEC +0
R       DEC +0
`;
    const { program, state } = run(source);
    expect(state.error).toBeUndefined();
    expect(wordValue(state.mem[program.labels.Q])).toBe(-6);
    expect(wordValue(state.mem[program.labels.R])).toBe(-3);
  });

  it("余数符号跟被除数，不跟商", () => {
    const source = `
        RAL N
        DIV D
        STL Q
        STU R
        STOP
N       DEC -15
D       DEC -7
Q       DEC +0
R       DEC +0
`;
    const { program, state } = run(source);
    expect(state.error).toBeUndefined();
    expect(wordValue(state.mem[program.labels.Q])).toBe(2);
    expect(state.mem[program.labels.Q].sign).toBe(1);
    expect(wordValue(state.mem[program.labels.R])).toBe(-1);
    expect(state.mem[program.labels.R].sign).toBe(-1);
  });

  it("商的低十位是零但溢出时，不当成正零", () => {
    const source = `
        RAU NEG
        DIV ONE
        STL Q
        STOP
NEG     DEC -1
ONE     DEC +1
Q       DEC +0
`;
    const { program, state } = run(source);
    expect(state.error).toBeUndefined();
    expect(state.overflow).toBe(true);
    expect(state.mem[program.labels.Q].digits.every((digit) => digit === 0)).toBe(true);
    expect(state.mem[program.labels.Q].sign).toBe(-1);
  });

  it("BRD 按原机位号，而且只认 8", () => {
    const goes = (source: string, label: "YES" | "NO") => {
      const result = run(source);
      expect(result.state.error).toBeUndefined();
      expect(result.state.pc).toBe(result.program.labels[label]);
      return result;
    };
    const first = goes(
      `
        LDD N
        BRD10 YES, NO
NO      STOP
YES     STOP
N       DEC +8000000000
`,
      "YES",
    );
    expect(decodeInstruction(first.program.mem[first.program.entry + 1]).op).toBe(90);
    goes(
      `
        LDD N
        BRD1 YES, NO
NO      STOP
YES     STOP
N       DEC +8
`,
      "YES",
    );
    const brd1 = assemble650(`
        LDD N
        BRD1 YES, NO
YES     STOP
NO      STOP
N       DEC +8
`);
    expect(brd1.ok).toBe(true);
    if (brd1.ok) expect(decodeInstruction(brd1.program.mem[brd1.program.entry + 1]).op).toBe(91);
    goes(
      `
        LDD N
        BRD1 YES, NO
NO      STOP
YES     STOP
N       DEC +9
`,
      "NO",
    );
    goes(
      `
        LDD N
        BRD9 YES, NO
NO      STOP
YES     STOP
N       DEC +0800000000
`,
      "YES",
    );
    const brd9 = assemble650(`
        BRD9 YES, NO
YES     STOP
NO      STOP
`);
    expect(brd9.ok).toBe(true);
    if (brd9.ok) expect(decodeInstruction(brd9.program.mem[brd9.program.entry]).op).toBe(99);
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
