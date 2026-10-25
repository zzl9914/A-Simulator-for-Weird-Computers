"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AsmError, ProgramFile } from "./use-machine";

export function BenchShell({
  lecture,
  toolbar,
  editor,
  console,
  memory,
  stacked = false,
}: {
  lecture: ReactNode;
  toolbar: ReactNode;
  editor: ReactNode;
  console: ReactNode;
  memory: ReactNode;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="flex flex-col gap-3 text-sm leading-6">
        <article>{lecture}</article>
        <section className="sheet rounded-md border p-2">
          {toolbar}
          {editor}
        </section>
        <aside className="rounded-md border bg-muted/40 p-3">{console}</aside>
        <section className="overflow-auto rounded-md border p-2">{memory}</section>
      </div>
    );
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(17rem,23rem)]">
      <article className="order-4 rounded-md border bg-card p-4 text-sm leading-6 text-card-foreground lg:order-1 lg:max-h-[calc(100vh-9rem)] lg:overflow-auto">
        {lecture}
      </article>
      <section className="sheet order-1 rounded-md border p-3 lg:order-2">
        {toolbar}
        {editor}
      </section>
      <aside className="order-2 rounded-md border bg-card p-4 text-card-foreground lg:order-3">{console}</aside>
      <section className="order-3 overflow-auto rounded-md border bg-card p-3 text-card-foreground lg:order-4 lg:col-span-3">
        {memory}
      </section>
    </div>
  );
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
  short = false,
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
      className={`field-sizing-fixed resize-y border-0 bg-transparent py-1 pr-2 pl-12 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0 ${short ? "min-h-44" : "min-h-80"}`}
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
}: {
  catalog: ProgramFile[];
  source: string;
  blurb: string;
  path: string;
  onPick: (file: string) => void;
  onSave: (title: string) => Promise<void>;
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
        <Button type="button" size="sm" variant={custom ? "default" : "outline"} className="ml-1" aria-pressed={custom}>
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
