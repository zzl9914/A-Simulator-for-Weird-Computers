import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MACHINES = new Set(["setun", "setun70", "eniac", "ibm650", "ibm1401"]);

function directory(machine: string) {
  return path.join(process.cwd(), "programs", machine);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const machine = url.searchParams.get("machine") ?? "";
  if (!MACHINES.has(machine)) {
    return Response.json({ error: "没有这种机器" }, { status: 400 });
  }
  const file = url.searchParams.get("file");
  if (file) {
    if (!/^[\w.-]+\.asm$/.test(file)) {
      return Response.json({ error: "文件名不对" }, { status: 400 });
    }
    try {
      const source = await readFile(path.join(directory(machine), file), "utf8");
      return Response.json({ file, source });
    } catch {
      return Response.json({ error: "找不到这份汇编" }, { status: 404 });
    }
  }
  const names = (await readdir(directory(machine))).filter((name) => name.endsWith(".asm")).sort();
  const programs = await Promise.all(
    names.map(async (name) => {
      const source = await readFile(path.join(directory(machine), name), "utf8");
      const title = source.match(/^;\s*@title\s+(.+)$/m)?.[1]?.trim() ?? name;
      const blurb = source.match(/^;\s*@blurb\s+(.+)$/m)?.[1]?.trim() ?? "";
      return { file: name, title, blurb, source };
    }),
  );
  return Response.json(programs);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { machine?: string; title?: string; source?: string };
  const machine = body.machine ?? "";
  const title = (body.title ?? "").replace(/[\r\n]/g, " ").trim();
  const source = body.source ?? "";
  if (!MACHINES.has(machine) || !title || title.length > 40 || typeof source !== "string" || source.length > 100_000) {
    return Response.json({ error: "名字要在 1 到 40 字，程序也不能是空的。" }, { status: 400 });
  }
  const file = `c-${Date.now()}.asm`;
  const folder = directory(machine);
  const full = path.join(folder, file);
  if (!full.startsWith(folder + path.sep)) {
    return Response.json({ error: "写不进去" }, { status: 400 });
  }
  const bodyLines = source
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => !/^;\s*@(title|blurb)\b/.test(line));
  const text = `; @title ${title}\n; @blurb 自定义\n${bodyLines.join("\n").replace(/^\n+/, "")}`;
  const stored = text.endsWith("\n") ? text : `${text}\n`;
  await writeFile(full, stored, { encoding: "utf8", flag: "wx" });
  return Response.json({ file, title, blurb: "自定义", source: stored });
}
