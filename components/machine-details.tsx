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
        1958 年，莫斯科大学的 Брусенцов 用磁心做成了 Сетунь，并拿去算题。平衡三进制的计算机里，真正跑起来的不多。
      </p>
    ),
    architecture: (
      <>
        <p>一位是 +1、0、−1。没有符号位，取负就是把每一位的 + 和 − 对调。</p>
        <p>
          快存 162 个九位短字，分三区。磁鼓 36 区，每区 54 字。指令单地址：高五位是地址，中间三位是操作码，最低位决定地址加还是减变址 F。
        </p>
        <p>算术结果留在 18 位寄存器 S 的高九位。条件转移不比较两个数，只看上一趟留下的 w，取值是 +、0、−。</p>
      </>
    ),
  },
  setun70: {
    history: <p>1970 年的 Сетунь-70 是另一台机器。程序不再写成「操作码加地址」，而是放在页里的一串音节。</p>,
    architecture: (
      <>
        <p>
          一格六个三进制位，叫做 трайт。前两位是 00 的是运算，否则是地址。栈上的一格是三个 трайт，十八位。
        </p>
        <p>
          一级内存 27 页，每页 81 槽：0–8 页 ОЗУ，9–26 页 ПЗУ。三个 приписки 指出当前打开的页，只在开机的 WIN 和 MAP 里改。磁鼓 243 页，按整页交换。
        </p>
      </>
    ),
  },
  eniac: {
    history: <p>1945 年在宾夕法尼亚大学落成。它没有存放程序的内存，算什么、先算哪一步，都靠接线。</p>,
    architecture: (
      <>
        <p>每一位是一圈十个灯，只亮一个。亮着的号就是这个数字，叫做十中取一。符号是单独一盏灯。</p>
        <p>20 台累加器，编号 1 到 20，每台十位。这里的一行就是真机上的一根程序脉冲线。</p>
      </>
    ),
  },
  "650": {
    history: <p>1954 年交付，是最早批量生产的电子计算机之一。常见的是 2000 字磁鼓，也有 1000 字和 4000 字的型号。</p>,
    architecture: (
      <>
        <p>
          一个十进制数字用七盏灯：两盏里亮一盏，表示 0 或 5；五盏里亮一盏，表示 0 到 4。7 是 5 加 2。这是二五进制，不是 5421。5421 里的 3 会同时亮权 2 和权 1，这里只亮标着 3 的那一盏。
        </p>
        <p>
          指令十字：两位操作码、四位数据地址、四位下一条的地址。做完不会自动加一，否则鼓已经转过去了。累加器二十位，上下各十位，数进出都经过十位分配器。
        </p>
        <p>这里不模拟鼓转到哪一位才读得到。下一地址没写时，按纸上的下一行补。</p>
      </>
    ),
  },
  "1401": {
    history: <p>1959 年的可变字长十进制商用机。数据和程序都是字符，从穿孔卡片读入，结果送到打印机。</p>,
    architecture: (
      <>
        <p>
          数字是 8421 BCD，7 写成 4+2+1，没有单独的「5」。上面还有 A、B 两个区位，字标另占一位。正负号写在个位的区位上，所以刚算完的数直接去印，会变成字母。
        </p>
        <p>
          字段没有固定长度，从个位往左直到字标。内存 1400 个字符。地址超过 999 时，只给百位加上 A 区位。读卡区 001–080，打印区 201–332。
        </p>
      </>
    ),
  },
};
