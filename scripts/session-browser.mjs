/**
 * Browser regression checks against the Studio entry (no passcode).
 * Start: npm run dev -- --config vite.studio.config.ts
 * Run: npm run test:session:browser
 * Override QUIRE_TEST_URL for a built Studio preview, and CHROMIUM_PATH when
 * using system Chromium rather than Playwright's bundled browser.
 * All annotations are on generated test PDFs, never client/source files.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const directory = await mkdtemp(resolve(tmpdir(), "quire-autosave-"));
const screenshotDir = resolve("screenshots");
await mkdir(screenshotDir, { recursive: true });
for (const name of ["a", "b"]) {
  const pdf = await PDFDocument.create();
  pdf
    .addPage([400, 600])
    .drawText(`Synthetic autosave test ${name.toUpperCase()}`, { x: 40, y: 530, size: 16 });
  await writeFile(resolve(directory, `${name}.pdf`), await pdf.save());
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const errors = [];
let desktop;
const url = process.env.QUIRE_TEST_URL || "http://127.0.0.1:8080/portable/studio.html";
const file = (name) => resolve(directory, `${name}.pdf`);
const saved = (page) =>
  page.locator("footer").getByRole("status").getByText("Saved locally", { exact: true });
async function open(page, name, expectSuccess = true) {
  await page.locator("#quire-open").setInputFiles(file(name));
  if (await page.getByRole("heading", { name: "Open another file?" }).isVisible()) {
    await page.getByRole("button", { name: "Open", exact: true }).click();
  }
  if (expectSuccess)
    await page
      .locator("header:not([inert])")
      .filter({ hasText: `${name}.pdf` })
      .waitFor();
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  desktop = page;
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await open(page, "a");
  await saved(page).waitFor();
  await page.locator(".quire-text span").first().waitFor();
  await page.getByRole("button", { name: /^Callout \(C\)/ }).click();
  const bounds = await page.locator('[data-pane="work"][data-page="1"]').boundingBox();
  assert.ok(bounds, "The PDF page is visible");
  await page.mouse.click(bounds.x + 100, bounds.y + 170);
  const note = page.getByRole("textbox", { name: "Note", exact: true });
  await note.fill("Immediate document-switch regression");
  // Do not wait for the 350ms autosave debounce before switching.
  await open(page, "b");
  await saved(page).waitFor();
  await open(page, "a");
  await saved(page).waitFor();
  await page
    .locator(".quire-callout")
    .filter({ hasText: "Immediate document-switch regression" })
    .waitFor();

  await page.evaluate(() => {
    window.__quireOriginalTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === "readwrite")
        throw new DOMException("Simulated full storage", "QuotaExceededError");
      return window.__quireOriginalTransaction.apply(this, args);
    };
  });
  await page.locator('button[id^="quire-note-"]').first().click();
  await note.fill("Storage failure regression");
  await page.getByRole("button", { name: "Retry save", exact: true }).waitFor();
  await open(page, "b", false);
  await page
    .locator("footer")
    .getByText(/before opening another file/)
    .waitFor();
  assert.match(
    await page.locator(".quire-callout").first().innerText(),
    /Storage failure regression/,
  );

  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = window.__quireOriginalTransaction;
  });
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await saved(page).waitFor();
  await page.screenshot({ path: resolve(screenshotDir, "autosave-desktop.png") });
  await page.reload();
  await open(page, "a");
  await saved(page).waitFor();
  await page.locator(".quire-callout").filter({ hasText: "Storage failure regression" }).waitFor();
  // A successful local recovery is separate from the downloadable PDF.
  const [downloaded] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download marked PDF", exact: true }).click(),
  ]);
  assert.equal(downloaded.suggestedFilename(), "a-marked.pdf");
  assert.equal(await downloaded.failure(), null);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(url);
  await open(mobile, "b");
  await saved(mobile).waitFor();
  const statusBounds = await saved(mobile).boundingBox();
  assert.ok(
    statusBounds && statusBounds.x >= 0 && statusBounds.x + statusBounds.width <= 390,
    "Save status fits on mobile",
  );
  assert.equal(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await mobile.screenshot({ path: resolve(screenshotDir, "autosave-mobile.png") });
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "immediate document switch",
          "restore annotations",
          "storage failure feedback",
          "failed-save switch protection",
          "retry",
          "reload recovery",
          "marked PDF export",
          "mobile status visibility",
          "no uncaught browser errors",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (desktop && !desktop.isClosed()) {
    await desktop.screenshot({ path: resolve(screenshotDir, "autosave-failure.png") });
    console.error((await desktop.locator("body").innerText()).slice(-2200));
  }
  throw error;
} finally {
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}
