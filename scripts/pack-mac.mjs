import { spawn } from "node:child_process";
import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist-portable");
const stage = resolve(root, "dist-mac");
const app = resolve(stage, "Quire.app");
const resources = resolve(app, "Contents/Resources");
const zipPath = resolve(root, "artifacts/quire-mac.zip");

function run(command, args, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`))));
  });
}

await run("npx", ["vite", "build", "--config", "vite.portable.config.ts"]);

const nested = resolve(built, "portable/index.html");
const html = (await readFile(nested, "utf8")).replaceAll("../assets/", "./assets/");
await writeFile(resolve(built, "index.html"), html);
await rm(nested);
await rm(resolve(built, "portable"), { recursive: true });

await rm(stage, { recursive: true, force: true });
await mkdir(resolve(app, "Contents/MacOS"), { recursive: true });
await cp(resolve(root, "portable/mac/Quire.app/Contents/Info.plist"), resolve(app, "Contents/Info.plist"));
await cp(resolve(root, "portable/mac/Quire.app/Contents/PkgInfo"), resolve(app, "Contents/PkgInfo"));
await cp(resolve(root, "portable/mac/Quire.app/Contents/MacOS/Quire"), resolve(app, "Contents/MacOS/Quire"));
await chmod(resolve(app, "Contents/MacOS/Quire"), 0o755);
await mkdir(resources, { recursive: true });
await cp(resolve(root, "portable/mac/serve.py"), resolve(resources, "serve.py"));
await cp(resolve(root, "portable/mac/setup_mac.py"), resolve(resources, "setup_mac.py"));
await cp(built, resolve(resources, "www"), { recursive: true });
await cp(resolve(root, "portable/mac/Install Quire.command"), resolve(stage, "Install Quire.command"));
await cp(resolve(root, "portable/mac/Uninstall Quire.command"), resolve(stage, "Uninstall Quire.command"));
await chmod(resolve(stage, "Install Quire.command"), 0o755);
await chmod(resolve(stage, "Uninstall Quire.command"), 0o755);
await cp(resolve(root, "portable/mac/README.txt"), resolve(stage, "README.txt"));

await mkdir(dirname(zipPath), { recursive: true });
await rm(zipPath, { force: true });
await run("python3", [
  "-c",
  `
import os, stat, zipfile
from pathlib import Path
root = Path(${JSON.stringify(stage)})
dest = Path(${JSON.stringify(zipPath)})
exec_names = {"Quire", "Install Quire.command", "Uninstall Quire.command"}
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        info = zipfile.ZipInfo(rel)
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        mode = 0o755 if path.name in exec_names else 0o644
        info.external_attr = (stat.S_IFREG | mode) << 16
        z.writestr(info, path.read_bytes())
print(dest, dest.stat().st_size)
`,
]);
