"use client";

import {
  bootSetun,
  DRUM_ZONES,
  highNine,
  opcodeNovenary,
  placeOf,
  readShort,
  runSetun,
  stepSetun,
  ZONE_WORDS,
} from "@/lib/setun";
import { toInt } from "@/lib/trit";
import { BenchShell, CodingSheet, ErrorList, IdleBench, ProgramBar, TraceBox, Transport } from "./bench-layout";
import { sameWord, Trits } from "./trits";
import { useMachine } from "./use-machine";

export function SetunBench() {
  const machine = useMachine("setun", bootSetun, stepSetun, runSetun);
  if (machine.phase !== "ready") {
    return <p className="text-sm text-muted-foreground">{machine.failure || "正在打开本地汇编…"}</p>;
  }
  if (!machine.state) {
    return <IdleBench sheetLabel="Сетунь 程序" machine={machine} />;
  }
  const { state } = machine;
  const focus = state.executedAddr ?? state.C;
  const lineNo = state.addrToLine[focus] ?? -1;
  const lineText = lineNo > 0 ? state.lines[lineNo - 1] : "";

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
                    : `已走 ${state.steps} 步。下一条在地址 ${state.C}。`
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
          <CodingSheet label="Сетунь 程序" value={machine.source} onChange={machine.edit} />
          <ErrorList errors={machine.errors} />
        </>
      }
      console={
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">寄存器 S · 高九位</p>
          <p className="font-heading text-4xl tabular-nums">{toInt(highNine(state.S))}</p>
          <p className="mt-1">
            <Trits trits={highNine(state.S)} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            低九位 <Trits trits={state.S.slice(9)} />
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted px-2 py-2">
              <dt className="text-[11px] text-muted-foreground">符号 w</dt>
              <dd className={`font-mono text-2xl ${state.w === 1 ? "trit-pos" : state.w === -1 ? "trit-neg" : ""}`}>
                {state.w === 1 ? "+" : state.w === -1 ? "−" : "0"}
              </dd>
            </div>
            <div className="rounded-md bg-muted px-2 py-2">
              <dt className="text-[11px] text-muted-foreground">变址 F</dt>
              <dd className="font-mono text-2xl tabular-nums">{toInt(state.F)}</dd>
            </div>
            <div className="rounded-md bg-muted px-2 py-2">
              <dt className="text-[11px] text-muted-foreground">指令 C</dt>
              <dd className="font-mono text-2xl tabular-nums">{state.C}</dd>
            </div>
          </dl>
          {lineText ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              第 {lineNo} 行 {lineText.trim()}
            </p>
          ) : null}
          <TraceBox trace={state.trace} log={state.log} />
        </div>
      }
      memory={
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-lg">162 个九位短字</h3>
            <p className="text-xs text-muted-foreground">三区 Ф+1、Ф0、Ф−1，每区 27 个长格、54 个短字。地址五位是区、格、高低半。</p>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[36rem] border-collapse font-mono text-xs">
              <tbody>
                {state.mem.map((word, addr) => {
                  const changed = !sameWord(word, state.image[addr]);
                  const note = changed ? `已改写 · 整数 ${toInt(word)}` : state.notes[addr];
                  const showCode = !changed && /^(LDA|ADD|SUB|STA|BR|BM|BZ|BP|HLT|SHF|TMUL|LDR|LDF|STF|ADF|STC|RZONE|WZONE)\b/.test(note);
                  const hot = addr === focus;
                  const touched = state.touched.includes(addr);
                  const place = placeOf(addr);
                  return (
                    <tr key={addr} className={hot ? "bg-amber-100/80" : touched ? "bg-emerald-100/70" : undefined}>
                      <td className="w-24 px-1 py-0.5 text-muted-foreground">
                        {place.zone} {place.cell.toString().padStart(2, "0")}
                        {place.half}
                      </td>
                      <td className="px-1 py-0.5">
                        <Trits trits={word} gaps={[5, 8]} />
                      </td>
                      <td className="px-2 py-0.5 text-muted-foreground">{showCode ? opcodeNovenary(word) : ""}</td>
                      <td className="px-2 py-0.5">{note}</td>
                      <td className="px-2 py-0.5 text-muted-foreground">短字 {readShort(word)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
            {Array.from({ length: DRUM_ZONES }, (_, zone) => {
              const base = zone * ZONE_WORDS;
              const used = state.drum.slice(base, base + ZONE_WORDS).some((word) => word.some((trit) => trit !== 0));
              return (
                <p key={zone} className="font-mono text-[11px] text-muted-foreground">
                  鼓 {zone.toString().padStart(2, "0")} {used ? "有字" : "空"}
                </p>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            固定小数点在左起第二位之后。高九位 {toInt(highNine(state.S))} ÷ 3⁷ ={" "}
            {(toInt(highNine(state.S)) / 2187).toFixed(4)}。例子仍按整数读。磁鼓 {DRUM_ZONES} 区，每区 {ZONE_WORDS} 字。
          </p>
        </div>
      }
    />
  );
}
