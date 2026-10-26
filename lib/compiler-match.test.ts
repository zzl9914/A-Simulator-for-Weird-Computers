import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleDecimal, DECIMAL_EXAMPLES } from "./decimal";
import { assembleEniac, ENIAC_EXAMPLES } from "./eniac";
import { assemble650, IBM650_EXAMPLES } from "./ibm650";
import { assembleSetun, SETUN_EXAMPLES } from "./setun";
import { assemblePostfix, POSTFIX_EXAMPLES } from "./setun70";

const bin = path.join(
  process.cwd(),
  process.platform === "win32" ? "compiler/build/radixcc.exe" : "compiler/build/radixcc",
);

function normalize(value: unknown): unknown {
  if (typeof value === "number") return Object.is(value, -0) ? 0 : value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

function cxx(machine: string, source: string) {
  const out = execFileSync(bin, ["assemble", machine], { input: source, encoding: "utf8" });
  return JSON.parse(out);
}

const cases = [
  ["setun", assembleSetun, SETUN_EXAMPLES],
  ["setun70", assemblePostfix, POSTFIX_EXAMPLES],
  ["eniac", assembleEniac, ENIAC_EXAMPLES],
  ["ibm650", assemble650, IBM650_EXAMPLES],
  ["ibm1401", assembleDecimal, DECIMAL_EXAMPLES],
] as const;

describe("C++ 汇编器和现有汇编器一致", () => {
  for (const [machine, assemble, examples] of cases) {
    for (const example of examples) {
      it(`${machine} ${example.id}`, () => {
        const ts = normalize(assemble(example.source));
        const cpp = normalize(cxx(machine, example.source));
        expect(cpp).toEqual(ts);
      });
    }
  }

  it("setun 未知标号", () => {
    const source = "        LDA MISSING\n        HLT\n";
    expect(normalize(cxx("setun", source))).toEqual(normalize(assembleSetun(source)));
  });

  it("setun 磁鼓区", () => {
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
    expect(normalize(cxx("setun", source))).toEqual(normalize(assembleSetun(source)));
  });

  it("1401 地址 1200", () => {
    const source = `
        ORG 200
        B   HERE
        H
        ORG 1200
HERE    H
`;
    expect(normalize(cxx("ibm1401", source))).toEqual(normalize(assembleDecimal(source)));
  });

  it("setun70 空栈", () => {
    const source = "        +\n        HALT\n";
    expect(normalize(cxx("setun70", source))).toEqual(normalize(assemblePostfix(source)));
  });
});
