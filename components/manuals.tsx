function Text({ as, children }: { as: "p" | "li"; children: string }) {
  const Tag = as;
  const parts = children.split("`");
  return (
    <Tag>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded-sm bg-background px-1 font-mono text-[0.92em] text-foreground">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </Tag>
  );
}

export function InstructionSet({ machine }: { machine: "setun" | "setun70" | "eniac" | "ibm650" | "ibm1401" }) {
  return <div className="space-y-2 text-sm leading-6 text-muted-foreground">{manuals[machine]}</div>;
}

const manuals = {
  setun: (
    <>
      <Text as="p">一行一条。标号写成 `A:`，注释从 `;` 开始。`.t` 写九位整数，`.short` 写五位短字，`ORG` 指定下一个短字，`TAPE n` 往输入纸带上放一个整数。</Text>
      <Text as="p">指令是单地址。逗号后面的 `+` 或 `−` 表示地址加上或减去变址 F。下面 24 条是这台机器的全部操作，3 个九进制码留空。</Text>
      <ul className="list-disc space-y-1 pl-4">
        <Text as="li">`LDA` 把短字送入 S 的高九位。`STA` 把 S 的高九位写回。`LDR` 送入 R。`STC` 写下当前指令地址 C。</Text>
        <Text as="li">`ADD` / `SUB` 把内存里的数加进 S，或从 S 里减去。`MUL` 做算术乘法，乘积按高九位对齐。`MADD` 把 R 与内存的乘积加进 S。`TMUL` 仍是按位三值乘。</Text>
        <Text as="li">`SHF` 按短字移位。正数左移，负数右移并舍入。`NORM` 把 S 规格化后写入地址，移位数留在 S。</Text>
        <Text as="li">`LDF` 把短字装进 F。`STF` 把 F 写成短字。`ADF` 把短字加进 F。`ADDC` 把短字加上当前指令地址，结果放进 F。</Text>
        <Text as="li">`BR` 无条件转移。`BM` / `BZ` / `BP` 看上一趟留下的 w 是 −、0 还是 +。`HLT` 停机。</Text>
        <Text as="li">`WZONE 鼓区:快存区` 把一区 54 字写入磁鼓。`RZONE` 读回。`IN` 从纸带读一个数。`OUT` 把内存里的数送到输出。</Text>
      </ul>
    </>
  ),
  setun70: (
    <>
      <Text as="p">程序和数据都放在页里。`PAGE n` 换到 ОЗУ 的第 n 页，`WORD` 写三个 трайт。`WIN 窗口 页` 设定开机时的 приписка。注释从 `;` 开始。执行时第 1 个窗口始终指向正在跑的那一页。</Text>
      <Text as="p">地址音节 `@0 A` 经第 0 个窗口把 A 的十八位压进栈。`&0 A` 压进去的是槽地址。单独一个数或 `#数` 会当成字面量。</Text>
      <ul className="list-disc space-y-1 pl-4">
        <Text as="li">`+` `-` `*` 以及别名 `ADD` `SUB` `MUL`：弹出两格，把和、差或积压回去。`NEG` 取负。`DUP` `SWAP` `DROP` 管栈。`TDN` 只把栈顶变号，不弹出。</Text>
        <Text as="li">`S+T` / `S-T` 用寄存器 S 加上或减去栈顶。`L*T` 把 S 送进 R，再让栈顶乘 R，积留在 S。`SHF` 弹出移位数，正数把新的栈顶左移，负数右移并舍入到最近。</Text>
        <Text as="li">`!` 先弹出地址，再弹出数值，写成三个 трайт。`.` 印出栈顶。`HALT` 停机。</Text>
        <Text as="li">`JSR 标号` 调用子程序，`RMC` 返回。`DOW 标号` 在栈顶不是零时调用。`BRT 负,零,正` 按栈顶符号调用三个标号之一。`JMP` 转到栈顶上的地址。</Text>
        <Text as="li">`MAP 窗口,页` 改一个 приписка。`STOREP ОЗУ页,磁鼓页` 整页写入磁鼓。`LOADP` 整页读回。磁鼓页是 0–242。</Text>
      </ul>
    </>
  ),
  eniac: (
    <>
      <Text as="p">每一行是一个程序脉冲。累加器编号 1 到 20。标号写成 `LOOP:`。注释从 `;` 开始。</Text>
      <ul className="list-disc space-y-1 pl-4">
        <Text as="li">`SET 累加器, 常数` 把十进制数拨进累加器。`ADD 来源, 目的` 相加。`SUB 来源, 目的` 相减。符号是单独一盏灯。</Text>
        <Text as="li">`MUL 被乘数, 乘数, 低位, 高位` 用乘法器求十位乘十位的积，低十位和高十位各进一台累加器。</Text>
        <Text as="li">`DIV 被除数, 除数, 商` 用除法器做整数除法。商进指定累加器，余数留在被除数那一台。除数是 0 就停机。</Text>
        <Text as="li">`SQRT 来源, 目的` 用开方器求非负整数的整数平方根。</Text>
        <Text as="li">`FTSET 表, 自变量, 常数` 和 `FT 表, 自变量累加器, 目的` 使用三张函数表，自变量取绝对值的后两位。负数自变量送出相反数。</Text>
        <Text as="li">`CTSET 号, 常数` 和 `CT 号, 目的` 是常数发送器，号从 0 到 99。</Text>
        <Text as="li">`MPSET 步进器, 次数` 和 `MP 步进器, 标号` 是主编程器。步进器 1 到 10。写在循环体后面的 `MP` 会把这一段再跑完指定的次数。</Text>
        <Text as="li">`OUT 累加器` 送到打印机。`HLT` 停机。</Text>
      </ul>
    </>
  ),
  ibm650: (
    <>
      <Text as="p">一行一个十字。标号可以写成 `A:`，或写在操作前面。`DEC +27` 放一个带符号的十位数据。`CARD` 后面最多八个十字，是读卡机里的下一张卡片。`ORG` 指定下一个鼓地址。注释从 `;` 开始。</Text>
      <Text as="p">没写下一地址时，汇编按纸上的下一行补上。转移写两个地址：条件成立去第一个，否则去第二个。移位的次数看数据地址的个位，个位是 0 表示移 10 位。下面是基本机器的 44 个操作码。</Text>
      <ul className="list-disc space-y-1 pl-4">
        <Text as="li">`NOP` 00 空操作。`STOP` 01 停机。</Text>
        <Text as="li">`AU` 10 加到上半。`SU` 11 从上半减去。`ALO` 15 加到下半，别名 `AL`。`SLO` 16 从下半减去，别名 `SL`。`AABL` 17、`SABL` 18 用绝对值做加减。</Text>
        <Text as="li">`MULT` 19 用上半乘内存里的十字，二十位积留在累加器。先 `RAL` 再 `SLT 0000`，可以把下半移到上半再乘。`DIV` 14 用整个累加器除，商在下半，余数在上半。`DIVRU` 64 先清掉上半再除。</Text>
        <Text as="li">`RAU` 60、`RSU` 61、`RAL` 65、`RSL` 66、`RAABL` 67、`RSABL` 68 都先把二十位清成正零，再做对应的加减。</Text>
        <Text as="li">`STL` 20 存下半。`STU` 21 存上半；除法之后上半按余数的符号存。`STD` 24 把分配器写入。`LDD` 69 装入分配器，别名 `LD`。`STDA` 22、`STIA` 23 把下半里的数据地址或指令地址嵌进分配器再存走。</Text>
        <Text as="li">`SRT` 30 右移。`SRD` 31 右移并舍入。`SLT` 35 左移，高位推出非零就点亮溢出。`SCT` 36 按上半的高位零左移，移位数放进分配器。</Text>
        <Text as="li">`BRNZU` 44 上半非零。`BRNZ` 45 整个累加器非零。`BMI` 46 为负，别名 `BRMIN`。`BROV` 47 溢出，转走之后灯灭。`BRD10` 到 `BRD1` 是 90–99，看分配器从高位到个位有没有 8 或 9。</Text>
        <Text as="li">`RD` 70 把下一张卡片的八个字读到数据地址。`PCH` 71 从那里穿出八个字。`TLU` 84 用分配器里的数，在同一条磁道上找第一个大于等于它的字，地址留在下半。</Text>
      </ul>
    </>
  ),
  ibm1401: (
    <>
      <Text as="p">自由格式，标号在操作前面。地址指向字段的个位。`ORG` 指定下一个字符，`END 标号` 指定入口。`CARD @文本@` 放一张 80 列卡片。`SWON B` 到 `SWON G` 接通读出开关。注释从 `;` 开始，字符常数写在一对 `@` 里面。</Text>
      <ul className="list-disc space-y-1 pl-4">
        <Text as="li">`DCW` 带字标，`DC` 不带。正数个位写 `+`，负数个位写 `-`。`DS n` 留出 n 个字符。</Text>
        <Text as="li">`ZA` 先清 B 再装入 A。`A` 加。`ZS` 和 `S` 是对应的减法。`MUL` 把 A、B 相乘，积的个位仍在 B，长度是两边相加。`DIV` 用 B 除以 A，商写在 B 字段左边，余数留在 B。</Text>
        <Text as="li">`MCW` 从右往左搬家，遇到字标停止。`LCA` 连字标一起搬。`MN` 只搬数字位。`MZ` 只搬区位。`MCS` 搬家并消掉前导零。`MCE` 按 B 字段里的编辑字填进 A 的数字：空白和 `0` 是数字位，逗号、小数点和 `$` 在有效数字出现前变成空白，`-` 只在负数时留下。</Text>
        <Text as="li">`C` 比较 A 和 B。`B` 无条件转移。`BE` 相等，`BH` 是 B 大于 A，`BL` 是 B 小于 A，`BU` 不相等，`BAV` 溢出。`BCE 标号, 地址, 字符` 按字符相等转移。`BLC` 看是不是最后一张卡片。`BSS 标号, B` 看开关 B–G。</Text>
        <Text as="li">`SW` 设字标。`CW` 清字标。`CS 地址` 从该地址向左清到百位；写成两个地址时清完再转移。`MA` 把两个三位地址相加。`SAR` 和 `SBR` 把上一条用过的 A、B 地址写回三个字符。</Text>
        <Text as="li">`R` 把卡片读进 001–080。`W` 把 201–332 送到打印机。`P` 把 101–180 穿成卡片。`WR`、`RP`、`WP`、`WRP` 是读、印、穿的组合。`H` 停机。`NOP` 空操作。</Text>
        <Text as="li">地址 1000–1399 的百位带 A 区位：1100 的百位是 `/`，1200 的百位是 `S`。</Text>
      </ul>
    </>
  ),
};
