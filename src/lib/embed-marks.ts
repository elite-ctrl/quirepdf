import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
  StandardFonts,
  rgb,
  type PDFDict,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatContents, INK_RGB, labelName, sortMarks, type Mark, type Point } from "@/lib/marks";
import { edgeToward } from "@/lib/geometry";

function pdfDate(ms: number): string {
  const date = new Date(ms);
  const part = (value: number) => String(value).padStart(2, "0");
  return `D:${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

function num(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function arrowDraw(x1: number, y1: number, x2: number, y2: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 10;
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  const ax = x2 + Math.cos(left) * size;
  const ay = y2 + Math.sin(left) * size;
  const bx = x2 + Math.cos(right) * size;
  const by = y2 + Math.sin(right) * size;
  return [
    `${num(x1)} ${num(y1)} m`,
    `${num(x2)} ${num(y2)} l S`,
    `${num(x2)} ${num(y2)} m`,
    `${num(ax)} ${num(ay)} l`,
    `${num(bx)} ${num(by)} l h f`,
  ].join("\n");
}

function appearance(doc: PDFDocument, rect: number[], body: string) {
  const [x1, y1, x2, y2] = rect;
  const stream = doc.context.flateStream(body, {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, Math.max(1, x2 - x1), Math.max(1, y2 - y1)],
    Resources: doc.context.obj({ ProcSet: [PDFName.of("PDF")] }),
  });
  return doc.context.obj({ N: stream });
}

function local(point: Point, originX: number, originY: number): [number, number] {
  return [point.x - originX, point.y - originY];
}

function paint(color: [number, number, number]): string {
  const [r, g, b] = color.map(num);
  return `${r} ${g} ${b} RG\n${r} ${g} ${b} rg\n1.6 w\n1 J`;
}

function common(doc: PDFDocument, page: PDFPage, mark: Mark, rect: number[], color: [number, number, number]) {
  return {
    Type: PDFName.of("Annot"),
    Rect: rect,
    C: color,
    CA: 1,
    F: 4,
    Contents: PDFHexString.fromText(formatContents(mark)),
    T: PDFHexString.fromText("Quire"),
    Subj: PDFHexString.fromText(labelName(mark.label)),
    NM: PDFHexString.fromText(`quire-${mark.id}`),
    M: PDFString.of(pdfDate(Date.now())),
    CreationDate: PDFString.of(pdfDate(mark.createdAt)),
    P: page.ref,
  };
}

function makeLine(doc: PDFDocument, page: PDFPage, mark: Mark) {
  if (!mark.from || !mark.to) return null;
  const pad = 14;
  const minX = Math.min(mark.from.x, mark.to.x) - pad;
  const minY = Math.min(mark.from.y, mark.to.y) - pad;
  const maxX = Math.max(mark.from.x, mark.to.x) + pad;
  const maxY = Math.max(mark.from.y, mark.to.y) + pad;
  const rect = [minX, minY, maxX, maxY];
  const [r, g, b] = INK_RGB[mark.ink];
  const [x1, y1] = local(mark.from, minX, minY);
  const [x2, y2] = local(mark.to, minX, minY);
  const body = `q\n${paint([r, g, b])}\n${arrowDraw(x1, y1, x2, y2)}\nQ`;
  return doc.context.obj({
    ...common(doc, page, mark, rect, [r, g, b]),
    Subtype: PDFName.of("Line"),
    L: [mark.from.x, mark.from.y, mark.to.x, mark.to.y],
    LE: [PDFName.of("None"), PDFName.of("OpenArrow")],
    BS: doc.context.obj({ W: 1.6, S: PDFName.of("S") }),
    AP: appearance(doc, rect, body),
  });
}

function makeCallout(doc: PDFDocument, page: PDFPage, mark: Mark) {
  const box = mark.quads[0];
  if (!box) return null;
  const tip = mark.to ?? { x: box.x + box.w / 2, y: box.y + box.h };
  const edge = edgeToward(box, tip);
  const pad = 8;
  const minX = Math.min(box.x, tip.x) - pad;
  const minY = Math.min(box.y, tip.y) - pad;
  const maxX = Math.max(box.x + box.w, tip.x) + pad;
  const maxY = Math.max(box.y + box.h, tip.y) + pad;
  const rect = [minX, minY, maxX, maxY];
  const [r, g, b] = INK_RGB[mark.ink];
  const [x1, y1] = local(edge, minX, minY);
  const [x2, y2] = local(tip, minX, minY);
  const left = box.x - minX;
  const bottom = box.y - minY;
  const body = [
    "q",
    paint([r, g, b]),
    arrowDraw(x1, y1, x2, y2),
    `${num(left)} ${num(bottom)} ${num(box.w)} ${num(box.h)} re S`,
    "Q",
  ].join("\n");
  return doc.context.obj({
    ...common(doc, page, mark, rect, [r, g, b]),
    Subtype: PDFName.of("FreeText"),
    IT: PDFName.of("FreeTextCallout"),
    CL: [tip.x, tip.y, edge.x, edge.y],
    LE: PDFName.of("OpenArrow"),
    RD: [box.x - minX, box.y - minY, maxX - (box.x + box.w), maxY - (box.y + box.h)],
    BS: doc.context.obj({ W: 1.4, S: PDFName.of("S") }),
    DA: PDFString.of("0 0 0 rg"),
    AP: appearance(doc, rect, body),
  });
}

function makeAnnot(doc: PDFDocument, page: PDFPage, mark: Mark): PDFDict | null {
  if (mark.kind === "arrow") return makeLine(doc, page, mark);
  if (mark.kind === "callout") return makeCallout(doc, page, mark);
  if (!mark.quads.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const quadPoints: number[] = [];
  for (const quad of mark.quads) {
    const left = quad.x;
    const bottom = quad.y;
    const right = quad.x + quad.w;
    const top = quad.y + quad.h;
    minX = Math.min(minX, left);
    minY = Math.min(minY, bottom);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, top);
    // PDF.js / Acrobat order: top-left, top-right, bottom-left, bottom-right.
    quadPoints.push(left, top, right, top, left, bottom, right, bottom);
  }
  if (!Number.isFinite(minX) || maxX - minX < 0.2 || maxY - minY < 0.2) return null;
  const pad = 1;
  const [r, g, b] = INK_RGB[mark.ink];
  const subtype = mark.kind === "highlight" ? "Highlight" : mark.kind === "underline" ? "Underline" : "StrikeOut";
  return doc.context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of(subtype),
    Rect: [minX - pad, minY - pad, maxX + pad, maxY + pad],
    QuadPoints: quadPoints,
    C: [r, g, b],
    CA: mark.kind === "highlight" ? 0.45 : 1,
    F: 4,
    Border: [0, 0, 0],
    Contents: PDFHexString.fromText(formatContents(mark)),
    T: PDFHexString.fromText("Quire"),
    Subj: PDFHexString.fromText(labelName(mark.label)),
    NM: PDFHexString.fromText(`quire-${mark.id}`),
    M: PDFString.of(pdfDate(Date.now())),
    CreationDate: PDFString.of(pdfDate(mark.createdAt)),
    P: page.ref,
  });
}

export async function embedMarks(
  original: Uint8Array,
  marks: Mark[],
  importedSourceIds: string[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const drop = new Set(importedSourceIds);
  const byPage = new Map<number, Mark[]>();
  for (const mark of marks) {
    const list = byPage.get(mark.page) ?? [];
    list.push(mark);
    byPage.set(mark.page, list);
  }
  doc.getPages().forEach((page, index) => {
    const kept: PDFRef[] = [];
    const existing = page.node.Annots();
    if (existing) {
      for (let indexAnnot = 0; indexAnnot < existing.size(); indexAnnot += 1) {
        const entry = existing.get(indexAnnot);
        if (entry instanceof PDFRef && drop.has(`${entry.objectNumber}R`)) continue;
        if (entry instanceof PDFRef) kept.push(entry);
      }
    }
    const next = doc.context.obj([]);
    for (const ref of kept) next.push(ref);
    for (const mark of byPage.get(index + 1) ?? []) {
      const annot = makeAnnot(doc, page, mark);
      if (annot) next.push(doc.context.register(annot));
    }
    page.node.set(PDFName.of("Annots"), next);
  });
  return doc.save();
}

/** Pages that carry marks, in order, with those marks written in. */
export async function markedPagesPdf(
  original: Uint8Array,
  marks: Mark[],
  importedSourceIds: string[],
): Promise<Uint8Array | null> {
  const pages = [...new Set(marks.map((mark) => mark.page).filter((page) => Number.isInteger(page) && page >= 1))].sort(
    (a, b) => a - b,
  );
  if (!pages.length) return null;
  const embedded = await embedMarks(original, marks, importedSourceIds);
  const source = await PDFDocument.load(embedded, { updateMetadata: false });
  const indexes = pages.filter((page) => page <= source.getPageCount()).map((page) => page - 1);
  if (!indexes.length) return null;
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, indexes);
  for (const page of copied) out.addPage(page);
  return out.save();
}

function changeKind(mark: Mark): string {
  if (mark.kind === "callout" || mark.note.startsWith("Deleted")) return "Deleted";
  if (mark.note.startsWith("Was:")) return "Replaced";
  return "Added";
}

function wrapLine(font: PDFFont, text: string, size: number, max: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (!words[0]) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function summaryPdf(changes: Mark[], laterName: string, earlierName: string | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.09, 0.07);
  const quiet = rgb(0.33, 0.3, 0.26);
  const left = 56;
  const width = 480;
  let page = doc.addPage([595.28, 841.89]);
  let y = 780;
  const ensure = (need: number) => {
    if (y - need >= 56) return;
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  };
  const draw = (text: string, size: number, face: PDFFont, color: ReturnType<typeof rgb>, gap: number) => {
    for (const line of wrapLine(face, text, size, width)) {
      ensure(size + gap);
      page.drawText(line, { x: left, y, size, font: face, color });
      y -= size + gap;
    }
  };
  const count = changes.length;
  const when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  draw("Comparison", 18, bold, ink, 8);
  draw(laterName, 11, font, ink, 3);
  draw(earlierName ? `Earlier copy: ${earlierName}` : "Earlier copy", 10, font, quiet, 3);
  draw(`${count} change${count === 1 ? "" : "s"} · ${when}`, 10, font, quiet, 8);
  draw("The pages after this list are the later copy, with only these changes marked.", 10, font, quiet, 16);
  for (const mark of sortMarks(changes)) {
    ensure(36);
    draw(`Page ${mark.page} · ${changeKind(mark)}`, 12, bold, ink, 4);
    if (mark.quote.trim()) draw(mark.quote.trim(), 10, font, ink, 3);
    if (mark.note.trim()) draw(mark.note.trim(), 10, font, quiet, 12);
    else y -= 8;
  }
  return doc.save();
}

/** A list of the comparison, then only the later pages that changed. */
export async function comparisonResultsPdf(
  later: Uint8Array,
  changes: Mark[],
  laterName: string,
  earlierName: string | null,
): Promise<Uint8Array | null> {
  const body = await markedPagesPdf(later, changes, []);
  if (!body) return null;
  const summary = await summaryPdf(changes, laterName, earlierName);
  const out = await PDFDocument.create();
  const summaryDoc = await PDFDocument.load(summary);
  const bodyDoc = await PDFDocument.load(body);
  const copied = [
    ...(await out.copyPages(summaryDoc, summaryDoc.getPageIndices())),
    ...(await out.copyPages(bodyDoc, bodyDoc.getPageIndices())),
  ];
  for (const page of copied) out.addPage(page);
  out.setTitle(`Comparison — ${laterName}`);
  return out.save();
}
