import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "dist-portable");
const zipPath = resolve(root, "artifacts/quire-windows.zip");

function run(command, args, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`))));
  });
}

await run("npx", ["vite", "build", "--config", "vite.portable.config.ts"]);

const nested = resolve(out, "portable/index.html");
const html = (await readFile(nested, "utf8")).replaceAll("../assets/", "./assets/");
await writeFile(resolve(out, "index.html"), html);
await rm(nested);
await rm(resolve(out, "portable"), { recursive: true });

await cp(resolve(root, "portable/serve.ps1"), resolve(out, "serve.ps1"));
await cp(resolve(root, "portable/register.ps1"), resolve(out, "register.ps1"));
await cp(resolve(root, "portable/Start Quire.bat"), resolve(out, "Start Quire.bat"));
await cp(resolve(root, "portable/Use Quire for PDFs.bat"), resolve(out, "Use Quire for PDFs.bat"));
for (const name of ["Start Quire.bat", "Use Quire for PDFs.bat"]) {
  const batPath = resolve(out, name);
  const bat = await readFile(batPath);
  await writeFile(batPath, bat.toString("utf8").replace(/\r?\n/g, "\r\n"));
}
await cp(resolve(root, "portable/README.txt"), resolve(out, "README.txt"));

await mkdir(dirname(zipPath), { recursive: true });
await rm(zipPath, { force: true });
await run("python3", [
  "-c",
  `
import zipfile
from pathlib import Path
root = Path(${JSON.stringify(out)})
dest = Path(${JSON.stringify(zipPath)})
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for path in root.rglob("*"):
        if path.is_file():
            z.write(path, path.relative_to(root).as_posix())
print(dest, dest.stat().st_size)
`,
]);
