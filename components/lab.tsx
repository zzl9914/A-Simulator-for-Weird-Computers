"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DecimalBench } from "./decimal-bench";
import { EniacBench } from "./eniac-bench";
import { Ibm650Bench } from "./ibm650-bench";
import { MACHINES, MachineDetails, type MachineId } from "./machine-details";
import { PostfixBench } from "./postfix-bench";
import { SetunBench } from "./setun-bench";

export function Lab() {
  const [machine, setMachine] = useState<MachineId>("setun");
  const current = MACHINES.find((item) => item.id === machine) ?? MACHINES[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative z-20 flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
        <Popup label="system" closeOnClick>
          <ul className="min-w-44 py-1">
            {MACHINES.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex w-full items-baseline justify-between gap-6 px-3 py-1.5 text-left text-sm hover:bg-muted ${item.id === machine ? "bg-muted" : ""}`}
                  onClick={() => setMachine(item.id)}
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.year}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popup>
        <Popup label="details" wide>
          <div className="w-[min(36rem,calc(100vw-2rem))] max-h-[min(32rem,calc(100vh-4rem))] overflow-auto p-4">
            <p className="mb-3 text-sm">
              {current.name}
              <span className="ml-2 text-muted-foreground">{current.year}</span>
            </p>
            <MachineDetails machine={machine} />
          </div>
        </Popup>
      </header>
      <div className="min-h-0 flex-1">
        <div className={machine === "setun" ? "h-full" : "hidden"}>
          <SetunBench />
        </div>
        <div className={machine === "setun70" ? "h-full" : "hidden"}>
          <PostfixBench />
        </div>
        <div className={machine === "eniac" ? "h-full" : "hidden"}>
          <EniacBench />
        </div>
        <div className={machine === "650" ? "h-full" : "hidden"}>
          <Ibm650Bench />
        </div>
        <div className={machine === "1401" ? "h-full" : "hidden"}>
          <DecimalBench />
        </div>
      </div>
    </div>
  );
}

function Popup({
  label,
  wide = false,
  closeOnClick = false,
  children,
}: {
  label: string;
  wide?: boolean;
  closeOnClick?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button type="button" size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {label}
      </Button>
      {open ? (
        <div
          className={`absolute top-full left-0 z-30 mt-1 rounded-md border bg-card text-card-foreground shadow-lg ${wide ? "" : "overflow-hidden"}`}
          onClick={() => {
            if (closeOnClick) setOpen(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
