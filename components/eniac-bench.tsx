"use client";

import { accValue, bootEniac, decadeLamps, runEniac, stepEniac } from "@/lib/eniac";
import { BenchShell, CodingSheet, ErrorList, IdleBench, ProgramBar, TraceBox, Transport } from "./bench-layout";
import { useMachine } from "./use-machine";

export function EniacBench() {
  const machine = useMachine("eniac", bootEniac, stepEniac, runEniac);
  if (machine.phase !== "ready") {
    return <p className="text-sm text-muted-foreground">{machine.failure || "正在打开本地汇编…"}</p>;
  }
  if (!machine.state) {
    return <IdleBench sheetLabel="ENIAC 接线表" short machine={machine} />;
  }
  const { state } = machine;
  const pulse = state.executed === null ? state.pulses[state.pc] : state.pulses[state.executed];

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
            status={status(state.halted, state.error, state.steps)}
            onAssemble={machine.assemble}
            onStep={machine.step}
            onRun={machine.run}
            onReset={machine.reset}
          />
        </>
      }
      editor={
        <>
          <CodingSheet short label="ENIAC 接线表" value={machine.source} onChange={machine.edit} />
          <ErrorList errors={machine.errors} />
        </>
      }
      console={
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">累加器 {state.focus + 1} 的十位灯环</p>
          <DecadeBlock accIndex={state.focus} digits={state.acc[state.focus].digits} sign={state.acc[state.focus].sign} />
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
            {state.acc.map((acc, index) => (
              <li key={index} className={`flex justify-between font-mono text-xs ${index === state.focus ? "text-foreground" : "text-muted-foreground"}`}>
                <span>{(index + 1).toString().padStart(2, "0")}</span>
                <span>{acc.sign < 0 ? "−" : "+"}{String(Math.abs(accValue(acc))).padStart(10, "0")}</span>
              </li>
            ))}
          </ul>
          {state.printer.length > 0 ? <p className="mt-2 font-mono text-xs">印出 {state.printer.join("，")}</p> : null}
          {pulse ? <p className="mt-2 font-mono text-xs text-muted-foreground">第 {pulse.line} 行 {pulse.text}</p> : null}
          <TraceBox trace={state.trace} log={state.log} />
        </div>
      }
      memory={
        <div>
          <h3 className="mb-2 font-heading text-base">20 个累加器</h3>
          <p className="mb-2 text-xs text-muted-foreground">灯环只展开当前这一台。其余十九台用十位数字看着。</p>
          <DecadeBlock accIndex={state.focus} digits={state.acc[state.focus].digits} sign={state.acc[state.focus].sign} />
        </div>
      }
    />
  );
}

function DecadeBlock({ digits, sign }: { accIndex: number; digits: number[]; sign: 1 | -1 }) {
  return (
    <div className="mt-1 space-y-1">
      <p className="text-xs">
        符号灯 <span className={sign < 0 ? "lamp lamp-hot" : "lamp"}>{sign < 0 ? "−" : "+"}</span>
      </p>
      {digits
        .slice()
        .reverse()
        .map((digit, index) => (
          <div key={index} className="flex items-center gap-1">
            <span className="w-8 text-[10px] text-muted-foreground">{index === 9 ? "个位" : ""}</span>
            {decadeLamps(digit).map((on, lamp) => (
              <span key={lamp} className={on ? "lamp lamp-hot" : "lamp"}>
                {lamp}
              </span>
            ))}
          </div>
        ))}
    </div>
  );
}

function status(halted: boolean, error: string | undefined, steps: number): string {
  if (error) return "机器停下了。";
  if (halted) return `已停机，共 ${steps} 个脉冲。`;
  if (steps === 0) return "接线已装好，还没送脉冲。";
  return `已走 ${steps} 个脉冲。`;
}
