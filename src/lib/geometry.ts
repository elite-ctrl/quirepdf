import type { Point, Quad } from "@/lib/marks";

export type ViewportLike = {
  convertToPdfPoint: (x: number, y: number) => number[];
  convertToViewportPoint: (x: number, y: number) => number[];
  width?: number;
  height?: number;
};

type Box = { x: number; y: number; w: number; h: number };

export function quadsFromPoints(points: ArrayLike<number> | null | undefined): Quad[] {
  if (!points || points.length < 8) return [];
  const quads: Quad[] = [];
  for (let index = 0; index + 7 < points.length; index += 8) {
    const xs = [points[index], points[index + 2], points[index + 4], points[index + 6]];
    const ys = [points[index + 1], points[index + 3], points[index + 5], points[index + 7]];
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const bottom = Math.min(...ys);
    const top = Math.max(...ys);
    const w = right - left;
    const h = top - bottom;
    if (w > 0.2 && h > 0.2) quads.push({ x: left, y: bottom, w, h });
  }
  return quads;
}

function mergeBoxes(boxes: Box[]): Box[] {
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: Box[] = [];
  for (const box of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...box });
      continue;
    }
    const overlap = Math.min(last.y + last.h, box.y + box.h) - Math.max(last.y, box.y);
    const gap = box.x - (last.x + last.w);
    if (overlap > Math.min(last.h, box.h) * 0.45 && gap < 12) {
      const x1 = Math.min(last.x, box.x);
      const y1 = Math.min(last.y, box.y);
      const x2 = Math.max(last.x + last.w, box.x + box.w);
      const y2 = Math.max(last.y + last.h, box.y + box.h);
      last.x = x1;
      last.y = y1;
      last.w = x2 - x1;
      last.h = y2 - y1;
    } else {
      merged.push({ ...box });
    }
  }
  return merged;
}

function contentOrigin(pageEl: HTMLElement) {
  const box = pageEl.getBoundingClientRect();
  const style = getComputedStyle(pageEl);
  return {
    x: box.left + (parseFloat(style.borderLeftWidth) || 0),
    y: box.top + (parseFloat(style.borderTopWidth) || 0),
  };
}

export function selectionOnPage(
  pageEl: HTMLElement,
  viewport: ViewportLike,
): { quads: Quad[]; quote: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;
  if (!element || !pageEl.contains(element)) return null;
  const quote = range.toString().replace(/\s+/g, " ").trim();
  if (!quote) return null;
  const pageBox = contentOrigin(pageEl);
  const boxes: Box[] = [];
  for (const rect of range.getClientRects()) {
    if (rect.width < 1 || rect.height < 1) continue;
    boxes.push({
      x: rect.left - pageBox.x,
      y: rect.top - pageBox.y,
      w: rect.width,
      h: rect.height,
    });
  }
  const quads = mergeBoxes(boxes)
    .map((box) => {
      const [x1, y1] = viewport.convertToPdfPoint(box.x, box.y);
      const [x2, y2] = viewport.convertToPdfPoint(box.x + box.w, box.y + box.h);
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const bottom = Math.min(y1, y2);
      const top = Math.max(y1, y2);
      return { x: left, y: bottom, w: right - left, h: top - bottom };
    })
    .filter((quad) => quad.w > 0.4 && quad.h > 0.4);
  if (!quads.length) return null;
  return { quads, quote: quote.slice(0, 600) };
}

export function clientToPdf(
  pageEl: HTMLElement,
  viewport: ViewportLike,
  clientX: number,
  clientY: number,
): Point {
  const box = contentOrigin(pageEl);
  const [x, y] = viewport.convertToPdfPoint(clientX - box.x, clientY - box.y);
  return { x, y };
}

export function edgeToward(box: { x: number; y: number; w: number; h: number }, tip: Point): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = tip.x - cx;
  const dy = tip.y - cy;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { x: cx, y: box.y };
  const sx = Math.abs(dx) > 0.01 ? box.w / 2 / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0.01 ? box.h / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(sx, sy);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function quadToView(quad: Quad, viewport: ViewportLike) {
  const [x1, y1] = viewport.convertToViewportPoint(quad.x, quad.y);
  const [x2, y2] = viewport.convertToViewportPoint(quad.x + quad.w, quad.y + quad.h);
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
