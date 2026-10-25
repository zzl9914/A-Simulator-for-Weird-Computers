"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DecimalBench } from "./decimal-bench";
import { EniacBench } from "./eniac-bench";
import { Ibm650Bench } from "./ibm650-bench";
import { PostfixBench } from "./postfix-bench";
import { SetunBench } from "./setun-bench";

const GROUPS = [
  {
    title: "三进制",
    note: "Сетунь 和 Сетунь-70 是两套不同的原型，程序写法也不一样。",
    machines: [
      { id: "setun", name: "Сетунь", note: "1958 · 162 短字" },
      { id: "setun70", name: "Сетунь-70", note: "1970 · 81 槽一页" },
    ],
  },
  {
    title: "十进制的三种编码",
    note: "十中取一、二五进制、8421。二五进制不是 5421。",
    machines: [
      { id: "eniac", name: "ENIAC", note: "1945 · 20 个累加器" },
      { id: "650", name: "IBM 650", note: "1954 · 2000 字磁鼓" },
      { id: "1401", name: "IBM 1401", note: "1959 · 1400 字符" },
    ],
  },
] as const;

type MachineId = (typeof GROUPS)[number]["machines"][number]["id"];

export function Lab() {
  const [machine, setMachine] = useState<MachineId>("setun");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-xs tracking-[0.25em] text-muted-foreground">原型机模拟器</p>
        <h1 className="mt-1 font-heading text-4xl text-balance sm:text-5xl">五种老机器的写法</h1>
        <p className="mt-3 text-base leading-7">
          汇编写在本地文件里。点开一份，前端向 C++ 编译器要结果，再在页面上单步。磁鼓等待和读卡没有做进来。
        </p>
      </header>
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <div>
            <h2 className="font-heading text-xl">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.note}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={group.title}>
            {group.machines.map((item) => (
              <Button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={machine === item.id}
                variant={machine === item.id ? "default" : "outline"}
                className="h-auto px-3 py-2"
                onClick={() => setMachine(item.id)}
              >
                <span className="block text-left">
                  <span className="block font-heading text-base leading-5">{item.name}</span>
                  <span className="block text-[11px] font-normal opacity-80">{item.note}</span>
                </span>
              </Button>
            ))}
          </div>
        </section>
      ))}
      <div className={machine === "setun" ? "block" : "hidden"}>
        <SetunBench />
      </div>
      <div className={machine === "setun70" ? "block" : "hidden"}>
        <PostfixBench />
      </div>
      <div className={machine === "eniac" ? "block" : "hidden"}>
        <EniacBench />
      </div>
      <div className={machine === "650" ? "block" : "hidden"}>
        <Ibm650Bench />
      </div>
      <div className={machine === "1401" ? "block" : "hidden"}>
        <DecimalBench />
      </div>
    </div>
  );
}
