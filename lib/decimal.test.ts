import { describe, expect, it } from "vitest";
import {
  assembleDecimal,
  bootDecimal,
  DECIMAL_EXAMPLES,
  glyphOf,
  runDecimal,
  stepDecimal,
  watchFields,
} from "./decimal";

function runSource(source: string) {
  const assembled = assembleDecimal(source);
  expect(assembled.ok).toBe(true);
  if (!assembled.ok) {
    throw new Error(assembled.errors.map((error) => `${error.line}: ${error.message}`).join("；"));
  }
  return { program: assembled.program, state: runDecimal(bootDecimal(assembled.program)) };
}

function valueOf(source: string, label: string) {
  const { program, state } = runSource(source);
  const watch = watchFields(state.mem, program.labels).find((field) => field.name === label);
  return { program, state, watch };
}

describe("十进制教学机", () => {
  it("27 加 15 得到 42，个位印成 B", () => {
    const { state, watch } = valueOf(DECIMAL_EXAMPLES[0].source, "SUM");
    expect(state.error).toBeUndefined();
    expect(watch?.value).toBe(42);
    expect(watch?.glyphs).toBe("04B");
    expect(state.printer[0]).toContain("SUM=");
    expect(state.printer[0]).toContain("04B");
  });

  it("循环加到 10 后停机，个位正零印成 &", () => {
    const { state, watch } = valueOf(DECIMAL_EXAMPLES[1].source, "COUNT");
    expect(state.error).toBeUndefined();
    expect(state.halted).toBe(true);
    expect(watch?.value).toBe(10);
    expect(watch?.glyphs).toBe("01&");
  });

  it("30 减 45 得到 −15，个位印成 N", () => {
    const { state, watch } = valueOf(DECIMAL_EXAMPLES[2].source, "NET");
    expect(state.error).toBeUndefined();
    expect(watch?.value).toBe(-15);
    expect(watch?.glyphs).toBe("01N");
    expect(state.printer[0]).toContain("01N");
    expect(state.printer[0]).toContain("NET=");
  });

  it("同号负数相加", () => {
    const source = `
        ORG 300
        ZA A,B
        A  C,B
        H
A       DCW -20
C       DCW -15
B       DCW 000
`;
    const { watch } = valueOf(source, "B");
    expect(watch?.value).toBe(-35);
    expect(watch?.glyphs.endsWith("N")).toBe(true);
  });

  it("结果超出字段时溢出，只留下低位", () => {
    const source = `
        ORG 300
        ZA A,B
        A  C,B
        H
A       DCW 50
C       DCW 60
B       DCW 00
`;
    const { state, watch } = valueOf(source, "B");
    expect(state.overflow).toBe(true);
    expect(watch?.value).toBe(10);
  });

  it("B 字段没有字标时停在错误上", () => {
    const source = `
        ORG  300
        ZA   A,B
        H
        ORG  320
A       DCW  12
        ORG  350
B       DC   12
`;
    const { state } = runSource(source);
    expect(state.error).toMatch(/字标/);
  });

  it("相等转移的特征字符是 S", () => {
    const assembled = assembleDecimal(DECIMAL_EXAMPLES[1].source);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    const opcode = assembled.program.labels.LOOP.addr + 14;
    expect(glyphOf(assembled.program.mem[opcode])).toBe("B");
    expect(assembled.program.mem[opcode].wm).toBe(true);
    expect(glyphOf(assembled.program.mem[opcode + 4])).toBe("S");
  });

  it("1200 的百位写成带 A 区位的 S", () => {
    const source = `
        ORG 200
        B   HERE
        H
        ORG 1200
HERE    H
`;
    const assembled = assembleDecimal(source);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    expect(glyphOf(assembled.program.mem[201])).toBe("S");
    expect(assembled.program.mem[201].zone).toBe("a");
    expect(assembled.program.mem[201].digit).toBe(2);
    expect(assembled.program.labels.HERE.addr).toBe(1200);
  });

  it("6 乘 7 逐位得到 42，个位印成 B", () => {
    const { state, watch } = valueOf(DECIMAL_EXAMPLES[3].source, "B");
    expect(state.error).toBeUndefined();
    expect(watch?.value).toBe(42);
    expect(watch?.glyphs).toBe("4B");
  });

  it("45 除以 7，商 6 余 3", () => {
    const source = `
        ORG 300
        DIV A,B
        H
        DCW 0
        ORG 320
A       DCW 7
B       DCW 045
`;
    const { program, state } = runSource(source);
    expect(state.error).toBeUndefined();
    const b = program.labels.B.addr;
    expect(glyphOf(state.mem[b])).toBe("C");
    expect(glyphOf(state.mem[b - 3])).toBe("F");
    expect(state.mem[b - 5].wm).toBe(true);
  });

  it("单步停在第一条指令之后", () => {
    const assembled = assembleDecimal(DECIMAL_EXAMPLES[0].source);
    if (!assembled.ok) throw new Error("汇编失败");
    const once = stepDecimal(bootDecimal(assembled.program));
    expect(once.steps).toBe(1);
    expect(once.halted).toBe(false);
    const sum = watchFields(once.mem, assembled.program.labels).find((field) => field.name === "SUM");
    expect(sum?.value).toBe(27);
  });
});
