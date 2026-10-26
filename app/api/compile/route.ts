import { spawn } from "node:child_process";
import path from "node:path";

const MACHINES = new Set(["setun", "setun70", "eniac", "ibm650", "ibm1401"]);
const compiler = path.join(
  process.cwd(),
  process.platform === "win32" ? "compiler/build/radixcc.exe" : "compiler/build/radixcc",
);

function compile(machine: string, source: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(compiler, ["assemble", machine]);
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err || out || "编译器没有正常退出"));
      else resolve(out);
    });
    child.stdin.write(source);
    child.stdin.end();
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { machine?: string; source?: string };
  const machine = body.machine ?? "";
  if (!MACHINES.has(machine) || typeof body.source !== "string") {
    return Response.json({ ok: false, errors: [{ line: 1, message: "编译请求不对" }] }, { status: 400 });
  }
  try {
    const out = await compile(machine, body.source);
    return Response.json(JSON.parse(out));
  } catch (error) {
    const message = error instanceof Error ? error.message : "编译器没有跑起来";
    return Response.json(
      { ok: false, errors: [{ line: 1, message: `C++ 编译器不可用。先在仓库里执行 cmake 构建 compiler/build/radixcc。${message}` }] },
      { status: 500 },
    );
  }
}
