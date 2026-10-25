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
import { BenchShell, CodingSheet, ErrorList, ProgramBar, TraceBox, Transport } from "./bench-layout";
import { InstructionManual } from "./manuals";
import { sameWord, Trits } from "./trits";
import { useMachine } from "./use-machine";

export function PostfixBench() {
  const machine = useMachine("setun70", bootPostfix, stepPostfix, runPostfix);
  if (machine.phase !== "ready" || !machine.state) {
    return <p className="text-sm text-muted-foreground">{machine.failure || "正在打开本地汇编…"}</p>;
  }
  const { state } = machine;
  const focus = state.executed ?? state.pc;
  const lineNo = state.addrToLine[focus] ?? -1;

  return (
    <BenchShell
      lecture={<PostfixLecture />}
      toolbar={
        <>
          <ProgramBar
            catalog={machine.catalog}
            source={machine.source}
            blurb={machine.blurb}
            path={machine.path}
            onPick={machine.openFile}
            onSave={machine.save}
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

function PostfixLecture() {
  return (
    <div className="space-y-3">
      <h2 className="font-heading text-xl">Сетунь-70，1970</h2>
      <p>
        这台不是前一台的小改款。它没有「操作码加地址」这种指令字。程序本身放在页里，一格是六个三进制位，叫做 трайт。前两位是 00 的，是运算音节；否则是地址音节。
      </p>
      <p>
        地址音节经三个 приписки 指出的页去取数。栈上的一格是三个 трайт，共十八位。<span className="font-mono">@0 A</span> 把那一格压进栈，<span className="font-mono">&0 A</span> 压进去的是槽地址，<span className="font-mono">!</span> 再把三个 трайт 写回去。运算符写在数的后面。
      </p>
      <p>
        一级内存是 27 页，每页 81 个 трайт：0–8 页是 ОЗУ，9–26 页是 ПЗУ。磁鼓 243 页，<span className="font-mono">STOREP</span> 和 <span className="font-mono">LOADP</span> 整页交换，<span className="font-mono">MAP</span> 改 приписки。
      </p>
      <InstructionManual machine="setun70" />
    </div>
  );
}
