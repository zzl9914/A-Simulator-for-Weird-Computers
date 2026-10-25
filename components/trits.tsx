import type { Trit } from "@/lib/trit";

export function Trits({ trits, gaps = [] }: { trits: readonly Trit[]; gaps?: number[] }) {
  const marks = new Set(gaps);
  return (
    <span className="font-mono tracking-tight">
      {trits.map((trit, index) => (
        <span key={`${index}-${trit}`} className={trit === 1 ? "trit-pos" : trit === -1 ? "trit-neg" : "trit-zero"}>
          {marks.has(index) ? " " : ""}
          {trit === 1 ? "+" : trit === -1 ? "−" : "0"}
        </span>
      ))}
    </span>
  );
}

export function sameWord(left: readonly Trit[], right: readonly Trit[]): boolean {
  return left.length === right.length && left.every((trit, index) => trit === right[index]);
}
