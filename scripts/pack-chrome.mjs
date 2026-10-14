import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist-portable");
const stage = resolve(root, "dist-chrome");
const zipPath = resolve(root, "artifacts/quire-chrome.zip");

function run(command, args, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`))));
  });
}

await run("python3", [
  "-c",
  `
from pathlib import Path
from PIL import Image, ImageDraw
out = Path(${JSON.stringify(resolve(root, "extension/icons"))})
out.mkdir(parents=True, exist_ok=True)
for size in (16, 48, 128):
    image = Image.new("RGBA", (size, size), (255, 210, 63, 255))
    draw = ImageDraw.Draw(image)
    stroke = max(1, size // 16)
    draw.rectangle((stroke, stroke, size - 1 - stroke, size - 1 - stroke), outline=(0, 0, 0, 255), width=stroke)
    left, top = int(size * 0.25), int(size * 0.18)
    right, bottom = int(size * 0.72), int(size * 0.82)
    draw.rectangle((left, top, right, bottom), fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=max(1, stroke - 1))
    y = int(size * 0.55)
    draw.line((int(size * 0.32), y, int(size * 0.64), y), fill=(255, 107, 107, 255), width=max(2, size // 12))
    image.save(out / f"icon-{size}.png")
`,
]);

await run("npx", ["vite", "build", "--config", "vite.portable.config.ts"]);

const nested = resolve(built, "portable/index.html");
const html = (await readFile(nested, "utf8")).replaceAll("../assets/", "./assets/").replaceAll(" crossorigin", "");
await writeFile(resolve(built, "index.html"), html);
await writeFile(resolve(built, "desk.html"), html);
await writeFile(resolve(built, "viewer.html"), html);
await rm(nested);
await rm(resolve(built, "portable"), { recursive: true });

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(built, stage, { recursive: true });
await cp(resolve(root, "extension/manifest.json"), resolve(stage, "manifest.json"));
await cp(resolve(root, "extension/background.js"), resolve(stage, "background.js"));
await cp(resolve(root, "extension/README.txt"), resolve(stage, "README.txt"));
await cp(resolve(root, "extension/icons"), resolve(stage, "icons"), { recursive: true });

await mkdir(dirname(zipPath), { recursive: true });
await rm(zipPath, { force: true });
await run("python3", [
  "-c",
  `
import zipfile
from pathlib import Path
root = Path(${JSON.stringify(stage)})
dest = Path(${JSON.stringify(zipPath)})
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for path in root.rglob("*"):
        if path.is_file():
            z.write(path, Path("Quire") / path.relative_to(root))
print(dest, dest.stat().st_size)
need = ["Quire/manifest.json", "Quire/desk.html", "Quire/viewer.html", "Quire/background.js"]
names = set(zipfile.ZipFile(dest).namelist())
missing = [n for n in need if n not in names]
if missing:
    raise SystemExit("missing " + ", ".join(missing))

`,
]);
