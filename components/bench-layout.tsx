"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AsmError, ProgramFile } from "./use-machine";

export function BenchShell({
  toolbar,
  editor,
  console,
  memory,
}: {
  toolbar: ReactNode;
  editor: ReactNode;
  console: ReactNode;
  memory: ReactNode;
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-3 text-sm">
      <section className="flex min-h-0 min-w-0 flex-col border-r">
        <ColumnLabel>代码</ColumnLabel>
        <div className="shrink-0 px-3 pt-2">{toolbar}</div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto px-3 pb-3">{editor}</div>
      </section>
      <section className="flex min-h-0 min-w-0 flex-col border-r">
        <ColumnLabel>内存</ColumnLabel>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">{memory}</div>
      </section>
      <section className="flex min-h-0 min-w-0 flex-col">
        <ColumnLabel>终端</ColumnLabel>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">{console}</div>
      </section>
    </div>
  );
}

function ColumnLabel({ children }: { children: string }) {
  return <p className="border-b px-3 py-1 text-[11px] tracking-widest text-muted-foreground">{children}</p>;
}

export function Transport({
  dirty,
  blocked,
  status,
  onAssemble,
  onStep,
  onRun,
  onReset,
}: {
  dirty: boolean;
  blocked: boolean;
  status: string;
  onAssemble: () => void;
  onStep: () => void;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onAssemble}>
          装入
        </Button>
        <Button type="button" variant="outline" onClick={onStep} disabled={blocked}>
          单步
        </Button>
        <Button type="button" onClick={onRun} disabled={blocked}>
          运行
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          复位
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {dirty ? "纸上改过，还没装进机器。" : status}
      </p>
    </div>
  );
}

export function CodingSheet({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  short?: boolean;
}) {
  return (
    <Textarea
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      className="field-sizing-fixed min-h-full flex-1 resize-none border-0 bg-transparent py-1 pr-2 pl-3 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0"
    />
  );
}

export function ErrorList({ errors }: { errors: AsmError[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {errors.map((error) => (
        <li key={`${error.line}-${error.message}`}>
          第 {error.line} 行：{error.message}
        </li>
      ))}
    </ul>
  );
}

export function ProgramBar({
  catalog,
  source,
  blurb,
  path,
  onPick,
  onSave,
  onCustomize,
}: {
  catalog: ProgramFile[];
  source: string;
  blurb: string;
  path: string;
  onPick: (file: string) => void;
  onSave: (title: string) => Promise<void>;
  onCustomize: () => void;
}) {
  const matched = catalog.find((item) => item.source === source);
  const custom = !matched;
  const dialog = useRef<HTMLDialogElement>(null);
  const [saveError, setSaveError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (!title) return;
    setSaveError("");
    try {
      await onSave(title);
      dialog.current?.close();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "没有存下来");
    }
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        {catalog.map((item) => (
          <Button
            key={item.file}
            type="button"
            size="sm"
            variant={matched?.file === item.file ? "default" : "outline"}
            onClick={() => onPick(item.file)}
          >
            {item.title}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={custom ? "default" : "outline"}
          className="ml-1"
          aria-pressed={custom}
          onClick={onCustomize}
        >
          自定义
        </Button>
        {custom ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setSaveError("");
              dialog.current?.showModal();
            }}
          >
            保存
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        {custom ? "处于自定义" : `处于「${matched.title}」`}
      </p>
      {matched ? <p className="text-sm text-muted-foreground">{blurb || matched.blurb}</p> : null}
      <p className="font-mono text-xs text-muted-foreground">{custom ? "尚未写入文件" : path}</p>
      <dialog
        ref={dialog}
        className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-md border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/40 open:fixed open:top-1/2 open:left-1/2 open:-translate-x-1/2 open:-translate-y-1/2"
      >
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
          <p className="font-heading text-lg">给这份程序起名</p>
          <input
            name="title"
            required
            maxLength={40}
            autoFocus
            aria-label="程序名字"
            placeholder="名字"
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
          {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

export function IdleBench({
  sheetLabel,
  short = false,
  machine,
}: {
  sheetLabel: string;
  short?: boolean;
  machine: {
    catalog: ProgramFile[];
    source: string;
    blurb: string;
    path: string;
    dirty: boolean;
    blocked: boolean;
    errors: AsmError[];
    openFile: (file: string) => void;
    save: (title: string) => Promise<void>;
    customize: () => void;
    edit: (next: string) => void;
    assemble: () => void;
    step: () => void;
    run: () => void;
    reset: () => void;
  };
}) {
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
            status="还没装入。写好程序后点「装入」。"
            onAssemble={machine.assemble}
            onStep={machine.step}
            onRun={machine.run}
            onReset={machine.reset}
          />
        </>
      }
      editor={
        <>
          <CodingSheet short={short} label={sheetLabel} value={machine.source} onChange={machine.edit} />
          <ErrorList errors={machine.errors} />
        </>
      }
      console={<p className="text-sm text-muted-foreground">机器还是空的。写好程序后点「装入」，才能单步或运行。</p>}
      memory={<p className="text-sm text-muted-foreground">内存还是空的。</p>}
    />
  );
}

export function TraceBox({ trace, log }: { trace: string; log: string[] }) {
  return (
    <div className="mt-3">
      <p className="font-heading text-base leading-7" aria-live="polite">
        {trace}
      </p>
      {log.length > 1 ? (
        <ol className="mt-3 space-y-1 border-t pt-2 text-xs leading-5 text-muted-foreground">
          {log.slice(0, -1).map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
