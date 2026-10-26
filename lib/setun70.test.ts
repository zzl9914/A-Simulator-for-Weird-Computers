import { describe, expect, it } from "vitest";
import { assemblePostfix, bootPostfix, POSTFIX_EXAMPLES, runPostfix, STACK_TRITS } from "./setun70";
import { formatTrits, mustFromInt, toInt, type Trit } from "./trit";

function runSource(source: string) {
  const assembled = assemblePostfix(source);
  expect(assembled.ok).toBe(true);
  if (!assembled.ok) throw new Error(assembled.errors.map((error) => error.message).join("；"));
  return { program: assembled.program, state: runPostfix(bootPostfix(assembled.program)) };
}

function valueAt(mem: readonly (readonly Trit[])[], addr: number) {
  return toInt([...mem[addr], ...mem[addr + 1], ...mem[addr + 2]]);
}

describe("Сетунь-70", () => {
  it("算出 (2+3)×(4+5) = 45", () => {
    const { state } = runSource(POSTFIX_EXAMPLES[0].source);
    expect(state.error).toBeUndefined();
    expect(state.halted).toBe(true);
    expect(state.output).toEqual([45]);
    expect(state.stack).toEqual([45]);
  });

  it("取负后栈顶是 −5，十八位里的 + 和 − 对调", () => {
    const { state } = runSource(POSTFIX_EXAMPLES[1].source);
    expect(state.output).toEqual([-5]);
    expect(formatTrits(mustFromInt(state.stack[0], STACK_TRITS))).toBe(formatTrits(mustFromInt(-5, STACK_TRITS)));
  });

  it("把和写成 SUM 的三个 трайт", () => {
    const { program, state } = runSource(POSTFIX_EXAMPLES[2].source);
    expect(state.error).toBeUndefined();
    expect(valueAt(state.mem, program.labels.SUM)).toBe(5);
    expect(state.stack).toEqual([]);
  });

  it("整页从第 0 页经磁鼓抄到第 2 页", () => {
    const { program, state } = runSource(POSTFIX_EXAMPLES[3].source);
    expect(state.error).toBeUndefined();
    expect(state.output).toEqual([7]);
    expect(valueAt(state.mem, 2 * 81 + (program.labels.A % 81))).toBe(7);
    expect(state.windows[0]).toBe(2);
    expect(state.lastDrum).toBe(1);
  });

  it("第 1 个窗口停在 WIN 指定的页，不会每步拨回程序页", () => {
    const source = `
        WIN 1 2
        PAGE 0
        @1 A
        .
        HALT
        PAGE 2
A:      WORD 7
`;
    const { state } = runSource(source);
    expect(state.error).toBeUndefined();
    expect(state.output).toEqual([7]);
    expect(state.windows[1]).toBe(2);
  });

  it("右移 −2 舍入成 −1，而不是向零截成 0", () => {
    const source = `
        @0 N
        -1
        SHF
        .
        HALT
N:      WORD -2
`;
    const { state } = runSource(source);
    expect(state.error).toBeUndefined();
    expect(state.output).toEqual([-1]);
  });

  it("十八位乘积超出时停机", () => {
    const source = `
        @0 A
        @0 A
        *
        HALT
A:      WORD 193710244
`;
    const { state } = runSource(source);
    expect(state.error).toMatch(/十八位/);
  });

  it("栈空时做加法会停在错误上", () => {
    const assembled = assemblePostfix("        +\n        HALT\n");
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    const state = runPostfix(bootPostfix(assembled.program));
    expect(state.error).toMatch(/栈是空的/);
  });
});
