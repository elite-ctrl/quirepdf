import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clientToPdf, edgeToward, quadToView, type ViewportLike } from "@/lib/geometry";
import { labelName, type Mark, type Point, type Tool } from "@/lib/marks";
import { loadPdfjs, type SearchHit } from "@/lib/pdf-client";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;

export type ShapePlace =
  | { kind: "arrow"; from: Point; to: Point }
  | { kind: "callout"; quad: { x: number; y: number; w: number; h: number }; tip: Point };

type DragMode = "body" | "from" | "to" | "box";

type Props = {
  pdf: PdfDoc;
  pageNumber: number;
  scale: number;
  marks: Mark[];
  hits: SearchHit[];
  activeHit: number;
  activeId: string | null;
  tool: Tool;
  eager?: boolean;
  pane?: "work" | "mate";
  domId: string;
  onPick: (id: string) => void;
  onViewport: (page: number, viewport: ViewportLike) => void;
  onPlace?: (page: number, place: ShapePlace) => void;
  onGestureStart?: () => void;
  onGestureMove?: (id: string, patch: Partial<Mark>) => void;
  onGestureEnd?: (moved: boolean) => void;
};

function arrowPoints(tipX: number, tipY: number, fromX: number, fromY: number, size = 12) {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const left = angle + Math.PI * 0.84;
  const right = angle - Math.PI * 0.84;
  return `${tipX},${tipY} ${tipX + Math.cos(left) * size},${tipY + Math.sin(left) * size} ${tipX + Math.cos(right) * size},${tipY + Math.sin(right) * size}`;
}

export function PdfPage({
  pdf,
  pageNumber,
  scale,
  marks,
  hits,
  activeHit,
  activeId,
  tool,
  eager = false,
  pane = "work",
  domId,
  onPick,
  onViewport,
  onPlace,
  onGestureStart,
  onGestureMove,
  onGestureEnd,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const onViewportRef = useRef(onViewport);
  const viewportRef = useRef<ViewportLike | null>(null);
  const placeRef = useRef(onPlace);
  const startRef = useRef(onGestureStart);
  const moveRef = useRef(onGestureMove);
  const endRef = useRef(onGestureEnd);
  const toolRef = useRef(tool);
  onViewportRef.current = onViewport;
  placeRef.current = onPlace;
  startRef.current = onGestureStart;
  moveRef.current = onGestureMove;
  endRef.current = onGestureEnd;
  toolRef.current = tool;
  const [near, setNear] = useState(eager || pageNumber === 1);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [viewport, setViewport] = useState<ViewportLike | null>(null);
  const [noText, setNoText] = useState(false);
  const [sketch, setSketch] = useState<{ start: Point; current: Point } | null>(null);
  const gesture = useRef<
    | { type: "draw"; start: Point; current: Point; moved: boolean }
    | { type: "drag"; id: string; mode: DragMode; origin: Point; mark: Mark; moved: boolean }
    | null
  >(null);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "900px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancel = false;
    void pdf.getPage(pageNumber).then((page) => {
      if (cancel) return;
      const view = page.getViewport({ scale: 1 });
      setBase({ w: view.width, h: view.height });
    });
    return () => {
      cancel = true;
    };
  }, [near, pdf, pageNumber]);

  useEffect(() => {
    if (!near || !base) return;
    const canvas = canvasRef.current;
    const textEl = textRef.current;
    if (!canvas || !textEl) return;
    const job = {
      cancel: false,
      render: null as { cancel: () => void; promise: Promise<unknown> } | null,
      text: null as { cancel: () => void; render: () => Promise<unknown> } | null,
    };

    void (async () => {
      const pdfjs = await loadPdfjs();
      if (job.cancel) return;
      const page = await pdf.getPage(pageNumber);
      if (job.cancel) return;
      const view = page.getViewport({ scale });
      setViewport(view);
      viewportRef.current = view;
      onViewportRef.current(pageNumber, view);
      const context = canvas.getContext("2d");
      if (!context || job.cancel) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(view.width * ratio);
      canvas.height = Math.floor(view.height * ratio);
      const renderTask = page.render({
        canvas,
        viewport: view,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        annotationMode: pdfjs.AnnotationMode.DISABLE,
      });
      job.render = renderTask;
      if (job.cancel) {
        renderTask.cancel();
        return;
      }
      textEl.replaceChildren();
      const textContent = await page.getTextContent();
      if (job.cancel) return;
      const strings = textContent.items.filter((item) => "str" in item && String(item.str).trim().length > 0);
      setNoText(strings.length === 0);
      const textLayer = new pdfjs.TextLayer({
        textContentSource: textContent,
        container: textEl,
        viewport: view,
      });
      job.text = textLayer;
      if (job.cancel) {
        textLayer.cancel();
        return;
      }
      try {
        await Promise.all([renderTask.promise, textLayer.render()]);
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (!job.cancel && name !== "RenderingCancelledException") throw error;
      }
    })();

    return () => {
      job.cancel = true;
      job.render?.cancel();
      job.text?.cancel();
    };
  }, [near, base, pdf, pageNumber, scale]);

  function pointFrom(event: { clientX: number; clientY: number }): Point | null {
    const pageEl = shellRef.current;
    const view = viewportRef.current;
    if (!pageEl || !view) return null;
    return clientToPdf(pageEl, view, event.clientX, event.clientY);
  }

  function finishGesture() {
    const current = gesture.current;
    gesture.current = null;
    setSketch(null);
    if (!current) return;
    if (current.type === "draw") {
      const toolNow = toolRef.current;
      const dist = Math.hypot(current.current.x - current.start.x, current.current.y - current.start.y);
      if (toolNow === "arrow") {
        if (dist < 6) return;
        placeRef.current?.(pageNumber, { kind: "arrow", from: current.start, to: current.current });
      } else if (toolNow === "callout") {
        const tip = current.start;
        const center = dist < 8 ? { x: tip.x + 78, y: tip.y + 42 } : current.current;
        const quad = clampQuad({ x: center.x - 74, y: center.y - 28, w: 148, h: 56 }, viewportRef.current);
        placeRef.current?.(pageNumber, { kind: "callout", quad, tip });
      }
      return;
    }
    endRef.current?.(current.moved);
  }

  function listen() {
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;
      const next = pointFrom(event);
      if (!next) return;
      if (current.type === "draw") {
        current.current = next;
        current.moved = true;
        setSketch({ start: current.start, current: next });
        return;
      }
      const dx = next.x - current.origin.x;
      const dy = next.y - current.origin.y;
      if (Math.hypot(dx, dy) > 0.4) current.moved = true;
      if (current.mode === "body" && current.mark.from && current.mark.to) {
        moveRef.current?.(current.id, {
          from: { x: current.mark.from.x + dx, y: current.mark.from.y + dy },
          to: { x: current.mark.to.x + dx, y: current.mark.to.y + dy },
        });
      } else if (current.mode === "from") {
        moveRef.current?.(current.id, { from: next });
      } else if (current.mode === "to") {
        moveRef.current?.(current.id, { to: next });
      } else if (current.mode === "box" && current.mark.quads[0]) {
        const quad = current.mark.quads[0];
        moveRef.current?.(current.id, { quads: [{ ...quad, x: quad.x + dx, y: quad.y + dy }] });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      finishGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function onShellPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (pane === "mate") return;
    const toolNow = toolRef.current;
    if (toolNow !== "arrow" && toolNow !== "callout") return;
    const target = event.target as Element | null;
    if (target?.closest("[data-handle], .quire-callout")) return;
    const start = pointFrom(event);
    if (!start) return;
    event.preventDefault();
    gesture.current = { type: "draw", start, current: start, moved: false };
    setSketch({ start, current: start });
    listen();
  }

  function beginDrag(event: ReactPointerEvent, mark: Mark, mode: DragMode) {
    if (pane === "mate") return;
    const selectedCallout = mark.kind === "callout" && mark.id === activeId;
    if (toolRef.current !== "select" && !selectedCallout) return;
    const origin = pointFrom(event);
    if (!origin) return;
    event.preventDefault();
    event.stopPropagation();
    onPick(mark.id);
    startRef.current?.();
    gesture.current = { type: "drag", id: mark.id, mode, origin, mark, moved: false };
    listen();
  }

  const width = (base?.w ?? 595.28) * scale;
  const height = (base?.h ?? 841.89) * scale;
  const pageMarks = marks.filter((mark) => mark.page === pageNumber);
  const drawing = tool === "arrow" || tool === "callout";
  const viewOf = (point: Point) => {
    if (!viewport) return { x: 0, y: 0 };
    const [x, y] = viewport.convertToViewportPoint(point.x, point.y);
    return { x, y };
  };

  return (
    <div className="mb-8 flex flex-col items-center">
      <div
        ref={shellRef}
        id={domId}
        data-page={pageNumber}
        data-pane={pane}
        onPointerDown={onShellPointerDown}
        className={`quire-page relative bg-paper ${tool === "select" ? "quire-selecting" : ""} ${drawing ? "quire-drawing" : ""}`}
        style={{
          width,
          height,
          ["--scale-factor" as string]: String(scale),
          ["--user-unit" as string]: "1",
          ["--total-scale-factor" as string]: "calc(var(--scale-factor) * var(--user-unit))",
          ["--scale-round-x" as string]: "1px",
          ["--scale-round-y" as string]: "1px",
        }}
      >
        {near && (
          <>
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {viewport && (
              <svg className="quire-marks absolute inset-0 h-full w-full">
                {hits.map((hit, index) =>
                  hit.page === pageNumber
                    ? hit.quads.map((quad, quadIndex) => {
                        const view = quadToView(quad, viewport);
                        const active = index === activeHit;
                        return (
                          <rect
                            key={`hit-${index}-${quadIndex}`}
                            x={view.left}
                            y={view.top}
                            width={view.width}
                            height={view.height}
                            fill="none"
                            stroke="var(--color-brass)"
                            strokeWidth={active ? 2 : 1}
                            strokeDasharray={active ? undefined : "3 2"}
                            opacity={active ? 1 : 0.7}
                          />
                        );
                      })
                    : null,
                )}
                {pageMarks.map((mark) => {
                  const color = `var(--color-${mark.ink})`;
                  const active = mark.id === activeId;
                  if (mark.kind === "arrow" && mark.from && mark.to) {
                    const from = viewOf(mark.from);
                    const to = viewOf(mark.to);
                    return (
                      <g key={mark.id} className="quire-mark">
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="transparent"
                          strokeWidth={16}
                          onPointerDown={(event) => beginDrag(event, mark, "body")}
                        />
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={color}
                          strokeWidth={active ? 2.5 : 2}
                        />
                        <polygon points={arrowPoints(to.x, to.y, from.x, from.y)} fill={color} />
                        {active && (
                          <>
                            <Handle x={from.x} y={from.y} onPointerDown={(event) => beginDrag(event, mark, "from")} />
                            <Handle x={to.x} y={to.y} onPointerDown={(event) => beginDrag(event, mark, "to")} />
                          </>
                        )}
                      </g>
                    );
                  }
                  if (mark.kind === "callout" && mark.quads[0]) {
                    const view = quadToView(mark.quads[0], viewport);
                    const tip = viewOf(mark.to ?? { x: mark.quads[0].x + mark.quads[0].w / 2, y: mark.quads[0].y + mark.quads[0].h });
                    const edge = edgeToward({ x: view.left, y: view.top, w: view.width, h: view.height }, tip);
                    return (
                      <g key={mark.id} className="quire-mark">
                        <line x1={edge.x} y1={edge.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={active ? 2.5 : 2} />
                        <polygon points={arrowPoints(tip.x, tip.y, edge.x, edge.y, 11)} fill={color} />
                        {active && (
                          <Handle
                            x={tip.x}
                            y={tip.y}
                            onPointerDown={(event) => beginDrag(event, mark, "to")}
                          />
                        )}
                      </g>
                    );
                  }
                  return (
                    <g
                      key={mark.id}
                      className="quire-mark"
                      onPointerDown={(event) => {
                        if (tool !== "select") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onPick(mark.id);
                      }}
                    >
                      {mark.quads.map((quad, index) => {
                        const view = quadToView(quad, viewport);
                        return (
                          <g key={index}>
                            {mark.kind === "highlight" ? (
                              <rect
                                x={view.left}
                                y={view.top}
                                width={view.width}
                                height={view.height}
                                fill={color}
                                fillOpacity={active ? 0.5 : 0.34}
                              />
                            ) : (
                              <rect x={view.left} y={view.top} width={view.width} height={view.height} fill="transparent" />
                            )}
                            {mark.kind === "underline" && (
                              <line
                                x1={view.left}
                                x2={view.left + view.width}
                                y1={view.top + view.height - 1}
                                y2={view.top + view.height - 1}
                                stroke={color}
                                strokeWidth={Math.max(1.5, view.height * 0.08)}
                              />
                            )}
                            {mark.kind === "strikeout" && (
                              <line
                                x1={view.left}
                                x2={view.left + view.width}
                                y1={view.top + view.height / 2}
                                y2={view.top + view.height / 2}
                                stroke={color}
                                strokeWidth={Math.max(1.4, view.height * 0.07)}
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
                {sketch && viewport && (
                  <Sketch tool={tool} start={viewOf(sketch.start)} current={viewOf(sketch.current)} />
                )}
              </svg>
            )}
            {viewport &&
              pageMarks.map((mark) => {
                if (mark.kind !== "callout" || !mark.quads[0]) return null;
                const view = quadToView(mark.quads[0], viewport);
                const active = mark.id === activeId;
                return (
                  <div
                    key={mark.id}
                    className={`quire-callout absolute overflow-hidden px-2 py-1${active ? " is-selected" : ""}`}
                    style={{
                      left: view.left,
                      top: view.top,
                      width: Math.max(24, view.width),
                      height: Math.max(20, view.height),
                      borderColor: `var(--color-${mark.ink})`,
                      boxShadow: active ? "3px 3px 0 #000" : undefined,
                      background: active ? "var(--color-stamp)" : "#fff",
                    }}
                    onPointerDown={(event) => beginDrag(event, mark, "box")}
                  >
                    <p className="line-clamp-4 text-xs leading-snug font-semibold text-ink">
                      {mark.note.trim() || labelName(mark.label)}
                    </p>
                  </div>
                );
              })}
            <div ref={textRef} className="quire-text" />
          </>
        )}
      </div>
      {noText && <p className="mt-2 text-center text-sm text-muted">No selectable text on this page.</p>}
    </div>
  );
}

function clampQuad(
  quad: { x: number; y: number; w: number; h: number },
  viewport: ViewportLike | null,
) {
  if (!viewport?.width || !viewport.height) return quad;
  const [x0, y0] = viewport.convertToPdfPoint(0, viewport.height);
  const [x1, y1] = viewport.convertToPdfPoint(viewport.width, 0);
  const minX = Math.min(x0, x1);
  const minY = Math.min(y0, y1);
  const maxX = Math.max(x0, x1);
  const maxY = Math.max(y0, y1);
  return {
    ...quad,
    x: Math.min(Math.max(minX, quad.x), Math.max(minX, maxX - quad.w)),
    y: Math.min(Math.max(minY, quad.y), Math.max(minY, maxY - quad.h)),
  };
}

function Handle({
  x,
  y,
  onPointerDown,
}: {
  x: number;
  y: number;
  onPointerDown: (event: ReactPointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <circle
      data-handle="true"
      cx={x}
      cy={y}
      r={7}
      fill="#fff"
      stroke="#000"
      strokeWidth={2}
      style={{ pointerEvents: "auto" }}
      onPointerDown={onPointerDown}
    />
  );
}

function Sketch({
  tool,
  start,
  current,
}: {
  tool: Tool;
  start: Point;
  current: Point;
}) {
  if (tool === "callout") {
    const left = current.x - 74;
    const top = current.y - 28;
    const edge = edgeToward({ x: left, y: top, w: 148, h: 56 }, start);
    return (
      <g>
        <line x1={edge.x} y1={edge.y} x2={start.x} y2={start.y} stroke="#000" strokeWidth={2} />
        <polygon points={arrowPoints(start.x, start.y, edge.x, edge.y, 11)} fill="#000" />
        <rect x={left} y={top} width={148} height={56} fill="#ffe14a" stroke="#000" strokeWidth={2} />
      </g>
    );
  }
  return (
    <g>
      <line x1={start.x} y1={start.y} x2={current.x} y2={current.y} stroke="#000" strokeWidth={2} />
      <polygon points={arrowPoints(current.x, current.y, start.x, start.y)} fill="#000" />
    </g>
  );
}
