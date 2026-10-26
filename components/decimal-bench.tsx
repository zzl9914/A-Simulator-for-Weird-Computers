"use client";

import {
  bcdRows,
  bootDecimal,
  DECIMAL_CELLS,
  glyphOf,
  PRINT_HI,
  PRINT_LO,
  runDecimal,
  stepDecimal,
  watchFields,
} from "@/lib/decimal";
import { BenchShell, CodingSheet, ErrorList, IdleBench, ProgramBar, TraceBox, Transport } from "./bench-layout";
import { useMachine } from "./use-machine";

export function DecimalBench() {
  const machine = useMachine("ibm1401", bootDecimal, stepDecimal, runDecimal);
  if (machine.phase !== "ready") {
    return <p className="text-sm text-muted-foreground">{machine.failure || "正在打开本地汇编…"}</p>;
  }
  if (!machine.state) {
    return <IdleBench sheetLabel="1401 Autocoder 程序" short machine={machine} />;
  }
  const { state } = machine;
  const watches = watchFields(state.mem, state.labels).filter((field) => field.kind !== "code");
  const focus = state.executedAddr ?? state.pc;
  const lineNo = state.addrToLine[focus] ?? -1;

  let lo = PRINT_LO;
  let hi = PRINT_HI;
  state.mem.forEach((cell, addr) => {
    if (cell.wm || cell.digit !== null || cell.literal) {
      lo = Math.min(lo, addr);
      hi = Math.max(hi, addr);
    }
  });
  lo -= lo % 20;
  hi = Math.min(DECIMAL_CELLS - 1, Math.max(hi, lo + 19));

  return (
    <BenchShell
      toolbar={
        <>
          <ProgramBar
            catalog={machine.catalog}
            source={machine.source}
            blurb={machine.blurb}
            path={machine.path}
            onPick={machine.openFile}
            onSave={machine.save}
            onCustomize={machine.customize}
          />
          <Transport
            dirty={machine.dirty}
            blocked={machine.blocked}
            status={
              state.error
                ? "机器停下了。"
                : state.halted
                  ? `已停机，共走了 ${state.steps} 步。`
                  : state.steps === 0
                    ? "已装入，还没开始走。"
                    : `已走 ${state.steps} 步。下一条在 ${pad(state.pc)}。`
            }
            onAssemble={machine.assemble}
            onStep={machine.step}
            onRun={machine.run}
            onReset={machine.reset}
          />
        </>
      }
      editor={
        <>
          <CodingSheet short label="1401 Autocoder 程序" value={machine.source} onChange={machine.edit} />
          <ErrorList errors={machine.errors} />
        </>
      }
      console={
        <div>
          <div className="flex justify-between gap-2">
            <Lamp on={state.indicator === "high"} label="高" />
            <Lamp on={state.indicator === "equal"} label="等" />
            <Lamp on={state.indicator === "low"} label="低" />
            <Lamp on={state.overflow} label="溢" hot />
          </div>
          <ul className="mt-4 space-y-2">
            {watches.map((field) => (
              <li key={field.name} className="rounded-md bg-muted px-2 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {field.name} · {pad(field.addr)}
                  </span>
                  {field.kind === "number" ? (
                    <span className="font-heading text-2xl tabular-nums">{field.value}</span>
                  ) : (
                    <span className="font-mono">{field.text}</span>
                  )}
                </div>
                {field.kind === "number" ? (
                  <div className="mt-1 space-y-1">
                    <p className="font-mono text-xs text-accent">内存字形 {field.glyphs}</p>
                    {bcdRows(state.mem, field.addr).map((row, index) => (
                      <div key={`${field.name}-${index}`} className="flex items-center gap-1">
                        <span className="w-4 font-mono text-xs">{row.glyph}</span>
                        {row.bits.map((bit) => (
                          <span key={bit.name} className={bit.on ? "lamp lamp-bi" : "lamp"}>
                            {bit.name}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <p className="text-xs tracking-widest text-muted-foreground">1403 印出的一行</p>
            <div className="mt-1 min-h-16 overflow-x-auto border bg-[#fbf8f1] px-2 py-2 font-mono text-sm whitespace-pre">
              {state.printer.length === 0
                ? "纸还是空的。执行到 W，才会把 201–332 送出来。"
                : state.printer.map((line, index) => (
                    <div key={`${index}-${line}`}>{line}</div>
                  ))}
            </div>
          </div>
          {lineNo > 0 ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              第 {lineNo} 行 {state.lines[lineNo - 1]?.trim()}
            </p>
          ) : null}
          <TraceBox trace={state.trace} log={state.log} />
        </div>
      }
      memory={
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-lg">字符内存</h3>
            <p className="text-xs text-muted-foreground">红线是字标。蓝色是带了正负号区位的个位，打印时会变成字母。</p>
          </div>
          <div className="max-h-80 space-y-1 overflow-auto">
            {rows(lo, hi).map((start) => (
              <div key={start} className="flex gap-1">
                <span className="w-10 shrink-0 pt-3 font-mono text-[11px] text-muted-foreground">{pad(start)}</span>
                <div className="flex gap-px">
                  {Array.from({ length: 20 }, (_, offset) => {
                    const addr = start + offset;
                    if (addr >= DECIMAL_CELLS) return null;
                    const cell = state.mem[addr];
                    const glyph = glyphOf(cell);
                    const zoned = cell.zone === "ab" || cell.zone === "b";
                    const hot = addr === focus;
                    const touched = state.touched.includes(addr);
                    const printing = addr >= PRINT_LO && addr <= PRINT_HI;
                    return (
                      <span
                        key={addr}
                        title={`${pad(addr)}${cell.wm ? " · 字标" : ""}${zoned ? " · 带区位" : ""}`}
                        className={`flex h-8 w-5 items-end justify-center font-mono text-xs ${cell.wm ? "cell-wm" : ""} ${
                          hot ? "bg-amber-200/90" : touched ? "bg-emerald-100" : printing ? "bg-sky-50" : ""
                        } ${zoned ? "text-accent" : ""}`}
                      >
                        {glyph === " " ? "·" : glyph}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}

function Lamp({ on, label, hot = false }: { on: boolean; label: string; hot?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`size-3 rounded-full border ${on ? (hot ? "border-destructive bg-destructive" : "border-emerald-800 bg-emerald-600") : "border-current opacity-30"}`}
      />
      <span className="text-[11px] tracking-widest">{label}</span>
    </div>
  );
}

function pad(value: number): string {
  return value.toString().padStart(4, "0");
}

function rows(lo: number, hi: number): number[] {
  const starts: number[] = [];
  for (let addr = lo; addr <= hi; addr += 20) starts.push(addr);
  return starts;
}
