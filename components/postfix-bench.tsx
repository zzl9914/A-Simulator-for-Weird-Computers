"use client";

import {
  bootPostfix,
  DRUM_PAGES,
  PAGE_SLOTS,
  RAM_PAGES,
  ROM_PAGES,
  stackTrits,
  stepPostfix,
  runPostfix,
} from "@/lib/setun70";
import { BenchShell, CodingSheet, ErrorList, IdleBench, ProgramBar, TraceBox, Transport } from "./bench-layout";
import { sameWord, Trits } from "./trits";
import { useMachine } from "./use-machine";

export function PostfixBench() {
  const machine = useMachine("setun70", bootPostfix, stepPostfix, runPostfix);
  if (machine.phase !== "ready") {
    return <p className="text-sm text-muted-foreground">{machine.failure || "正在打开本地汇编…"}</p>;
  }
  if (!machine.state) {
    return <IdleBench sheetLabel="Сетунь-70 音节程序" machine={machine} />;
  }
  const { state } = machine;
  const focus = state.executed ?? state.pc;
  const lineNo = state.addrToLine[focus] ?? -1;

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
                  ? `已停机，共走了 ${state.steps} 个音节。`
                  : state.steps === 0
                    ? "已装入，还没开始走。"
                    : `已走 ${state.steps} 个音节。`
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
          <CodingSheet label="Сетунь-70 音节程序" value={machine.source} onChange={machine.edit} />
          <ErrorList errors={machine.errors} />
        </>
      }
      console={
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">栈 · 顶在上</p>
          {state.stack.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">栈是空的。地址音节会把数压到这里。</p>
          ) : (
            <ol className="mt-2 space-y-1">
              {[...state.stack].reverse().map((value, index) => (
                <li key={`${state.stack.length - index}-${value}`} className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-2 py-1">
                  <span className="text-xs text-muted-foreground">{index === 0 ? "顶" : " "}</span>
                  <span className="font-heading text-2xl tabular-nums">{value}</span>
                  <Trits trits={stackTrits(value)} />
                </li>
              ))}
            </ol>
          )}
          {state.output.length > 0 ? (
            <p className="mt-3 text-sm">
              印出：<span className="font-mono">{state.output.join("，")}</span>
            </p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            приписки {state.windows.map((page, index) => `${index}→${page}`).join("  ")}
            {state.lastDrum === null ? "" : ` · 磁鼓最近写入第 ${state.lastDrum} 页`}
          </p>
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
            <h3 className="font-heading text-lg">
              {RAM_PAGES} 页 ОЗУ · {ROM_PAGES} 页 ПЗУ · 磁鼓 {DRUM_PAGES} 页
            </h3>
            <p className="text-xs text-muted-foreground">每页 {PAGE_SLOTS} 个六位 трайт。程序和数据都写在页里，从入口槽顺序执行。</p>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[32rem] border-collapse font-mono text-xs">
              <tbody>
                {state.mem.map((word, addr) => {
                  const used = state.notes[addr] !== "" || !sameWord(word, state.image[addr]);
                  if (!used) return null;
                  const changed = !sameWord(word, state.image[addr]);
                  const hot = addr === focus;
                  return (
                    <tr key={addr} className={hot ? "bg-amber-100/80" : changed ? "bg-emerald-100/70" : undefined}>
                      <td className="w-16 px-1 py-0.5 text-muted-foreground">
                        {Math.floor(addr / PAGE_SLOTS)}:{addr % PAGE_SLOTS}
                      </td>
                      <td className="px-2 py-0.5">
                        <Trits trits={word} />
                      </td>
                      <td className="px-2 py-0.5">{state.notes[addr]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lineNo > 0 ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              第 {lineNo} 行 {state.lines[lineNo - 1]?.trim()}
            </p>
          ) : null}
        </div>
      }
    />
  );
}
