import { quadsFromPoints } from "@/lib/geometry";
import {
  nearestInk,
  parseNote,
  type Kind,
  type Mark,
  type Point,
  type Quad,
} from "@/lib/marks";

export type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;
export type SearchHit = { page: number; quads: Quad[] };

let loading: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfjs() {
  if (!loading) {
    loading = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return loading;
}

function assetRoot(): string {
  const runtime = (globalThis as { chrome?: { runtime?: { id?: string; getURL?: (path: string) => string } } }).chrome?.runtime;
  if (runtime?.id && runtime.getURL) {
    const root = runtime.getURL("");
    return root.endsWith("/") ? root : `${root}/`;
  }
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export async function openPdf(bytes: Uint8Array): Promise<PdfDoc> {
  const pdfjs = await loadPdfjs();
  const base = assetRoot();
  const task = pdfjs.getDocument({
    data: bytes.slice(0),
    cMapUrl: `${base}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
  });
  return task.promise;
}

const KIND_BY_SUBTYPE: Record<string, Kind> = {
  Highlight: "highlight",
  Underline: "underline",
  StrikeOut: "strikeout",
  Line: "arrow",
  FreeText: "callout",
};

function colorChannels(color: unknown): [number, number, number] | null {
  if (!color || typeof color !== "object") return null;
  const record = color as { 0?: number; 1?: number; 2?: number };
  if (typeof record[0] !== "number" || typeof record[1] !== "number" || typeof record[2] !== "number") {
    return null;
  }
  return [record[0], record[1], record[2]];
}

function pair(value: unknown): [Point, Point] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const [x1, y1, x2, y2] = value;
  if (![x1, y1, x2, y2].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ];
}

function rectQuad(rect: unknown): Quad | null {
  if (!Array.isArray(rect) || rect.length < 4) return null;
  const [x1, y1, x2, y2] = rect;
  if (![x1, y1, x2, y2].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (w < 0.2 || h < 0.2) return null;
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w, h };
}

export async function readExisting(pdf: PdfDoc): Promise<{ marks: Mark[]; ids: string[] }> {
  const marks: Mark[] = [];
  const ids: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const annots = await page.getAnnotations();
    for (const annot of annots as Array<Record<string, unknown>>) {
      const kind = KIND_BY_SUBTYPE[String(annot.subtype)];
      if (!kind) continue;
      const line = pair(annot.lineCoordinates);
      const quads = quadsFromPoints(annot.quadPoints as ArrayLike<number> | null);
      const box = rectQuad(annot.rect);
      if (!quads.length && box && kind !== "arrow") quads.push(box);
      if (kind === "arrow" && !line) continue;
      if (kind === "callout" && !quads.length) continue;
      if (kind !== "arrow" && kind !== "callout" && !quads.length) continue;
      const sourceId = typeof annot.id === "string" ? annot.id : "";
      if (sourceId) ids.push(sourceId);
      const contentsObj = annot.contentsObj as { str?: string } | undefined;
      const parsed = parseNote(typeof contentsObj?.str === "string" ? contentsObj.str : "");
      const channels = colorChannels(annot.color);
      const overlaid = typeof annot.overlaidText === "string" ? annot.overlaidText : "";
      marks.push({
        id: sourceId ? `file-${sourceId}` : crypto.randomUUID(),
        page: pageNumber,
        kind,
        pass: parsed.pass,
        ink: channels ? nearestInk(channels) : parsed.pass === 2 ? "steel" : "brass",
        label: parsed.label,
        note: parsed.note,
        quote: overlaid.replace(/\s+/g, " ").trim(),
        quads,
        from: kind === "arrow" && line ? line[0] : undefined,
        to: kind === "arrow" && line ? line[1] : undefined,
        sourceId: sourceId || undefined,
        createdAt: Date.now(),
      });
    }
  }
  return { marks, ids };
}

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};

export async function searchPdf(pdf: PdfDoc, query: string): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let text = "";
    const spans: { start: number; end: number; x: number; y: number; w: number; h: number }[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const run = item as TextItem;
      const start = text.length;
      text += run.str;
      const height = run.height || Math.hypot(run.transform[2] ?? 0, run.transform[3] ?? 0) || 10;
      spans.push({
        start,
        end: text.length,
        x: run.transform[4] ?? 0,
        y: run.transform[5] ?? 0,
        w: run.width || 0,
        h: height,
      });
      if (run.hasEOL) text += "\n";
    }
    const haystack = text.toLowerCase();
    let from = 0;
    while (from < haystack.length && hits.length < 200) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      const quads: Quad[] = [];
      for (const span of spans) {
        if (span.end <= at || span.start >= end || span.w <= 0) continue;
        const spanLength = Math.max(1, span.end - span.start);
        const overlapStart = Math.max(at, span.start);
        const overlapEnd = Math.min(end, span.end);
        const startRatio = (overlapStart - span.start) / spanLength;
        const endRatio = (overlapEnd - span.start) / spanLength;
        quads.push({
          x: span.x + span.w * startRatio,
          y: span.y,
          w: span.w * (endRatio - startRatio),
          h: span.h,
        });
      }
      if (quads.length) hits.push({ page: pageNumber, quads });
      from = at + Math.max(1, needle.length);
    }
    if (hits.length >= 200) break;
  }
  return hits;
}

export async function pagePlainText(pdf: PdfDoc, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  let text = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const run = item as TextItem;
    if (text && run.str && !/\s$/.test(text) && !/^\s/.test(run.str)) text += " ";
    text += run.str;
    if (run.hasEOL) text += "\n";
  }
  return text.normalize("NFKC");
}
