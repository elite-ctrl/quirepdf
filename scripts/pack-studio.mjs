import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist-studio");
const zipPath = resolve(root, "artifacts/faircopy-studio.zip");

function run(command, args, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`))));
  });
}

await run("npx", ["vite", "build", "--config", "vite.studio.config.ts"]);

const nested = resolve(built, "portable/studio.html");
const html = (await readFile(nested, "utf8")).replaceAll("../assets/", "./assets/").replaceAll(" crossorigin", "");
await writeFile(resolve(built, "index.html"), html);
await writeFile(resolve(built, "desk.html"), html);
await writeFile(resolve(built, "viewer.html"), html);
await rm(nested);
await rm(resolve(built, "portable"), { recursive: true });
await rm(resolve(built, "__grok"), { recursive: true, force: true });

await cp(resolve(root, "extension/manifest.studio.json"), resolve(built, "manifest.json"));
await cp(resolve(root, "extension/background.js"), resolve(built, "background.js"));
await cp(resolve(root, "extension/README-studio.txt"), resolve(built, "README.txt"));
await cp(resolve(root, "extension/icons"), resolve(built, "icons"), { recursive: true });

await mkdir(dirname(zipPath), { recursive: true });
await rm(zipPath, { force: true });
await run("python3", [
  "-c",
  `
import zipfile
from pathlib import Path
root = Path(${JSON.stringify(built)})
dest = Path(${JSON.stringify(zipPath)})
def files():
    for path in root.rglob("*"):
        if path.is_file() and not any(part.startswith("_") for part in path.relative_to(root).parts):
            yield path
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for path in files():
        z.write(path, path.relative_to(root).as_posix())
print(dest, dest.stat().st_size)
need = ["manifest.json", "desk.html", "viewer.html", "background.js"]
names = set(zipfile.ZipFile(dest).namelist())
missing = [n for n in need if n not in names]
if missing:
    raise SystemExit("missing " + ", ".join(missing))
if any("/" not in n and n.endswith("manifest.json") for n in names) is False or any(n.startswith("Quire") for n in names):
    raise SystemExit("studio zip must keep manifest.json at the top")
if sum(1 for n in names if n.endswith("manifest.json")) != 1:
    raise SystemExit("studio zip must contain one manifest")
`,
]);
