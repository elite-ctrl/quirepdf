import type { Mark, Pass } from "@/lib/marks";
import type { PdfDoc } from "@/lib/pdf-client";
import { capChanges, marksForPage, wordsInRun, type PlacedWord } from "@/lib/text-diff";

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

async function pageWords(pdf: PdfDoc, pageNumber: number): Promise<PlacedWord[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const words: PlacedWord[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str) continue;
    const run = item as TextItem;
    const height = run.height || Math.hypot(run.transform[2] ?? 0, run.transform[3] ?? 0) || 10;
    words.push(
      ...wordsInRun(run.str, run.transform[4] ?? 0, run.transform[5] ?? 0, run.width || 0, height),
    );
  }
  return words;
}

/**
 * This file is the later copy. Compare is the earlier copy.
 * Inserted and replaced text is marked on the later copy. Deleted text becomes a callout there.
 */
export async function compareDocuments(earlier: PdfDoc, later: PdfDoc, pass: Pass) {
  const shared = Math.min(earlier.numPages, later.numPages);
  const marks: Mark[] = [];
  for (let page = 1; page <= shared; page += 1) {
    const before = await pageWords(earlier, page);
    const after = await pageWords(later, page);
    marks.push(...marksForPage(before, after, page, pass));
    if (marks.length >= 400) return capChanges(marks);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  for (let page = shared + 1; page <= later.numPages; page += 1) {
    const after = await pageWords(later, page);
    if (!after.length) continue;
    marks.push(...marksForPage([], after, page, pass));
    if (marks.length >= 400) return capChanges(marks);
  }
  if (earlier.numPages > later.numPages && later.numPages > 0) {
    const removed: PlacedWord[] = [];
    for (let page = shared + 1; page <= earlier.numPages; page += 1) {
      removed.push(...(await pageWords(earlier, page)));
      if (removed.length > 80) break;
    }
    if (removed.length) {
      const tail = await pageWords(later, later.numPages);
      const anchor = tail.at(-1)?.quad ?? null;
      const mark = marksForPage(removed, [], later.numPages, pass)[0];
      if (mark?.kind === "callout") {
        marks.push({
          ...mark,
          ...(anchor
            ? {
                quads: [{ x: anchor.x, y: anchor.y + anchor.h + 8, w: 210, h: 48 }],
                to: { x: anchor.x, y: anchor.y + anchor.h / 2 },
              }
            : {}),
          note: `Deleted, on later pages of the earlier copy: ${mark.quote}`,
        });
      }
    }
  }
  return capChanges(marks);
}
