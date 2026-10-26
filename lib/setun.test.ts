import { describe, expect, it } from "vitest";
import {
  addressToLinear,
  assembleSetun,
  bootSetun,
  highNine,
  linearToAddress,
  opcodeNovenary,
  runSetun,
  SETUN_WORDS,
  stepSetun,
  SETUN_EXAMPLES,
  ZONE_WORDS,
} from "./setun";
import { formatTrits, mustFromInt, toInt } from "./trit";

function runSource(source: string) {
  const assembled = assembleSetun(source);
  expect(assembled.ok).toBe(true);
  if (!assembled.ok) throw new Error("汇编失败");
  return { program: assembled.program, state: runSetun(bootSetun(assembled.program)) };
}

describe("Сетунь", () => {
  it("加法指令的九进制操作码是 33", () => {
    const { program } = runSource(SETUN_EXAMPLES[0].source);
    const add = program.mem[1];
    expect(opcodeNovenary(add)).toBe("33");
  });

  it("两数相加得到 5", () => {
    const { program, state } = runSource(SETUN_EXAMPLES[0].source);
    expect(state.halted).toBe(true);
    expect(state.error).toBeUndefined();
    expect(toInt(state.mem[program.labels.SUM])).toBe(5);
    expect(toInt(highNine(state.S))).toBe(5);
  });

  it("取负对调三进制位", () => {
    const { program, state } = runSource(SETUN_EXAMPLES[1].source);
    expect(toInt(state.mem[program.labels.NEG])).toBe(-5);
    expect(formatTrits(state.mem[program.labels.NEG])).toBe(formatTrits(mustFromInt(-5, 9)));
  });

  it("右移把 5 舍入成 2，再左移乘三得到 6", () => {
    const { program, state } = runSource(SETUN_EXAMPLES[2].source);
    expect(state.error).toBeUndefined();
    expect(toInt(state.mem[program.labels.ROUNDED])).toBe(2);
    expect(toInt(state.mem[program.labels.TIMES3])).toBe(6);
  });

  it("变址循环把 4、7、1 加总为 12", () => {
    const { program, state } = runSource(SETUN_EXAMPLES[3].source);
    expect(state.error).toBeUndefined();
    expect(toInt(state.mem[program.labels.SUM])).toBe(12);
    expect(toInt(state.F)).toBe(-1);
  });

  it("相等时 w 为 0", () => {
    const source = `
        LDA A
        SUB A
        HLT
A:      .t 5
`;
    const { state } = runSource(source);
    expect(toInt(highNine(state.S))).toBe(0);
    expect(state.w).toBe(0);
  });

  it("S 溢出时停机", () => {
    const source = `
        LDA A
        ADD A
        HLT
A:      .t 5000
`;
    const { state } = runSource(source);
    expect(state.error).toMatch(/溢出/);
  });

  it("单步不会一次跑完", () => {
    const assembled = assembleSetun(SETUN_EXAMPLES[0].source);
    if (!assembled.ok) throw new Error("汇编失败");
    const once = stepSetun(bootSetun(assembled.program));
    expect(once.steps).toBe(1);
    expect(once.halted).toBe(false);
    expect(toInt(highNine(once.S))).toBe(2);
  });

  it("162 个短字的地址可以来回编码", () => {
    for (let addr = 0; addr < SETUN_WORDS; addr += 1) {
      expect(addressToLinear(linearToAddress(addr))).toBe(addr);
    }
    expect(ZONE_WORDS).toBe(54);
  });

  it("把一区快存写上磁鼓再读回来", () => {
    const source = `
        LDA N
        STA KEEP
        WZONE 4:+1
        LDA ZERO
        STA KEEP
        RZONE 4:+1
        HLT
N:      .t 9
ZERO:   .t 0
KEEP:   .t 0
`;
    const { program, state } = runSource(source);
    expect(state.error).toBeUndefined();
    expect(toInt(state.mem[program.labels.KEEP])).toBe(9);
    expect(toInt(state.drum[4 * ZONE_WORDS + program.labels.KEEP])).toBe(9);
  });

  it("六乘七按部分积得到 42", () => {
    const { program, state } = runSource(SETUN_EXAMPLES[4].source);
    expect(state.error).toBeUndefined();
    expect(toInt(state.mem[program.labels.PROD])).toBe(42);
    expect(state.output).toEqual([42]);
  });

  it("两个最大九位数相乘，十八位放不下就停机", () => {
    const source = `
        LDA A
        MUL B
        HLT
A:      .t 9841
B:      .t 9841
`;
    const { state } = runSource(source);
    expect(state.error).toMatch(/十八位/);
  });

  it("规格化看最高两位，不靠浮点阈值", () => {
    const source = `
        LDA N
        NORM OUT
        HLT
N:      .t 1
OUT:    .t 0
`;
    const { program, state } = runSource(source);
    expect(state.error).toBeUndefined();
    expect(toInt(state.S.slice(0, 9))).toBe(7);
    expect(toInt(state.mem[program.labels.OUT])).toBe(2187);
  });

  it("未知标号报在对应行", () => {
    const assembled = assembleSetun("        LDA MISSING\n        HLT\n");
    expect(assembled.ok).toBe(false);
    if (assembled.ok) return;
    expect(assembled.errors[0]?.line).toBe(1);
    expect(assembled.errors[0]?.message).toMatch(/MISSING/);
  });
});
