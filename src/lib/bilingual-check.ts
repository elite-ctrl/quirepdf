import type { PdfDoc } from "@/lib/pdf-client";
import type { Mark, Quad } from "@/lib/marks";

export type SideGap = { raw: string; extra: number };

export type FormatGap = { raw: string; note: string; at: number };

export type PairCheck = {
  page: number;
  sourcePage: number | null;
  targetPage: number | null;
  datesSource: SideGap[];
  datesTarget: SideGap[];
  figuresSource: SideGap[];
  figuresTarget: SideGap[];
  formats: FormatGap[];
};

type Face = { bold: boolean; italic: boolean };

type Token = { kind: "date" | "figure"; key: string; raw: string; bold: boolean; italic: boolean };

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";

function iso(year: number, month: number, day: number): string | null {
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthOf(name: string): number {
  return MONTHS[name.toLowerCase().replace(/\.$/, "")] ?? 0;
}

function canonicalNumber(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1e6) / 1e6;
  if (Object.is(rounded, -0)) return "0";
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

function scaleOf(word: string | undefined): number {
  if (!word) return 1;
  const name = word.replace(/\s+/g, "").toLowerCase();
  if (name === "million" || name === "mn" || name === "百萬" || name === "百万") return 1e6;
  if (name === "billion" || name === "bn" || name === "十億" || name === "十亿") return 1e9;
  if (name === "萬" || name === "万") return 1e4;
  if (name === "億" || name === "亿") return 1e8;
  if (name === "cent" || name === "cents" || name === "仙") return 0.01;
  return 1;
}

function percentOf(word: string | undefined): boolean {
  if (!word) return false;
  return /%|％|个百分点|percent/.test(word.toLowerCase());
}

function styleOf(faces: Face[] | undefined, start: number, end: number): Face {
  if (!faces) return { bold: false, italic: false };
  let bold = 0;
  let italic = 0;
  let count = 0;
  for (let index = start; index < end; index += 1) {
    const face = faces[index];
    if (!face) continue;
    count += 1;
    if (face.bold) bold += 1;
    if (face.italic) italic += 1;
  }
  if (!count) return { bold: false, italic: false };
  return { bold: bold * 2 >= count, italic: italic * 2 >= count };
}

function isCjk(char: string): boolean {
  return /[\u3400-\u9FFF]/.test(char);
}

function tighten(piece: string): string {
  return piece
    .replace(/(\d)\s+(?=\d)/g, "$1")
    .replace(/(\d)\s+(?=[,，.年月日%％])/g, "$1")
    .replace(/([,，.年月日])\s+(?=\d)/g, "$1");
}

function glued(text: string, piece: string): boolean {
  const left = text.trimEnd().at(-1) ?? "";
  const right = piece.trimStart()[0] ?? "";
  if (!left || !right) return false;
  if (isCjk(left) || isCjk(right)) return true;
  if (/\d/.test(left) && /[\d,，.%％年月日]/.test(right)) return true;
  if (/[,，.年月日]/.test(left) && /\d/.test(right)) return true;
  if (/[([［【]/.test(left) && /\d/.test(right)) return true;
  if (left === "." && /\d/.test(right) && !/\d/.test(text.trimEnd().at(-2) ?? "")) return true;
  return false;
}

function blankFurniture(text: string): string {
  const wipe = (pattern: RegExp) => {
    text = text.replace(pattern, (match) => " ".repeat(match.length));
  };
  wipe(/File:[\s\S]*?request\)/g);
  wipe(/[–—]\s*\d+\s*[–—]/g);
  wipe(/\bLR\s*[\d.A-Za-z]+(?:\s*\(\d+\))?/g);
  wipe(/\bBL:\s*\([^)]*\)(?:\s*\/\s*\([^)]*\))?/g);
  wipe(/\b\d+\s*\(W\)\s*x\s*\d+\s*\(H\)/gi);
  wipe(/\bNote\s+\d+\s+to\b/g);
  return text;
}

function faceNote(source: Face, target: Face): string {
  const parts: string[] = [];
  if (source.bold !== target.bold) parts.push(source.bold ? "Source is bold." : "Source is not bold.");
  if (source.italic !== target.italic) parts.push(source.italic ? "Source is italic." : "Source is not italic.");
  return parts.join(" ");
}

function styleKey(face: Face): string {
  return `${face.bold ? "b" : ""}${face.italic ? "i" : ""}` || "r";
}

export function tokensIn(source: string, faces?: Face[]): Token[] {
  const text = blankFurniture(source.normalize("NFKC"));
  const tokens: Token[] = [];
  const mask = new Array(text.length).fill(false);
  const dates: Array<{ re: RegExp; key: (match: RegExpMatchArray) => string | null }> = [
    {
      re: /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
      key: (match) => iso(+match[1], +match[2], +match[3]),
    },
    {
      re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\.?\\s+(\\d{4})\\b`, "gi"),
      key: (match) => iso(+match[3], monthOf(match[2]), +match[1]),
    },
    {
      re: new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
      key: (match) => iso(+match[3], monthOf(match[1]), +match[2]),
    },
    {
      re: /\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/g,
      key: (match) => iso(+match[1], +match[2], +match[3]),
    },
    {
      re: /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g,
      key: (match) => iso(+match[3], +match[2], +match[1]),
    },
    {
      re: /(\d{4})\s*年\s*(\d{1,2})\s*月/g,
      key: (match) => {
        const month = +match[2];
        const year = +match[1];
        if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
        return `${year}-${String(month).padStart(2, "0")}`;
      },
    },
  ];
  for (const pattern of dates) {
    for (const match of text.matchAll(pattern.re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (mask.slice(start, end).some(Boolean)) continue;
      const key = pattern.key(match);
      if (!key) continue;
      mask.fill(true, start, end);
      tokens.push({ kind: "date", key, raw: match[0].replace(/\s+/g, " ").trim(), ...styleOf(faces, start, end) });
    }
  }

  const equated = [
    { re: /十二\s*個?\s*月/g, key: "12" },
    { re: /\b12\s*[-‐‑–—]\s*months?\b/gi, key: "12" },
  ];
  for (const pattern of equated) {
    for (const match of text.matchAll(pattern.re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (mask.slice(start, end).some(Boolean)) continue;
      mask.fill(true, start, end);
      tokens.push({
        kind: "figure",
        key: pattern.key,
        raw: match[0].replace(/\s+/g, " ").trim(),
        ...styleOf(faces, start, end),
      });
    }
  }

  const bare = [...text].map((char, index) => (mask[index] ? " " : char)).join("");
  const figure =
    /(?:^|[^\d.]|(?<=\D)\.)((?:HK\$|US\$|USD|HKD|RMB|CNY|EUR|GBP|[$£€¥])?\s*(?:\d{1,3}(?:[,，]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:十[亿億]|百[万萬]|[亿億]|[万萬]|million|billion|mn|bn|cents?|仙|%|％|个百分点|per\s*cent)?\)?)/gi;
  for (const match of bare.matchAll(figure)) {
    const raw = match[1].replace(/\s+/g, " ").trim();
    const body = raw.replace(/[()]/g, "");
    const parts = body.match(
      /^(?:HK\$|US\$|USD|HKD|RMB|CNY|EUR|GBP|[$£€¥])?\s*(\d{1,3}(?:[,，]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(.*)$/i,
    );
    if (!parts) continue;
    const magnitude = Number(parts[1].replace(/[,，]/g, ""));
    if (!Number.isFinite(magnitude)) continue;
    const tail = parts[2] ?? "";
    const negative = raw.startsWith("(") && raw.endsWith(")");
    const value = magnitude * scaleOf(tail) * (negative ? -1 : 1);
    const key = percentOf(tail) ? `${canonicalNumber(value)}%` : canonicalNumber(value);
    if (!key) continue;
    const start = (match.index ?? 0) + match[0].length - match[1].length;
    tokens.push({ kind: "figure", key, raw: raw.replace(/[()]/g, ""), ...styleOf(faces, start, start + match[1].length) });
  }
  return tokens;
}

function gaps(source: Token[], target: Token[], kind: Token["kind"]): { source: SideGap[]; target: SideGap[] } {
  const tally = (list: Token[]) => {
    const map = new Map<string, { count: number; raw: string }>();
    for (const token of list) {
      if (token.kind !== kind) continue;
      const current = map.get(token.key);
      if (current) current.count += 1;
      else map.set(token.key, { count: 1, raw: token.raw });
    }
    return map;
  };
  const a = tally(source);
  const b = tally(target);
  const only = (from: Map<string, { count: number; raw: string }>, other: Map<string, { count: number; raw: string }>) => {
    const found: SideGap[] = [];
    for (const [key, item] of from) {
      const extra = item.count - (other.get(key)?.count ?? 0);
      if (extra > 0) found.push({ raw: item.raw, extra });
    }
    return found;
  };
  return { source: only(a, b), target: only(b, a) };
}

export function compareSides(
  sourceText: string,
  targetText: string,
  sourceFaces?: Face[],
  targetFaces?: Face[],
): Pick<PairCheck, "datesSource" | "datesTarget" | "figuresSource" | "figuresTarget" | "formats"> {
  const source = tokensIn(sourceText, sourceFaces);
  const target = tokensIn(targetText, targetFaces);
  const dates = gaps(source, target, "date");
  const figures = gaps(source, target, "figure");
  const styled = [...styleGaps(source, target, "date"), ...styleGaps(source, target, "figure")];
  const covered = new Set(styled.map((item) => item.raw));
  const formats = [
    ...styled,
    ...wordStyleGaps(sourceText, sourceFaces, targetText, targetFaces).filter(
      (item) => ![...covered].some((raw) => raw === item.raw || raw.includes(item.raw)),
    ),
  ];
  return {
    datesSource: dates.source,
    datesTarget: dates.target,
    figuresSource: figures.source,
    figuresTarget: figures.target,
    formats,
  };
}

function styleGaps(source: Token[], target: Token[], kind: Token["kind"]): FormatGap[] {
  const grouped = (list: Token[]) => {
    const map = new Map<string, Token[]>();
    for (const token of list) {
      if (token.kind !== kind) continue;
      const bucket = map.get(token.key) ?? [];
      bucket.push(token);
      map.set(token.key, bucket);
    }
    return map;
  };
  const from = grouped(source);
  const found: FormatGap[] = [];
  for (const [key, targetList] of grouped(target)) {
    const sourceList = from.get(key);
    if (!sourceList?.length) continue;
    const paired = Math.min(sourceList.length, targetList.length);
    const seen = new Map<string, number>();
    for (let index = 0; index < targetList.length; index += 1) {
      const token = targetList[index];
      const at = seen.get(token.raw) ?? 0;
      seen.set(token.raw, at + 1);
      if (index >= paired) continue;
      const note = faceNote(sourceList[index], token);
      if (note) found.push({ raw: token.raw, note, at });
    }
  }
  return found;
}

function worthStyle(text: string): boolean {
  const flat = text.trim();
  if (flat.length < 2) return false;
  if (/^[\d,，.]+$/.test(flat)) return false;
  if (/^[A-Za-z]{1,2}$/.test(flat)) return false;
  return /[A-Za-z\u3400-\u9FFF]/.test(flat);
}

function wordStyleGaps(sourceText: string, sourceFaces: Face[] | undefined, targetText: string, targetFaces: Face[] | undefined): FormatGap[] {
  const words = (text: string, faces?: Face[]) => {
    const list: Array<Face & { text: string }> = [];
    for (const match of text.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const token = match[0];
      if (!worthStyle(token)) continue;
      list.push({ text: token, ...styleOf(faces, start, start + token.length) });
    }
    return list;
  };
  const pools = new Map<string, Face[]>();
  for (const word of words(sourceText, sourceFaces)) {
    const bucket = pools.get(word.text) ?? [];
    bucket.push(word);
    pools.set(word.text, bucket);
  }
  const seen = new Map<string, number>();
  const found: FormatGap[] = [];
  for (const word of words(targetText, targetFaces)) {
    const at = seen.get(word.text) ?? 0;
    seen.set(word.text, at + 1);
    const pool = pools.get(word.text);
    if (!pool?.length) continue;
    const key = styleKey(word);
    const matchAt = pool.findIndex((face) => styleKey(face) === key);
    if (matchAt >= 0) {
      pool.splice(matchAt, 1);
      continue;
    }
    const sourceFace = pool.shift();
    if (!sourceFace) continue;
    const note = faceNote(sourceFace, word);
    if (note) found.push({ raw: word.text, note, at });
  }
  return found;
}

type FontRecord = { bold?: boolean; italic?: boolean; black?: boolean };

async function readStyled(pdf: PdfDoc, pageNumber: number): Promise<{ text: string; faces: Face[] }> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const objs = page.commonObjs;
  const cache = new Map<string, Face>();
  const faceOf = (fontName: string | undefined): Face => {
    if (!fontName) return { bold: false, italic: false };
    const cached = cache.get(fontName);
    if (cached) return cached;
    let face: Face = { bold: false, italic: false };
    try {
      const font = objs.get(fontName) as FontRecord;
      face = { bold: !!(font?.bold || font?.black), italic: !!font?.italic };
    } catch {
      face = { bold: false, italic: false };
    }
    cache.set(fontName, face);
    return face;
  };
  let text = "";
  const faces: Face[] = [];
  let pendingSpace = false;
  const push = (piece: string, face: Face) => {
    text += piece;
    for (let index = 0; index < piece.length; index += 1) faces.push(face);
  };
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const run = item as TextRun;
    const piece = tighten(run.str.normalize("NFKC"));
    const face = faceOf(run.fontName);
    if (!piece.trim()) {
      pendingSpace = true;
      if (run.hasEOL) push("\n", { bold: false, italic: false });
      continue;
    }
    if (pendingSpace && text && !glued(text, piece)) push(" ", { bold: false, italic: false });
    pendingSpace = false;
    push(piece, face);
    if (run.hasEOL) push("\n", { bold: false, italic: false });
  }
  return { text: blankFurniture(text), faces };
}

function counts(pages: Map<number, Token[]>, kind: Token["kind"]): Map<string, number> {
  const map = new Map<string, number>();
  for (const list of pages.values()) {
    for (const token of list) {
      if (token.kind !== kind) continue;
      map.set(token.key, (map.get(token.key) ?? 0) + 1);
    }
  }
  return map;
}

function extrasByPage(pages: Map<number, Token[]>, other: Map<string, number>, kind: Token["kind"]): Map<number, SideGap[]> {
  const budget = new Map(other);
  const found = new Map<number, SideGap[]>();
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    for (const token of pages.get(page) ?? []) {
      if (token.kind !== kind) continue;
      const left = budget.get(token.key) ?? 0;
      if (left > 0) {
        budget.set(token.key, left - 1);
        continue;
      }
      const list = found.get(page) ?? [];
      const same = list.find((item) => item.raw === token.raw);
      if (same) same.extra += 1;
      else list.push({ raw: token.raw, extra: 1 });
      found.set(page, list);
    }
  }
  return found;
}

function park(gaps: Map<number, SideGap[]>, limit: number): Map<number, SideGap[]> {
  const parked = new Map<number, SideGap[]>();
  for (const [page, list] of gaps) {
    const dest = page <= limit ? page : 1;
    const current = parked.get(dest) ?? [];
    current.push(...list);
    parked.set(dest, current);
  }
  return parked;
}

export async function checkBilingual(source: PdfDoc, target: PdfDoc): Promise<PairCheck[]> {
  const count = Math.max(source.numPages, target.numPages);
  const pages = Array.from({ length: count }, (_, index) => index + 1);
  const sourceText = new Map<number, { text: string; faces: Face[] }>();
  const targetText = new Map<number, { text: string; faces: Face[] }>();
  await Promise.all([
    ...pages.filter((page) => page <= source.numPages).map(async (page) => {
      sourceText.set(page, await readStyled(source, page));
    }),
    ...pages.filter((page) => page <= target.numPages).map(async (page) => {
      targetText.set(page, await readStyled(target, page));
    }),
  ]);
  const sourceTokens = new Map<number, Token[]>();
  const targetTokens = new Map<number, Token[]>();
  for (const [page, value] of sourceText) sourceTokens.set(page, tokensIn(value.text, value.faces));
  for (const [page, value] of targetText) targetTokens.set(page, tokensIn(value.text, value.faces));
  const sourceDates = park(extrasByPage(sourceTokens, counts(targetTokens, "date"), "date"), target.numPages);
  const targetDates = extrasByPage(targetTokens, counts(sourceTokens, "date"), "date");
  const sourceFigures = park(extrasByPage(sourceTokens, counts(targetTokens, "figure"), "figure"), target.numPages);
  const targetFigures = extrasByPage(targetTokens, counts(sourceTokens, "figure"), "figure");
  return pages.map((page) => {
    const sourcePage = page <= source.numPages ? page : null;
    const targetPage = page <= target.numPages ? page : null;
    const formats =
      sourcePage && targetPage
        ? compareSides(
            sourceText.get(page)?.text ?? "",
            targetText.get(page)?.text ?? "",
            sourceText.get(page)?.faces,
            targetText.get(page)?.faces,
          ).formats
        : [];
    return {
      page,
      sourcePage,
      targetPage,
      datesSource: targetPage ? (sourceDates.get(page) ?? []) : [],
      datesTarget: targetPage ? (targetDates.get(page) ?? []) : [],
      figuresSource: targetPage ? (sourceFigures.get(page) ?? []) : [],
      figuresTarget: targetPage ? (targetFigures.get(page) ?? []) : [],
      formats,
    };
  });
}

type TextRun = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
  fontName?: string;
};

type Span = { start: number; end: number; x: number; y: number; w: number; h: number };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expand(list: SideGap[]): string[] {
  const raws: string[] = [];
  for (const item of list) {
    const times = Math.max(1, Math.round(item.extra));
    for (let index = 0; index < times; index += 1) raws.push(item.raw);
  }
  return raws;
}

async function pageLayout(pdf: PdfDoc, pageNumber: number): Promise<{ text: string; spans: Span[]; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  let text = "";
  const spans: Span[] = [];
  let pendingSpace = false;
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const run = item as TextRun;
    const piece = tighten(run.str.normalize("NFKC"));
    if (!piece.trim()) {
      pendingSpace = true;
      if (run.hasEOL) text += "\n";
      continue;
    }
    if (pendingSpace && text && !glued(text, piece)) text += " ";
    pendingSpace = false;
    if (piece) {
      const start = text.length;
      text += piece;
      const height = run.height || Math.hypot(run.transform[2] ?? 0, run.transform[3] ?? 0) || 10;
      spans.push({
        start,
        end: text.length,
        x: run.transform[4] ?? 0,
        y: run.transform[5] ?? 0,
        w: run.width || Math.max(4, piece.length * height * 0.45),
        h: height,
      });
    }
    if (run.hasEOL) text += "\n";
  }
  return { text: blankFurniture(text), spans, width: viewport.width, height: viewport.height };
}

function locate(text: string, spans: Span[], raw: string): Quad[][] {
  const parts = raw.normalize("NFKC").trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!parts.length) return [];
  const found: Quad[][] = [];
  for (const match of text.matchAll(new RegExp(parts.join("\\s+"), "g"))) {
    const at = match.index ?? 0;
    const end = at + match[0].length;
    const quads: Quad[] = [];
    for (const span of spans) {
      if (span.end <= at || span.start >= end || span.w <= 0) continue;
      const spanLength = Math.max(1, span.end - span.start);
      const overlapStart = Math.max(at, span.start);
      const overlapEnd = Math.min(end, span.end);
      const startRatio = (overlapStart - span.start) / spanLength;
      const endRatio = (overlapEnd - span.start) / spanLength;
      const w = span.w * (endRatio - startRatio);
      if (w < 0.2) continue;
      quads.push({ x: span.x + span.w * startRatio, y: span.y, w, h: span.h });
    }
    if (quads.length) found.push(quads);
  }
  return found;
}

function figureId(): string {
  return `figure-${crypto.randomUUID()}`;
}

function markText(page: number, quads: Quad[], quote: string, note: string, ink: "brass" | "steel", label: "number" | "style", kind: "highlight" | "underline"): Mark {
  return {
    id: figureId(),
    page,
    kind,
    pass: 1,
    ink,
    label,
    note,
    quote,
    quads,
    createdAt: Date.now(),
  };
}

function callout(page: number, note: string, box: Quad, tip: { x: number; y: number }, ink: "brass" | "steel", label: "number" | "style"): Mark {
  return {
    id: figureId(),
    page,
    kind: "callout",
    pass: 1,
    ink,
    label,
    note,
    quote: note,
    quads: [box],
    to: tip,
    createdAt: Date.now(),
  };
}

function placeCallout(
  page: number,
  note: string,
  anchor: Quad | null,
  width: number,
  height: number,
  stack: number,
  ink: "brass" | "steel" = "brass",
  label: "number" | "style" = "number",
): Mark {
  const boxW = 210;
  const boxH = 36;
  if (anchor) {
    let x = anchor.x;
    let y = anchor.y + anchor.h + 8 + stack * 40;
    if (y + boxH > height - 12) y = Math.max(12, anchor.y - boxH - 8 - stack * 40);
    if (x + boxW > width - 12) x = Math.max(12, width - boxW - 12);
    return callout(page, note, { x, y, w: boxW, h: boxH }, { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2 }, ink, label);
  }
  const y = Math.max(36, height - 56 - stack * 44);
  return callout(page, note, { x: 36, y, w: boxW, h: boxH }, { x: 48, y: y - 10 }, ink, label);
}

/** Marks the discrepant wording on the target. A callout is used only when that wording is not on the page. */
export async function marksOnTarget(target: PdfDoc, pairs: PairCheck[]): Promise<Mark[]> {
  const marks: Mark[] = [];
  for (const pair of pairs) {
    if (marks.length >= 200) break;
    if (pair.targetPage === null) continue;
    const layout = await pageLayout(target, pair.targetPage);
    const cache = new Map<string, Quad[][]>();
    const used = new Map<string, number>();
    const take = (raw: string): Quad[] | null => {
      const found = cache.get(raw) ?? locate(layout.text, layout.spans, raw);
      if (!cache.has(raw)) cache.set(raw, found);
      const index = used.get(raw) ?? 0;
      used.set(raw, index + 1);
      return found[index] ?? null;
    };
    let stack = 0;
    const add = (kind: "Date" | "Figure", sourceRaws: string[], targetRaws: string[]) => {
      const paired = Math.min(sourceRaws.length, targetRaws.length);
      for (let index = 0; index < targetRaws.length; index += 1) {
        if (marks.length >= 200) return;
        const raw = targetRaws[index];
        const note = index < paired ? `Source ${kind.toLowerCase()}: ${sourceRaws[index]}` : "Not on the source.";
        const quads = take(raw);
        if (quads) marks.push(markText(pair.targetPage as number, quads, raw, note, "brass", "number", "highlight"));
        else marks.push(placeCallout(pair.targetPage as number, `Target ${kind.toLowerCase()}: ${raw}. ${note}`, null, layout.width, layout.height, stack));
        stack += 1;
      }
      for (let index = paired; index < sourceRaws.length; index += 1) {
        if (marks.length >= 200) return;
        marks.push(
          placeCallout(
            pair.targetPage as number,
            `Source ${kind.toLowerCase()}: ${sourceRaws[index]}`,
            null,
            layout.width,
            layout.height,
            stack,
          ),
        );
        stack += 1;
      }
    };
    add("Date", expand(pair.datesSource), expand(pair.datesTarget));
    add("Figure", expand(pair.figuresSource), expand(pair.figuresTarget));
    for (const item of pair.formats) {
      if (marks.length >= 200) break;
      const found = cache.get(item.raw) ?? locate(layout.text, layout.spans, item.raw);
      if (!cache.has(item.raw)) cache.set(item.raw, found);
      const quads = found[item.at] ?? null;
      if (quads) marks.push(markText(pair.targetPage, quads, item.raw, item.note, "steel", "style", "underline"));
      else marks.push(placeCallout(pair.targetPage, `${item.raw}. ${item.note}`, null, layout.width, layout.height, stack, "steel", "style"));
      stack += 1;
    }
  }
  return marks;
}

