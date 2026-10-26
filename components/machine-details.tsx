import type { ReactNode } from "react";
import { InstructionSet } from "./manuals";

export const MACHINES = [
  { id: "setun", name: "Сетунь", year: "1958" },
  { id: "setun70", name: "Сетунь-70", year: "1970" },
  { id: "eniac", name: "ENIAC", year: "1945" },
  { id: "650", name: "IBM 650", year: "1954" },
  { id: "1401", name: "IBM 1401", year: "1959" },
] as const;

export type MachineId = (typeof MACHINES)[number]["id"];

const MANUAL = {
  setun: "setun",
  setun70: "setun70",
  eniac: "eniac",
  "650": "ibm650",
  "1401": "ibm1401",
} as const;

export function MachineDetails({ machine }: { machine: MachineId }) {
  const copy = DETAILS[machine];
  return (
    <div className="space-y-5 text-sm leading-6">
      <section>
        <h2 className="mb-1 text-xs tracking-widest text-muted-foreground">历史背景</h2>
        {copy.history}
      </section>
      <section>
        <h2 className="mb-1 text-xs tracking-widest text-muted-foreground">架构特殊之处</h2>
        <div className="space-y-2">{copy.architecture}</div>
      </section>
      <section>
        <h2 className="mb-1 text-xs tracking-widest text-muted-foreground">汇编指令集</h2>
        <InstructionSet machine={MANUAL[machine]} />
      </section>
    </div>
  );
}

const DETAILS: Record<MachineId, { history: ReactNode; architecture: ReactNode }> = {
  setun: {
    history: (
      <p>
        1958 年，莫斯科大学的 Брусенцов 用磁心做了这台小机器。它是当时少数真正做成、并投入使用的平衡三进制计算机。
      </p>
    ),
    architecture: (
      <>
        <p>一位不是 0 和 1，而是 +1、0、−1。负数不必另设符号位，把每一位的 + 和 − 对调就是取负。</p>
        <p>
          程序是单地址指令。九位里，高五位是地址，中间三位是操作码，最低一位是变址：为 + 就加上寄存器 F，为 − 就减去。算术结果留在 18 位寄存器 S，从内存读入的九位放在 S 的高半，写回时也只写高半。
        </p>
        <p>条件转移不当场比较两个数。它看上一趟运算留下的符号 w，只有 +、0、− 三种。</p>
        <p>右移丢掉末位，就是舍入到最近的整数。左移是乘 3。MUL 做算术乘法，TMUL 仍是按位三值乘。</p>
      </>
    ),
  },
  setun70: {
    history: <p>Сетунь-70 在 1970 年做成。它不是 1958 年那一台的小改款，指令也不再是「操作码加地址」。</p>,
    architecture: (
      <>
        <p>
          程序本身放在页里，一格是六个三进制位，叫做 трайт。前两位是 00 的，是运算音节；否则是地址音节。栈上的一格是三个 трайт，共十八位。
        </p>
        <p>地址音节经三个 приписки 指出的页去取数。执行时第 1 个窗口始终指向正在跑的那一页。</p>
        <p>一级内存是 27 页，每页 81 个 трайт：0–8 页是 ОЗУ，9–26 页是 ПЗУ。磁鼓 243 页，整页交换。</p>
      </>
    ),
  },
  eniac: {
    history: (
      <p>
        ENIAC 于 1945 年在宾夕法尼亚大学落成。它没有存在内存里的程序，计算靠接线：一个程序脉冲让某台累加器送出数，下一根线把脉冲交给另一台去做加或减。这里的每一行就是这样一根线。
      </p>
    ),
    architecture: (
      <>
        <p>
          它不用二进制位去拼一个十进制数字。每一位是一圈十个触发器，环上只能有一个导通，导通的那一号就是这个数字。这就是十中取一。
        </p>
        <p>20 台累加器都在，编号 1 到 20，每台十位。符号是单独一盏灯，不占数字位。</p>
      </>
    ),
  },
  "650": {
    history: (
      <p>
        IBM 650 于 1954 年交付。最常见的原机有 2000 字磁鼓，另外也有 1000 和 4000 字的型号。真机上的 SOAP 会把下一条指令安排到鼓正转到的位置；这里没写地址时按纸上的下一行补，也不模拟鼓的等待。
      </p>
    ),
    architecture: (
      <>
        <p>
          一个十进制数字拆成两组灯：两盏里亮一盏，表示 0 或 5；五盏里亮一盏，表示 0、1、2、3、4。7 是「5」那盏加上「2」那盏。这叫二五进制。它和 5421 不一样：5421 里的 3 是权 2 和权 1 同时亮，二五进制里的 3 只亮标着 3 的那一盏。
        </p>
        <p>指令本身有十位：两位操作码、四位数据地址、四位下一条指令的地址。不能做完再自动加一，否则鼓已经转过去了。</p>
        <p>累加器有二十位，分上下两半。进出累加器的数都要经过十位的分配器。</p>
      </>
    ),
  },
  "1401": {
    history: <p>IBM 1401 是 1959 年的可变字长十进制商用机。程序和数据都是字符，卡片从 001 读入，打印区在 201–332。</p>,
    architecture: (
      <>
        <p>
          数字位是 8421 BCD：四位二进制的权是 8、4、2、1。7 写成 4+2+1，没有单独的「5」那一位。字符上面还有 A、B 两个区位位，字母和正负号靠它们，字标是另外一位。
        </p>
        <p>字段没有固定长度。标号指向个位，加减从右往左，直到 B 字段高位的字标。正负号写在个位的区位上，正数个位会印成字母。</p>
        <p>指令自己也是变长的。操作码上有字标，下一条指令的字标决定这一条在哪里结束。地址超过 999 时，只给百位加 A 区位。</p>
      </>
    ),
  },
};
