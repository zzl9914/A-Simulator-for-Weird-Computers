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
import { BenchShell, CodingSheet, ErrorList, ProgramBar, TraceBox, Transport } from "./bench-layout";
import { InstructionManual } from "./manuals";
import { sameWord, Trits } from "./trits";
import { useMachine } from "./use-machine";

export function SetunBench() {
  const machine = useMachine("setun", bootSetun, stepSetun, runSetun);
  if (machine.phase !== "ready" || !machine.state) {
    return <p className="text-sm text-muted-foreground">{machine.failure || "正在打开本地汇编…"}</p>;
  }
  const { state } = machine;
  const focus = state.executedAddr ?? state.C;
  const lineNo = state.addrToLine[focus] ?? -1;
  const lineText = lineNo > 0 ? state.lines[lineNo - 1] : "";

  return (
    <BenchShell
      lecture={<SetunLecture />}
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

function SetunLecture() {
  return (
    <div className="space-y-3">
      <h2 className="font-heading text-xl">Сетунь，1958</h2>
      <p>
        莫斯科大学的 Брусенцов 用磁心做了这台小机器。一位不是 0 和 1，而是平衡三进制的 +1、0、−1。负数不必另设符号位，把每一位的 + 和 − 对调就是取负。
      </p>
      <p>
        程序是单地址指令。九位里，高五位是地址，中间三位是操作码，最低一位是变址：为 + 就加上寄存器 F，为 − 就减去。算术结果留在 18 位寄存器 S，从内存读入的九位放在 S 的高半，写回时也只写高半。
      </p>
      <p>
        条件转移不当场比较两个数。它看上一趟运算留下的符号 w，只有 +、0、− 三种。所以循环里要让「改 F」紧挨着转移，w 才是你想看的那个符号。
      </p>
      <p>
        右移丢掉末位，就是舍入到最近的整数。左移是乘 3。MUL 做算术乘法，TMUL 仍是按位三值乘。
      </p>
      <InstructionManual machine="setun" />
    </div>
  );
}
