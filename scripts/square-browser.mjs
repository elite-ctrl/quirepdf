/**
 * Browser check for the Square tool against the Studio entry.
 * Start: npm run dev -- --config vite.studio.config.ts
 * Run: node scripts/square-browser.mjs (QUIRE_TEST_URL / CHROMIUM_PATH as in session-browser.mjs)
 * Uses a generated test PDF only.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { PDFDocument, PDFName } from "pdf-lib";

const directory = await mkdtemp(resolve(tmpdir(), "quire-square-"));
await mkdir("screenshots/test-runs", { recursive: true });
const pdf = await PDFDocument.create();
pdf.addPage([400, 600]).drawText("Synthetic square test", { x: 40, y: 530, size: 16 });
const source = resolve(directory, "sq.pdf");
await writeFile(source, await pdf.save());

const url = process.env.QUIRE_TEST_URL || "http://127.0.0.1:8080/portable/studio.html";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator("#quire-open").setInputFiles(source);
  await page.locator(".quire-text span").first().waitFor();
  const shell = page.locator('[data-pane="work"][data-page="1"]');

  // Keyboard shortcut selects the tool.
  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("r");
  await page.getByRole("button", { name: /^Square \(R\)/, pressed: true }).waitFor();

  const b = await shell.boundingBox();
  await page.mouse.move(b.x + 60, b.y + 120);
  await page.mouse.down();
  await page.mouse.move(b.x + 140, b.y + 170, { steps: 5 });
  await page.mouse.move(b.x + 220, b.y + 220, { steps: 5 });
  await page.mouse.up();
  const squares = shell.locator('[data-kind="square"]');
  await squares.first().waitFor();
  assert.equal(await squares.count(), 1, "one square drawn");

  // A tiny drag does not create a stray mark.
  await page.mouse.move(b.x + 300, b.y + 300);
  await page.mouse.down();
  await page.mouse.move(b.x + 301, b.y + 301);
  await page.mouse.up();
  assert.equal(await squares.count(), 1, "tiny drag ignored");

  // Square is selected after drawing: four corner handles, and resize from SE.
  const handles = squares.first().locator("[data-handle]");
  assert.equal(await handles.count(), 4);
  await page.getByRole("button", { name: /^Select marks/ }).click();
  const before = await squares.first().locator("rect").nth(1).boundingBox();
  const se = await handles.nth(3).boundingBox();
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(se.x + 60, se.y + 40, { steps: 6 });
  await page.mouse.up();
  const after = await squares.first().locator("rect").nth(1).boundingBox();
  assert.ok(after.width > before.width + 40 && after.height > before.height + 25, "resized");

  // Move by dragging its edge.
  await page.mouse.move(after.x + 1, after.y + after.height / 2);
  await page.mouse.down();
  await page.mouse.move(after.x + 31, after.y + after.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  const moved = await squares.first().locator("rect").nth(1).boundingBox();
  assert.ok(Math.abs(moved.x - after.x - 30) < 3 && Math.abs(moved.width - after.width) < 1, "moved without resizing");

  await page.screenshot({ path: "screenshots/test-runs/square-desktop.png" });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download marked PDF", exact: true }).click(),
  ]);
  const out = resolve(directory, "sq-marked.pdf");
  await download.saveAs(out);
  const doc = await PDFDocument.load(await readFile(out));
  const annots = doc.getPage(0).node.Annots();
  const kinds = [];
  for (let i = 0; i < annots.size(); i += 1) kinds.push(doc.context.lookup(annots.get(i)).get(PDFName.of("Subtype")).toString());
  assert.deepEqual(kinds, ["/Square"]);
  const rect = doc.context.lookup(annots.get(0)).get(PDFName.of("Rect")).asArray().map((n) => n.asNumber());
  console.log("exported Square Rect", rect.map((n) => n.toFixed(1)).join(" "));

  // Reopen the exported PDF in a fresh page: the square is read back as an editable mark.
  const second = await browser.newPage({ viewport: { width: 390, height: 844 } });
  second.on("pageerror", (error) => errors.push(error.message));
  await second.goto(url);
  await second.locator("#quire-open").setInputFiles(out);
  await second.locator('[data-pane="work"][data-page="1"] [data-kind="square"]').first().waitFor();
  await second.screenshot({ path: "screenshots/test-runs/square-mobile.png" });
  await second.close();
  await page.close();
  assert.deepEqual(errors, []);
  console.log("square browser check: ok");
} finally {
  await browser.close();
}
