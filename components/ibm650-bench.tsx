"use client";

import {
  accValue,
  biquinary,
  boot650,
  decodeInstruction,
  formatWord,
  lowerWord,
  run650,
  sameWord,
  step650,
  wordValue,
} from "@/lib/ibm650";
import { BenchShell, CodingSheet, ErrorList, ProgramBar, TraceBox, Transport } from "./bench-layout";
import { InstructionManual } from "./manuals";
import { useMachine } from "./use-machine";

export function Ibm650Bench() {
  const machine = useMachine("ibm650", boot650, step650, run650);
  if (machine.phase !== "ready" || !machine.state) {
    return <p className="text-sm text-muted-foreground">{machine.failure || "正在打开本地汇编…"}</p>;
  }
  const { state } = machine;
  const focus = state.executed ?? state.pc;
  const lineNo = state.addrToLine[focus] ?? -1;
  const lower = lowerWord(state.acc);

  return (
    <BenchShell
      stacked
      lecture={<IbmLecture />}
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
                  ? `已停机，共 ${state.steps} 步。`
                  : state.steps === 0
                    ? "已装上磁鼓，还没开始走。"
                    : `已走 ${state.steps} 步。下一条在 ${state.pc}。`
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
          <CodingSheet short label="IBM 650 程序" value={machine.source} onChange={machine.edit} />
          <ErrorList errors={machine.errors} />
        </>
      }
      console={
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">累加器下半 · 二五进制</p>
          <p className="font-heading text-3xl tabular-nums">{accValue(state.acc)}</p>
          <BiQuinaryWord word={lower} />
          <p className="mt-2 text-xs text-muted-foreground">分配器 {formatWord(state.distributor)} · 数值 {wordValue(state.distributor)}</p>
          {lineNo > 0 ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">第 {lineNo} 行 {state.lines[lineNo - 1]?.trim()}</p>
          ) : null}
          <TraceBox trace={state.trace} log={state.log} />
        </div>
      }
      memory={
        <div>
          <h3 className="mb-1 font-heading text-base">磁鼓上的十位字</h3>
          <p className="mb-2 text-xs text-muted-foreground">蓝灯是 0 或 5，绿灯是 0 到 4。两组都恰好亮一盏。</p>
          <div className="max-h-72 space-y-1 overflow-auto">
            {state.mem.map((word, addr) => {
              const used = state.notes[addr] !== "空" || !sameWord(word, state.image[addr]);
              if (!used) return null;
              const decoded = decodeInstruction(word);
              const hot = addr === focus;
              return (
                <div key={addr} className={`rounded px-1 py-1 ${hot ? "bg-amber-100/80" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px]">
                    <span className="text-muted-foreground">{addr.toString().padStart(4, "0")}</span>
                    <span>{formatWord(word)}</span>
                    <span className="text-muted-foreground">{state.notes[addr]}</span>
                  </div>
                  {/^(RAL|ALO|SLO|STL|LDD|STD|BMI|BRNZ|STOP)\b/.test(state.notes[addr]) ? (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      操作 {decoded.op.toString().padStart(2, "0")} · 数据 {decoded.data.toString().padStart(4, "0")} · 下一条 {decoded.next.toString().padStart(4, "0")}
                    </p>
                  ) : (
                    <BiQuinaryWord word={word} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
}

function BiQuinaryWord({ word }: { word: { digits: number[] } }) {
  return (
    <div className="mt-1 space-y-0.5">
      {word.digits
        .slice()
        .reverse()
        .map((digit, index) => {
          const code = biquinary(digit);
          return (
            <div key={index} className="flex items-center gap-1">
              {[0, 5].map((lamp) => (
                <span key={lamp} className={code.bi === lamp ? "lamp lamp-bi" : "lamp"}>
                  {lamp}
                </span>
              ))}
              <span className="mx-0.5 text-[10px] text-muted-foreground">+</span>
              {[0, 1, 2, 3, 4].map((lamp) => (
                <span key={lamp} className={code.quin === lamp ? "lamp lamp-quin" : "lamp"}>
                  {lamp}
                </span>
              ))}
            </div>
          );
        })}
    </div>
  );
}

function IbmLecture() {
  return (
    <div className="space-y-2">
        <p>
          1954 年交付的 IBM 650 把一个十进制数字拆成两组灯：两盏里亮一盏，表示 0 或 5；五盏里亮一盏，表示 0、1、2、3、4。7 是「5」那盏加上「2」那盏。这叫二五进制。它和 5421 不一样：5421 里的 3 是权 2 和权 1 同时亮，二五进制里的 3 只亮标着 3 的那一盏。
        </p>
      <p>
        内存是 2000 字的磁鼓，这是最常见的原机容量，另外也有 1000 和 4000 字的型号。指令本身有十位：两位操作码、四位数据地址、四位下一条指令的地址。不能做完再自动加一，否则鼓已经转过去了。真机上的 SOAP 会替你把下一条安排到鼓正转到的位置；这里没写地址时按纸上的下一行补，也不模拟鼓的等待。
      </p>
        <p>累加器有二十位，分上下两半。进出累加器的数都要经过十位的分配器。</p>
        <InstructionManual machine="ibm650" />
      </div>
  );
}
