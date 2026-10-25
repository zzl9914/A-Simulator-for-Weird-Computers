"use client";

import { useEffect, useRef, useState } from "react";

export type AsmError = { line: number; message: string };
export type ProgramFile = { file: string; title: string; blurb: string; source: string };

type AsmResult<P> = { ok: true; program: P } | { ok: false; errors: AsmError[] };

async function compileSource<P>(machine: string, source: string): Promise<AsmResult<P>> {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ machine, source }),
  });
  return response.json() as Promise<AsmResult<P>>;
}

export function useMachine<P, S extends { halted: boolean; error?: string }>(
  machine: string,
  boot: (program: P) => S,
  stepFn: (state: S) => S,
  runFn: (state: S) => S,
) {
  const [catalog, setCatalog] = useState<ProgramFile[]>([]);
  const [file, setFile] = useState("");
  const [source, setSource] = useState("");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<AsmError[]>([]);
  const [program, setProgram] = useState<P | null>(null);
  const [state, setState] = useState<S | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const ticket = useRef(0);

  async function openFile(nextFile: string) {
    const current = ++ticket.current;
    setBusy(true);
    try {
      const response = await fetch(`/api/programs?machine=${machine}&file=${encodeURIComponent(nextFile)}`);
      if (!response.ok) throw new Error("打不开这份汇编文件");
      const body = (await response.json()) as { source: string };
      if (current !== ticket.current) return;
      const assembled = await compileSource<P>(machine, body.source);
      if (current !== ticket.current) return;
      setFile(nextFile);
      setSource(body.source);
      setDirty(false);
      if (!assembled.ok) {
        setErrors(assembled.errors);
        setPhase("ready");
        return;
      }
      setErrors([]);
      setProgram(assembled.program);
      setState(boot(assembled.program));
      setPhase("ready");
    } catch (error) {
      if (current !== ticket.current) return;
      setFailure(error instanceof Error ? error.message : "打不开汇编文件");
      setPhase("failed");
    } finally {
      if (current === ticket.current) setBusy(false);
    }
  }

  useEffect(() => {
    const current = ++ticket.current;
    let cancel = false;
    (async () => {
      try {
        const response = await fetch(`/api/programs?machine=${machine}`);
        if (!response.ok) throw new Error("列不出本地汇编文件");
        const files = (await response.json()) as ProgramFile[];
        if (cancel || current !== ticket.current) return;
        setCatalog(files);
        if (!files[0]) {
          setFailure("这个目录里还没有汇编文件");
          setPhase("failed");
          return;
        }
        const opened = await fetch(`/api/programs?machine=${machine}&file=${encodeURIComponent(files[0].file)}`);
        if (!opened.ok) throw new Error("打不开这份汇编文件");
        const body = (await opened.json()) as { source: string };
        const assembled = await compileSource<P>(machine, body.source);
        if (cancel || current !== ticket.current) return;
        setFile(files[0].file);
        setSource(body.source);
        setDirty(false);
        if (!assembled.ok) {
          setErrors(assembled.errors);
          setPhase("ready");
          return;
        }
        setErrors([]);
        setProgram(assembled.program);
        setState(boot(assembled.program));
        setPhase("ready");
      } catch (error) {
        if (cancel || current !== ticket.current) return;
        setFailure(error instanceof Error ? error.message : "打不开汇编文件");
        setPhase("failed");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [machine, boot]);

  async function load(nextSource: string, then: "boot" | "step" | "run") {
    const current = ++ticket.current;
    setBusy(true);
    try {
      const assembled = await compileSource<P>(machine, nextSource);
      if (current !== ticket.current) return;
      if (!assembled.ok) {
        setErrors(assembled.errors);
        return;
      }
      const booted = boot(assembled.program);
      setErrors([]);
      setProgram(assembled.program);
      setDirty(false);
      setSourceState(nextSource);
      setState(then === "boot" ? booted : then === "step" ? stepFn(booted) : runFn(booted));
    } finally {
      if (current === ticket.current) setBusy(false);
    }
  }

  function setSourceState(next: string) {
    setSource(next);
  }

  const blocked = busy || !state || (Boolean(state.error) && !dirty);
  const active = catalog.find((item) => item.file === file);

  return {
    catalog,
    file,
    source,
    dirty,
    errors,
    program,
    state,
    blocked,
    phase,
    failure,
    blurb: active?.blurb ?? "",
    path: file ? `programs/${machine}/${file}` : "",
    edit(next: string) {
      setSource(next);
      setDirty(true);
    },
    assemble() {
      void load(source, "boot");
    },
    step() {
      if (!state) return;
      if (dirty) {
        void load(source, "step");
        return;
      }
      if (state.error) return;
      if (state.halted) {
        void load(source, "step");
        return;
      }
      setState(stepFn(state));
    },
    run() {
      if (!state) return;
      if (dirty) {
        void load(source, "run");
        return;
      }
      if (state.error) return;
      if (state.halted) {
        void load(source, "run");
        return;
      }
      setState(runFn(state));
    },
    reset() {
      if (!program) return;
      setErrors([]);
      setState(boot(program));
    },
    openFile(nextFile: string) {
      void openFile(nextFile);
    },
    async save(title: string) {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ machine, title, source }),
      });
      const saved = (await response.json()) as ProgramFile & { error?: string };
      if (!response.ok) throw new Error(saved.error || "没有存下来");
      const listed = await fetch(`/api/programs?machine=${machine}`);
      if (!listed.ok) throw new Error("存好了，但列表没有刷新");
      const files = (await listed.json()) as ProgramFile[];
      setCatalog(files);
      setFile(saved.file);
      setSource(saved.source);
      setDirty(false);
    },
  };
}
