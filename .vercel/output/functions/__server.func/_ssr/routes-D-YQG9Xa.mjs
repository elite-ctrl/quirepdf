import { i as __toESM } from "../_runtime.mjs";
import { t as __esmMin } from "./rolldown-runtime-DkIiUugF.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { S as ArrowUpRight, _ as Files, b as Columns2, c as Search, d as PanelRight, f as MousePointer2, g as GitCompare, h as Highlighter, i as Underline, l as Redo2, m as MessageSquare, n as Upload, o as Trash2, p as Minus, r as Undo2, s as Strikethrough, t as X, u as Plus, v as FileText, x as BookOpen, y as FileDown } from "../_libs/lucide-react.mjs";
import { a as PDFHexString, i as PDFString, n as StandardFonts, o as PDFRef, r as rgb, s as PDFName, t as PDFDocument } from "../_libs/pdf-lib.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-D-YQG9Xa.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function quadsFromPoints(points) {
	if (!points || points.length < 8) return [];
	const quads = [];
	for (let index = 0; index + 7 < points.length; index += 8) {
		const xs = [
			points[index],
			points[index + 2],
			points[index + 4],
			points[index + 6]
		];
		const ys = [
			points[index + 1],
			points[index + 3],
			points[index + 5],
			points[index + 7]
		];
		const left = Math.min(...xs);
		const right = Math.max(...xs);
		const bottom = Math.min(...ys);
		const top = Math.max(...ys);
		const w = right - left;
		const h = top - bottom;
		if (w > .2 && h > .2) quads.push({
			x: left,
			y: bottom,
			w,
			h
		});
	}
	return quads;
}
function mergeBoxes(boxes) {
	const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
	const merged = [];
	for (const box of sorted) {
		const last = merged[merged.length - 1];
		if (!last) {
			merged.push({ ...box });
			continue;
		}
		const overlap = Math.min(last.y + last.h, box.y + box.h) - Math.max(last.y, box.y);
		const gap = box.x - (last.x + last.w);
		if (overlap > Math.min(last.h, box.h) * .45 && gap < 12) {
			const x1 = Math.min(last.x, box.x);
			const y1 = Math.min(last.y, box.y);
			const x2 = Math.max(last.x + last.w, box.x + box.w);
			const y2 = Math.max(last.y + last.h, box.y + box.h);
			last.x = x1;
			last.y = y1;
			last.w = x2 - x1;
			last.h = y2 - y1;
		} else merged.push({ ...box });
	}
	return merged;
}
function selectionOnPage(pageEl, viewport) {
	const selection = window.getSelection();
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
	const range = selection.getRangeAt(0);
	const node = range.commonAncestorContainer;
	const element = node instanceof Element ? node : node.parentElement;
	if (!element || !pageEl.contains(element)) return null;
	const quote = range.toString().replace(/\s+/g, " ").trim();
	if (!quote) return null;
	const pageBox = pageEl.getBoundingClientRect();
	const boxes = [];
	for (const rect of range.getClientRects()) {
		if (rect.width < 1 || rect.height < 1) continue;
		boxes.push({
			x: rect.left - pageBox.left,
			y: rect.top - pageBox.top,
			w: rect.width,
			h: rect.height
		});
	}
	const quads = mergeBoxes(boxes).map((box) => {
		const [x1, y1] = viewport.convertToPdfPoint(box.x, box.y);
		const [x2, y2] = viewport.convertToPdfPoint(box.x + box.w, box.y + box.h);
		const left = Math.min(x1, x2);
		const right = Math.max(x1, x2);
		const bottom = Math.min(y1, y2);
		const top = Math.max(y1, y2);
		return {
			x: left,
			y: bottom,
			w: right - left,
			h: top - bottom
		};
	}).filter((quad) => quad.w > .4 && quad.h > .4);
	if (!quads.length) return null;
	return {
		quads,
		quote: quote.slice(0, 600)
	};
}
function clientToPdf(pageEl, viewport, clientX, clientY) {
	const box = pageEl.getBoundingClientRect();
	const [x, y] = viewport.convertToPdfPoint(clientX - box.left, clientY - box.top);
	return {
		x,
		y
	};
}
function edgeToward(box, tip) {
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	const dx = tip.x - cx;
	const dy = tip.y - cy;
	if (Math.abs(dx) < .01 && Math.abs(dy) < .01) return {
		x: cx,
		y: box.y
	};
	const sx = Math.abs(dx) > .01 ? box.w / 2 / Math.abs(dx) : Infinity;
	const sy = Math.abs(dy) > .01 ? box.h / 2 / Math.abs(dy) : Infinity;
	const scale = Math.min(sx, sy);
	return {
		x: cx + dx * scale,
		y: cy + dy * scale
	};
}
function quadToView(quad, viewport) {
	const [x1, y1] = viewport.convertToViewportPoint(quad.x, quad.y);
	const [x2, y2] = viewport.convertToViewportPoint(quad.x + quad.w, quad.y + quad.h);
	return {
		left: Math.min(x1, x2),
		top: Math.min(y1, y2),
		width: Math.abs(x2 - x1),
		height: Math.abs(y2 - y1)
	};
}
var init_geometry = __esmMin((() => {}));
function readName(pass) {
	return pass === 1 ? "First read" : "Second read";
}
function kindName(kind) {
	return KINDS.find((item) => item.id === kind)?.name ?? "Highlight";
}
function labelName(label) {
	return LABELS.find((item) => item.id === label)?.name ?? "Note";
}
function formatContents(mark) {
	const head = `[${readName(mark.pass)} · ${labelName(mark.label)}]`;
	const note = mark.note.trim();
	return note ? `${head}\n${note}` : head;
}
function parseNote(contents) {
	const match = contents.match(HEADER);
	if (!match) return {
		pass: 1,
		label: "note",
		note: contents.trim()
	};
	const label = LABELS.find((item) => item.name === match[2])?.id ?? "note";
	return {
		pass: match[1] === "Second read" || match[1] === "P2" ? 2 : 1,
		label,
		note: contents.slice(match[0].length).trim()
	};
}
function nearestInk(channels) {
	const [r, g, b] = channels.map((channel) => channel / 255);
	let best = "brass";
	let bestDistance = Infinity;
	for (const ink of INKS) {
		const [ir, ig, ib] = INK_RGB[ink.id];
		const distance = (ir - r) ** 2 + (ig - g) ** 2 + (ib - b) ** 2;
		if (distance < bestDistance) {
			bestDistance = distance;
			best = ink.id;
		}
	}
	return best;
}
function sortMarks(marks) {
	return [...marks].sort((a, b) => {
		if (a.page !== b.page) return a.page - b.page;
		return markTop(b) - markTop(a);
	});
}
function markTop(mark) {
	if (mark.kind === "arrow" && mark.from && mark.to) return Math.max(mark.from.y, mark.to.y);
	const quad = mark.quads[0];
	return quad ? quad.y + quad.h : mark.to?.y ?? 0;
}
function isQuad(value) {
	if (!value || typeof value !== "object") return false;
	const quad = value;
	return [
		quad.x,
		quad.y,
		quad.w,
		quad.h
	].every((n) => typeof n === "number" && Number.isFinite(n));
}
function isPoint(value) {
	if (!value || typeof value !== "object") return false;
	const point = value;
	return typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y);
}
function sanitizeMark(value) {
	if (!value || typeof value !== "object") return null;
	const mark = value;
	if (typeof mark.id !== "string" || typeof mark.page !== "number") return null;
	const kind = KINDS.find((item) => item.id === mark.kind)?.id;
	if (!kind) return null;
	if (mark.pass !== 1 && mark.pass !== 2) return null;
	if (mark.ink !== "brass" && mark.ink !== "steel" && mark.ink !== "crimson") return null;
	const label = LABELS.find((item) => item.id === mark.label)?.id;
	if (!label) return null;
	if (typeof mark.note !== "string" || typeof mark.quote !== "string") return null;
	if (!Array.isArray(mark.quads) || !mark.quads.every(isQuad)) return null;
	const from = isPoint(mark.from) ? {
		x: mark.from.x,
		y: mark.from.y
	} : void 0;
	const to = isPoint(mark.to) ? {
		x: mark.to.x,
		y: mark.to.y
	} : void 0;
	if (kind === "arrow" && (!from || !to)) return null;
	if (kind === "callout" && mark.quads.length === 0) return null;
	if (kind !== "arrow" && kind !== "callout" && mark.quads.length === 0) return null;
	return {
		id: mark.id,
		page: mark.page,
		kind,
		pass: mark.pass,
		ink: mark.ink,
		label,
		note: mark.note,
		quote: mark.quote,
		quads: mark.quads,
		from,
		to,
		sourceId: typeof mark.sourceId === "string" ? mark.sourceId : void 0,
		createdAt: typeof mark.createdAt === "number" ? mark.createdAt : Date.now()
	};
}
var KINDS;
var LABELS;
var INKS;
var INK_RGB;
var HEADER;
var init_marks = __esmMin((() => {
	KINDS = [
		{
			id: "highlight",
			name: "Highlight"
		},
		{
			id: "underline",
			name: "Underline"
		},
		{
			id: "strikeout",
			name: "Strikeout"
		},
		{
			id: "callout",
			name: "Callout"
		},
		{
			id: "arrow",
			name: "Arrow"
		}
	];
	LABELS = [
		{
			id: "query",
			name: "Query"
		},
		{
			id: "style",
			name: "Style"
		},
		{
			id: "term",
			name: "Term"
		},
		{
			id: "number",
			name: "Number"
		},
		{
			id: "xref",
			name: "Cross-ref"
		},
		{
			id: "note",
			name: "Note"
		}
	];
	INKS = [
		{
			id: "brass",
			name: "Brass"
		},
		{
			id: "steel",
			name: "Steel"
		},
		{
			id: "crimson",
			name: "Crimson"
		}
	];
	INK_RGB = {
		brass: [
			141 / 255,
			90 / 255,
			43 / 255
		],
		steel: [
			30 / 255,
			77 / 255,
			107 / 255
		],
		crimson: [
			140 / 255,
			47 / 255,
			47 / 255
		]
	};
	HEADER = /^\[(First read|Second read|P[12]) · (Query|Style|Term|Number|Cross-ref|Note)\]\n?/;
}));
function loadPdfjs() {
	if (!loading) loading = (async () => {
		const pdfjs = await import("../_libs/pdfjs-dist.mjs").then((n) => n.t);
		const worker = await import("./pdf.worker.min-DootJ7cL.mjs");
		pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
		return pdfjs;
	})();
	return loading;
}
async function openPdf(bytes) {
	const pdfjs = await loadPdfjs();
	const base = "/";
	return pdfjs.getDocument({
		data: bytes.slice(0),
		cMapUrl: `${base}pdfjs/cmaps/`,
		cMapPacked: true,
		standardFontDataUrl: `${base}pdfjs/standard_fonts/`
	}).promise;
}
function colorChannels(color) {
	if (!color || typeof color !== "object") return null;
	const record = color;
	if (typeof record[0] !== "number" || typeof record[1] !== "number" || typeof record[2] !== "number") return null;
	return [
		record[0],
		record[1],
		record[2]
	];
}
function pair(value) {
	if (!Array.isArray(value) || value.length < 4) return null;
	const [x1, y1, x2, y2] = value;
	if (![
		x1,
		y1,
		x2,
		y2
	].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
	return [{
		x: x1,
		y: y1
	}, {
		x: x2,
		y: y2
	}];
}
function rectQuad(rect) {
	if (!Array.isArray(rect) || rect.length < 4) return null;
	const [x1, y1, x2, y2] = rect;
	if (![
		x1,
		y1,
		x2,
		y2
	].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
	const w = Math.abs(x2 - x1);
	const h = Math.abs(y2 - y1);
	if (w < .2 || h < .2) return null;
	return {
		x: Math.min(x1, x2),
		y: Math.min(y1, y2),
		w,
		h
	};
}
async function readExisting(pdf) {
	const marks = [];
	const ids = [];
	for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
		const annots = await (await pdf.getPage(pageNumber)).getAnnotations();
		for (const annot of annots) {
			const kind = KIND_BY_SUBTYPE[String(annot.subtype)];
			if (!kind) continue;
			const line = pair(annot.lineCoordinates);
			const quads = quadsFromPoints(annot.quadPoints);
			const box = rectQuad(annot.rect);
			if (!quads.length && box && kind !== "arrow") quads.push(box);
			if (kind === "arrow" && !line) continue;
			if (kind === "callout" && !quads.length) continue;
			if (kind !== "arrow" && kind !== "callout" && !quads.length) continue;
			const sourceId = typeof annot.id === "string" ? annot.id : "";
			if (sourceId) ids.push(sourceId);
			const contentsObj = annot.contentsObj;
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
				from: kind === "arrow" && line ? line[0] : void 0,
				to: kind === "arrow" && line ? line[1] : void 0,
				sourceId: sourceId || void 0,
				createdAt: Date.now()
			});
		}
	}
	return {
		marks,
		ids
	};
}
async function searchPdf(pdf, query) {
	const needle = query.trim().toLowerCase();
	if (needle.length < 2) return [];
	const hits = [];
	for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
		const content = await (await pdf.getPage(pageNumber)).getTextContent();
		let text = "";
		const spans = [];
		for (const item of content.items) {
			if (!("str" in item) || !item.str) continue;
			const run = item;
			const start = text.length;
			text += run.str;
			const height = run.height || Math.hypot(run.transform[2] ?? 0, run.transform[3] ?? 0) || 10;
			spans.push({
				start,
				end: text.length,
				x: run.transform[4] ?? 0,
				y: run.transform[5] ?? 0,
				w: run.width || 0,
				h: height
			});
			if (run.hasEOL) text += "\n";
		}
		const haystack = text.toLowerCase();
		let from = 0;
		while (from < haystack.length && hits.length < 200) {
			const at = haystack.indexOf(needle, from);
			if (at < 0) break;
			const end = at + needle.length;
			const quads = [];
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
					h: span.h
				});
			}
			if (quads.length) hits.push({
				page: pageNumber,
				quads
			});
			from = at + Math.max(1, needle.length);
		}
		if (hits.length >= 200) break;
	}
	return hits;
}
var loading;
var KIND_BY_SUBTYPE;
var init_pdf_client = __esmMin((() => {
	init_geometry();
	init_marks();
	loading = null;
	KIND_BY_SUBTYPE = {
		Highlight: "highlight",
		Underline: "underline",
		StrikeOut: "strikeout",
		Line: "arrow",
		FreeText: "callout"
	};
}));
function arrowPoints(tipX, tipY, fromX, fromY, size = 12) {
	const angle = Math.atan2(tipY - fromY, tipX - fromX);
	const left = angle + Math.PI * .84;
	const right = angle - Math.PI * .84;
	return `${tipX},${tipY} ${tipX + Math.cos(left) * size},${tipY + Math.sin(left) * size} ${tipX + Math.cos(right) * size},${tipY + Math.sin(right) * size}`;
}
function PdfPage({ pdf, pageNumber, scale, marks, hits, activeHit, activeId, tool, eager = false, pane = "work", domId, onPick, onViewport, onPlace, onGestureStart, onGestureMove, onGestureEnd }) {
	const shellRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const textRef = (0, import_react.useRef)(null);
	const onViewportRef = (0, import_react.useRef)(onViewport);
	const viewportRef = (0, import_react.useRef)(null);
	const placeRef = (0, import_react.useRef)(onPlace);
	const startRef = (0, import_react.useRef)(onGestureStart);
	const moveRef = (0, import_react.useRef)(onGestureMove);
	const endRef = (0, import_react.useRef)(onGestureEnd);
	const toolRef = (0, import_react.useRef)(tool);
	onViewportRef.current = onViewport;
	placeRef.current = onPlace;
	startRef.current = onGestureStart;
	moveRef.current = onGestureMove;
	endRef.current = onGestureEnd;
	toolRef.current = tool;
	const [near, setNear] = (0, import_react.useState)(eager || pageNumber === 1);
	const [base, setBase] = (0, import_react.useState)(null);
	const [viewport, setViewport] = (0, import_react.useState)(null);
	const [noText, setNoText] = (0, import_react.useState)(false);
	const [sketch, setSketch] = (0, import_react.useState)(null);
	const gesture = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const node = shellRef.current;
		if (!node) return;
		const observer = new IntersectionObserver(([entry]) => {
			if (entry?.isIntersecting) setNear(true);
		}, { rootMargin: "900px" });
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	(0, import_react.useEffect)(() => {
		if (!near) return;
		let cancel = false;
		pdf.getPage(pageNumber).then((page) => {
			if (cancel) return;
			const view = page.getViewport({ scale: 1 });
			setBase({
				w: view.width,
				h: view.height
			});
		});
		return () => {
			cancel = true;
		};
	}, [
		near,
		pdf,
		pageNumber
	]);
	(0, import_react.useEffect)(() => {
		if (!near || !base) return;
		const canvas = canvasRef.current;
		const textEl = textRef.current;
		if (!canvas || !textEl) return;
		const job = {
			cancel: false,
			render: null,
			text: null
		};
		(async () => {
			const pdfjs = await loadPdfjs();
			if (job.cancel) return;
			const page = await pdf.getPage(pageNumber);
			if (job.cancel) return;
			const view = page.getViewport({ scale });
			setViewport(view);
			viewportRef.current = view;
			onViewportRef.current(pageNumber, view);
			if (!canvas.getContext("2d") || job.cancel) return;
			const ratio = window.devicePixelRatio || 1;
			canvas.width = Math.floor(view.width * ratio);
			canvas.height = Math.floor(view.height * ratio);
			const renderTask = page.render({
				canvas,
				viewport: view,
				transform: ratio === 1 ? void 0 : [
					ratio,
					0,
					0,
					ratio,
					0,
					0
				],
				annotationMode: pdfjs.AnnotationMode.DISABLE
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
				viewport: view
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
	}, [
		near,
		base,
		pdf,
		pageNumber,
		scale
	]);
	function pointFrom(event) {
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
				placeRef.current?.(pageNumber, {
					kind: "arrow",
					from: current.start,
					to: current.current
				});
			} else if (toolNow === "callout") {
				const tip = current.start;
				const center = dist < 8 ? {
					x: tip.x + 78,
					y: tip.y + 42
				} : current.current;
				const quad = clampQuad({
					x: center.x - 74,
					y: center.y - 28,
					w: 148,
					h: 56
				}, viewportRef.current);
				placeRef.current?.(pageNumber, {
					kind: "callout",
					quad,
					tip
				});
			}
			return;
		}
		endRef.current?.(current.moved);
	}
	function listen() {
		const move = (event) => {
			const current = gesture.current;
			if (!current) return;
			const next = pointFrom(event);
			if (!next) return;
			if (current.type === "draw") {
				current.current = next;
				current.moved = true;
				setSketch({
					start: current.start,
					current: next
				});
				return;
			}
			const dx = next.x - current.origin.x;
			const dy = next.y - current.origin.y;
			if (Math.hypot(dx, dy) > .4) current.moved = true;
			if (current.mode === "body" && current.mark.from && current.mark.to) moveRef.current?.(current.id, {
				from: {
					x: current.mark.from.x + dx,
					y: current.mark.from.y + dy
				},
				to: {
					x: current.mark.to.x + dx,
					y: current.mark.to.y + dy
				}
			});
			else if (current.mode === "from") moveRef.current?.(current.id, { from: next });
			else if (current.mode === "to") moveRef.current?.(current.id, { to: next });
			else if (current.mode === "box" && current.mark.quads[0]) {
				const quad = current.mark.quads[0];
				moveRef.current?.(current.id, { quads: [{
					...quad,
					x: quad.x + dx,
					y: quad.y + dy
				}] });
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
	function onShellPointerDown(event) {
		if (pane === "mate") return;
		const toolNow = toolRef.current;
		if (toolNow !== "arrow" && toolNow !== "callout") return;
		if (event.target?.closest("[data-handle], .quire-callout")) return;
		const start = pointFrom(event);
		if (!start) return;
		event.preventDefault();
		gesture.current = {
			type: "draw",
			start,
			current: start,
			moved: false
		};
		setSketch({
			start,
			current: start
		});
		listen();
	}
	function beginDrag(event, mark, mode) {
		if (pane === "mate") return;
		const selectedCallout = mark.kind === "callout" && mark.id === activeId;
		if (toolRef.current !== "select" && !selectedCallout) return;
		const origin = pointFrom(event);
		if (!origin) return;
		event.preventDefault();
		event.stopPropagation();
		onPick(mark.id);
		startRef.current?.();
		gesture.current = {
			type: "drag",
			id: mark.id,
			mode,
			origin,
			mark,
			moved: false
		};
		listen();
	}
	const width = (base?.w ?? 595.28) * scale;
	const height = (base?.h ?? 841.89) * scale;
	const pageMarks = marks.filter((mark) => mark.page === pageNumber);
	const drawing = tool === "arrow" || tool === "callout";
	const viewOf = (point) => {
		if (!viewport) return {
			x: 0,
			y: 0
		};
		const [x, y] = viewport.convertToViewportPoint(point.x, point.y);
		return {
			x,
			y
		};
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-8 flex flex-col items-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: shellRef,
			id: domId,
			"data-page": pageNumber,
			"data-pane": pane,
			onPointerDown: onShellPointerDown,
			className: `quire-page relative bg-paper ${tool === "select" ? "quire-selecting" : ""} ${drawing ? "quire-drawing" : ""}`,
			style: {
				width,
				height,
				["--scale-factor"]: String(scale),
				["--user-unit"]: "1",
				["--total-scale-factor"]: "calc(var(--scale-factor) * var(--user-unit))",
				["--scale-round-x"]: "1px",
				["--scale-round-y"]: "1px"
			},
			children: near && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					className: "absolute inset-0 h-full w-full"
				}),
				viewport && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
					className: "quire-marks absolute inset-0 h-full w-full",
					children: [
						hits.map((hit, index) => hit.page === pageNumber ? hit.quads.map((quad, quadIndex) => {
							const view = quadToView(quad, viewport);
							const active = index === activeHit;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
								x: view.left,
								y: view.top,
								width: view.width,
								height: view.height,
								fill: "none",
								stroke: "var(--color-brass)",
								strokeWidth: active ? 2 : 1,
								strokeDasharray: active ? void 0 : "3 2",
								opacity: active ? 1 : .7
							}, `hit-${index}-${quadIndex}`);
						}) : null),
						pageMarks.map((mark) => {
							const color = `var(--color-${mark.ink})`;
							const active = mark.id === activeId;
							if (mark.kind === "arrow" && mark.from && mark.to) {
								const from = viewOf(mark.from);
								const to = viewOf(mark.to);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
									className: "quire-mark",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
											x1: from.x,
											y1: from.y,
											x2: to.x,
											y2: to.y,
											stroke: "transparent",
											strokeWidth: 16,
											onPointerDown: (event) => beginDrag(event, mark, "body")
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
											x1: from.x,
											y1: from.y,
											x2: to.x,
											y2: to.y,
											stroke: color,
											strokeWidth: active ? 2.5 : 2
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
											points: arrowPoints(to.x, to.y, from.x, from.y),
											fill: color
										}),
										active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Handle, {
											x: from.x,
											y: from.y,
											onPointerDown: (event) => beginDrag(event, mark, "from")
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Handle, {
											x: to.x,
											y: to.y,
											onPointerDown: (event) => beginDrag(event, mark, "to")
										})] })
									]
								}, mark.id);
							}
							if (mark.kind === "callout" && mark.quads[0]) {
								const view = quadToView(mark.quads[0], viewport);
								const tip = viewOf(mark.to ?? {
									x: mark.quads[0].x + mark.quads[0].w / 2,
									y: mark.quads[0].y + mark.quads[0].h
								});
								const edge = edgeToward({
									x: view.left,
									y: view.top,
									w: view.width,
									h: view.height
								}, tip);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
									className: "quire-mark",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
											x1: edge.x,
											y1: edge.y,
											x2: tip.x,
											y2: tip.y,
											stroke: color,
											strokeWidth: active ? 2.5 : 2
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
											points: arrowPoints(tip.x, tip.y, edge.x, edge.y, 11),
											fill: color
										}),
										active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Handle, {
											x: tip.x,
											y: tip.y,
											onPointerDown: (event) => beginDrag(event, mark, "to")
										})
									]
								}, mark.id);
							}
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
								className: "quire-mark",
								onPointerDown: (event) => {
									if (tool !== "select") return;
									event.preventDefault();
									event.stopPropagation();
									onPick(mark.id);
								},
								children: mark.quads.map((quad, index) => {
									const view = quadToView(quad, viewport);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
										mark.kind === "highlight" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
											x: view.left,
											y: view.top,
											width: view.width,
											height: view.height,
											fill: color,
											fillOpacity: active ? .5 : .34
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
											x: view.left,
											y: view.top,
											width: view.width,
											height: view.height,
											fill: "transparent"
										}),
										mark.kind === "underline" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
											x1: view.left,
											x2: view.left + view.width,
											y1: view.top + view.height - 1,
											y2: view.top + view.height - 1,
											stroke: color,
											strokeWidth: Math.max(1.5, view.height * .08)
										}),
										mark.kind === "strikeout" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
											x1: view.left,
											x2: view.left + view.width,
											y1: view.top + view.height / 2,
											y2: view.top + view.height / 2,
											stroke: color,
											strokeWidth: Math.max(1.4, view.height * .07)
										}),
										active && index === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
											x: view.left,
											y: Math.max(12, view.top - 4),
											fill: "var(--color-ink)",
											fontSize: 12,
											fontFamily: "var(--font-sans)",
											children: readName(mark.pass)
										})
									] }, index);
								})
							}, mark.id);
						}),
						sketch && viewport && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sketch, {
							tool,
							start: viewOf(sketch.start),
							current: viewOf(sketch.current)
						})
					]
				}),
				viewport && pageMarks.map((mark) => {
					if (mark.kind !== "callout" || !mark.quads[0]) return null;
					const view = quadToView(mark.quads[0], viewport);
					const active = mark.id === activeId;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `quire-callout absolute overflow-hidden px-2 py-1${active ? " is-selected" : ""}`,
						style: {
							left: view.left,
							top: view.top,
							width: Math.max(24, view.width),
							height: Math.max(20, view.height),
							borderColor: `var(--color-${mark.ink})`,
							boxShadow: active ? "3px 3px 0 #000" : void 0,
							background: active ? "var(--color-stamp)" : "#fff"
						},
						onPointerDown: (event) => beginDrag(event, mark, "box"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "line-clamp-4 text-xs leading-snug font-semibold text-ink",
							children: mark.note.trim() || labelName(mark.label)
						})
					}, mark.id);
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: textRef,
					className: "quire-text"
				})
			] })
		}), noText && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-center text-sm text-muted",
			children: "No selectable text on this page."
		})]
	});
}
function clampQuad(quad, viewport) {
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
		y: Math.min(Math.max(minY, quad.y), Math.max(minY, maxY - quad.h))
	};
}
function Handle({ x, y, onPointerDown }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
		"data-handle": "true",
		cx: x,
		cy: y,
		r: 7,
		fill: "#fff",
		stroke: "#000",
		strokeWidth: 2,
		style: { pointerEvents: "auto" },
		onPointerDown
	});
}
function Sketch({ tool, start, current }) {
	if (tool === "callout") {
		const left = current.x - 74;
		const top = current.y - 28;
		const edge = edgeToward({
			x: left,
			y: top,
			w: 148,
			h: 56
		}, start);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: edge.x,
				y1: edge.y,
				x2: start.x,
				y2: start.y,
				stroke: "#000",
				strokeWidth: 2
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
				points: arrowPoints(start.x, start.y, edge.x, edge.y, 11),
				fill: "#000"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: left,
				y: top,
				width: 148,
				height: 56,
				fill: "#ffe14a",
				stroke: "#000",
				strokeWidth: 2
			})
		] });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
		x1: start.x,
		y1: start.y,
		x2: current.x,
		y2: current.y,
		stroke: "#000",
		strokeWidth: 2
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
		points: arrowPoints(current.x, current.y, start.x, start.y),
		fill: "#000"
	})] });
}
var init_PdfPage = __esmMin((() => {
	init_geometry();
	init_marks();
	init_pdf_client();
}));
function Rail({ marks, activeId, noteRef, onClose, onPick, onPatch, onNote, onNoteBlur, onDelete, onClear }) {
	const [passFilter, setPassFilter] = (0, import_react.useState)("all");
	const [kindFilter, setKindFilter] = (0, import_react.useState)("all");
	const [armed, setArmed] = (0, import_react.useState)(false);
	const filtered = sortMarks(marks).filter((mark) => {
		if (passFilter !== "all" && mark.pass !== passFilter) return false;
		if (kindFilter !== "all" && mark.kind !== kindFilter) return false;
		return true;
	});
	const active = marks.find((mark) => mark.id === activeId) ?? null;
	(0, import_react.useEffect)(() => {
		setArmed(false);
	}, [marks.length]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "fixed inset-0 z-30 flex min-h-0 flex-col bg-desk text-paper md:static md:z-auto md:w-96 md:shrink-0 md:border-l md:border-line-dark",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line-dark px-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xl font-bold leading-tight",
					children: "Marks"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted tabular-nums",
					children: filtered.length === marks.length ? `${marks.length}` : `${filtered.length} of ${marks.length}`
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					"aria-label": "Close marks",
					className: "inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-raised",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
						size: 18,
						strokeWidth: 1.75
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 gap-2 overflow-x-auto border-b border-line-dark px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterButton, {
						pressed: passFilter === "all" && kindFilter === "all",
						onClick: () => {
							setPassFilter("all");
							setKindFilter("all");
						},
						children: "All"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterButton, {
						pressed: passFilter === 1,
						onClick: () => setPassFilter(passFilter === 1 ? "all" : 1),
						children: "First read"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterButton, {
						pressed: passFilter === 2,
						onClick: () => setPassFilter(passFilter === 2 ? "all" : 2),
						children: "Second read"
					}),
					KINDS.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterButton, {
						pressed: kindFilter === kind.id,
						onClick: () => setKindFilter(kindFilter === kind.id ? "all" : kind.id),
						children: kind.name
					}, kind.id))
				]
			}),
			active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "shrink-0 border-b border-line-dark px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Page ",
							active.page,
							" · ",
							kindName(active.kind)
						]
					}),
					active.quote && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 line-clamp-3 text-sm text-pretty text-paper italic",
						children: [
							"“",
							active.quote,
							"”"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-3 block text-sm text-muted",
						htmlFor: "quire-note",
						children: "Note"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						id: "quire-note",
						ref: noteRef,
						value: active.note,
						onChange: (event) => onNote(active.id, event.target.value),
						onBlur: onNoteBlur,
						rows: 4,
						spellCheck: true,
						placeholder: "What should change, and why.",
						className: "mt-1 w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brass"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-muted",
							children: "Read"
						}), [1, 2].map((pass) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": active.pass === pass,
							onClick: () => onPatch(active.id, { pass }),
							className: `h-11 rounded-md px-3 text-sm ${active.pass === pass ? pass === 1 ? "bg-brass text-paper" : "bg-steel text-paper" : "bg-raised text-paper"}`,
							children: readName(pass)
						}, pass))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-muted",
							children: "Colour"
						}), INKS.map((ink) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InkButton, {
							ink: ink.id,
							name: ink.name,
							pressed: active.ink === ink.id,
							onClick: () => onPatch(active.id, { ink: ink.id })
						}, ink.id))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-3 block text-sm text-muted",
						htmlFor: "quire-label",
						children: "Label"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						id: "quire-label",
						value: active.label,
						onChange: (event) => onPatch(active.id, { label: event.target.value }),
						className: "mt-1 h-11 w-full rounded-md border border-line-dark bg-raised px-3 text-sm text-paper",
						children: LABELS.map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: label.id,
							children: label.name
						}, label.id))
					}),
					active.kind !== "callout" && active.kind !== "arrow" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex gap-2",
						children: KINDS.filter((kind) => kind.id === "highlight" || kind.id === "underline" || kind.id === "strikeout").map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": active.kind === kind.id,
							onClick: () => onPatch(active.id, { kind: kind.id }),
							className: `h-11 flex-1 rounded-md px-2 text-sm ${active.kind === kind.id ? "bg-brass text-paper" : "bg-raised text-paper"}`,
							children: kind.name
						}, kind.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onDelete(active.id),
						className: "mt-3 inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm text-paper hover:bg-raised",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
							size: 16,
							strokeWidth: 1.75
						}), "Delete mark"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "min-h-0 flex-1 overflow-auto px-3 py-3",
				children: [filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "px-1 py-6 text-sm text-pretty text-muted",
					children: marks.length === 0 ? "No marks yet. Highlight a line, or drag a callout or an arrow." : "Nothing in this filter."
				}), filtered.map((mark) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "mb-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						id: `quire-note-${mark.id}`,
						onClick: () => onPick(mark.id),
						"aria-current": mark.id === activeId,
						className: `w-full rounded-md border px-3 py-3 text-left ${mark.id === activeId ? "border-brass bg-raised" : "border-line-dark bg-desk hover:bg-raised"}`,
						style: {
							borderLeftWidth: 3,
							borderLeftColor: `var(--color-${mark.ink})`
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-baseline justify-between gap-3 text-sm text-muted",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									readName(mark.pass),
									" · ",
									kindName(mark.kind),
									" · ",
									labelName(mark.label)
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "tabular-nums",
									children: ["p. ", mark.page]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block line-clamp-2 text-sm text-pretty text-paper",
								children: mark.quote || (mark.kind === "callout" || mark.kind === "arrow" ? kindName(mark.kind) : "Marked text")
							}),
							mark.note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block line-clamp-2 text-sm text-muted",
								children: mark.note
							})
						]
					})
				}, mark.id))]
			}),
			marks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "shrink-0 border-t border-line-dark px-4 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						if (!armed) {
							setArmed(true);
							return;
						}
						onClear();
						setArmed(false);
					},
					className: `h-11 px-3 text-sm ${armed ? "bg-pink" : ""}`,
					children: armed ? "Confirm clear all" : "Clear all marks"
				})
			})
		]
	});
}
function FilterButton({ pressed, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-pressed": pressed,
		onClick,
		className: `h-11 shrink-0 rounded-md px-3 text-sm ${pressed ? "bg-brass text-paper" : "bg-raised text-paper"}`,
		children
	});
}
function InkButton({ ink, name, pressed, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-label": name,
		title: name,
		"aria-pressed": pressed,
		onClick,
		className: `inline-flex h-11 w-11 items-center justify-center ${pressed ? "bg-stamp" : "bg-paper"}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block h-4 w-4 rounded-full",
			style: { background: `var(--color-${ink})` }
		})
	});
}
var init_Rail = __esmMin((() => {
	init_marks();
}));
function marksToMarkdown(fileName, marks) {
	const sorted = sortMarks(marks);
	const when = (/* @__PURE__ */ new Date()).toLocaleString("en-GB", {
		dateStyle: "medium",
		timeStyle: "short"
	});
	const lines = [
		`# Quire notes — ${fileName}`,
		"",
		`${sorted.length} mark${sorted.length === 1 ? "" : "s"} · ${when}`,
		"",
		"The PDF stayed in the browser. This sheet is the comment list only.",
		""
	];
	if (!sorted.length) {
		lines.push("No marks.");
		return lines.join("\n");
	}
	for (const mark of sorted) {
		lines.push(`## Page ${mark.page} · ${kindName(mark.kind)} · ${readName(mark.pass)} · ${labelName(mark.label)}`);
		lines.push("");
		if (mark.quote.trim()) {
			lines.push(`> ${mark.quote.trim().replaceAll("\n", "\n> ")}`);
			lines.push("");
		}
		lines.push(mark.note.trim() || "_No note._");
		lines.push("");
		lines.push("---");
		lines.push("");
	}
	return lines.join("\n");
}
function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
function safeStem(name) {
	return (name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, " ").trim() || "document").slice(0, 80);
}
var init_markdown = __esmMin((() => {
	init_marks();
}));
/** Split a text run into words and give each word a share of the run's box. */
function wordsInRun(str, x, y, w, h) {
	if (!str || w <= 0 || h <= 0) return [];
	const total = Math.max(1, str.length);
	const words = [];
	for (const match of str.matchAll(/\S+/g)) {
		const start = match.index ?? 0;
		const text = match[0];
		if (!text) continue;
		words.push({
			text,
			quad: {
				x: x + w * start / total,
				y,
				w: Math.max(.4, w * text.length / total),
				h
			}
		});
	}
	return words;
}
function diffTokens(before, after) {
	const n = before.length;
	const m = after.length;
	if (n === 0 && m === 0) return [];
	if (n === 0) return [{
		op: "ins",
		b0: 0,
		b1: m
	}];
	if (m === 0) return [{
		op: "del",
		a0: 0,
		a1: n
	}];
	if (n * m > 2e6) return null;
	const cols = m + 1;
	const from = new Uint8Array((n + 1) * cols);
	let previous = new Int32Array(cols);
	let current = new Int32Array(cols);
	for (let i = 1; i <= n; i += 1) {
		for (let j = 1; j <= m; j += 1) {
			const at = i * cols + j;
			if (before[i - 1] === after[j - 1]) {
				current[j] = previous[j - 1] + 1;
				from[at] = 1;
			} else if (previous[j] >= current[j - 1]) {
				current[j] = previous[j];
				from[at] = 2;
			} else {
				current[j] = current[j - 1];
				from[at] = 3;
			}
		}
		const swap = previous;
		previous = current;
		current = swap;
		current.fill(0);
	}
	const steps = [];
	let i = n;
	let j = m;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0) {
			const dir = from[i * cols + j];
			if (dir === 1) {
				steps.push({
					t: 1,
					i: i - 1,
					j: j - 1
				});
				i -= 1;
				j -= 1;
				continue;
			}
			if (dir === 3) {
				steps.push({
					t: 3,
					i,
					j: j - 1
				});
				j -= 1;
				continue;
			}
			steps.push({
				t: 2,
				i: i - 1,
				j
			});
			i -= 1;
			continue;
		}
		if (i > 0) {
			steps.push({
				t: 2,
				i: i - 1,
				j: 0
			});
			i -= 1;
			continue;
		}
		steps.push({
			t: 3,
			i: 0,
			j: j - 1
		});
		j -= 1;
	}
	steps.reverse();
	const ops = [];
	for (const step of steps) {
		const last = ops[ops.length - 1];
		if (step.t === 1) {
			if (last?.op === "eq" && last.a1 === step.i && last.b1 === step.j) {
				last.a1 += 1;
				last.b1 += 1;
			} else ops.push({
				op: "eq",
				a0: step.i,
				a1: step.i + 1,
				b0: step.j,
				b1: step.j + 1
			});
		} else if (step.t === 2) {
			if (last?.op === "del" && last.a1 === step.i) last.a1 += 1;
			else ops.push({
				op: "del",
				a0: step.i,
				a1: step.i + 1
			});
		} else if (last?.op === "ins" && last.b1 === step.j) last.b1 += 1;
		else ops.push({
			op: "ins",
			b0: step.j,
			b1: step.j + 1
		});
	}
	return ops;
}
function clip(text, max) {
	const flat = text.replace(/\s+/g, " ").trim();
	if (flat.length <= max) return flat;
	return `${flat.slice(0, max - 1)}…`;
}
function joined(words, max) {
	return clip(words.map((word) => word.text).join(" "), max);
}
function mergeLineQuads(quads) {
	const sorted = [...quads].sort((a, b) => b.y - a.y || a.x - b.x);
	const merged = [];
	for (const quad of sorted) {
		const last = merged[merged.length - 1];
		const gap = last ? quad.x - (last.x + last.w) : 0;
		const sameLine = !!last && Math.abs(last.y - quad.y) < Math.max(2, Math.min(last.h, quad.h) * .6) && gap < 14 && gap > -4;
		if (!last || !sameLine) {
			merged.push({ ...quad });
			continue;
		}
		const right = Math.max(last.x + last.w, quad.x + quad.w);
		const bottom = Math.min(last.y, quad.y);
		const top = Math.max(last.y + last.h, quad.y + quad.h);
		last.x = Math.min(last.x, quad.x);
		last.y = bottom;
		last.w = right - last.x;
		last.h = top - bottom;
	}
	return merged;
}
function changeId() {
	return `change-${crypto.randomUUID()}`;
}
function highlightMark(page, pass, ink, note, words) {
	return {
		id: changeId(),
		page,
		kind: "highlight",
		pass,
		ink,
		label: "note",
		note,
		quote: joined(words, 500),
		quads: mergeLineQuads(words.map((word) => word.quad)),
		createdAt: Date.now()
	};
}
function deletionMark(page, pass, words, anchor, stack) {
	const text = joined(words, 280);
	const base = anchor ?? {
		x: 72,
		y: 680,
		w: 12,
		h: 12
	};
	return {
		id: changeId(),
		page,
		kind: "callout",
		pass,
		ink: "crimson",
		label: "note",
		note: `Deleted: ${text}`,
		quote: joined(words, 500),
		quads: [{
			x: base.x + stack % 3 * 16,
			y: base.y + base.h + 8 + stack * 44,
			w: 200,
			h: 40
		}],
		to: {
			x: base.x,
			y: base.y + base.h / 2
		},
		createdAt: Date.now()
	};
}
/** Marks for one page. `before` is the earlier copy. `after` is this file. */
function marksForPage(before, after, page, pass) {
	const ops = diffTokens(before.map((word) => word.text), after.map((word) => word.text));
	if (!ops) {
		if (!before.length && !after.length) return [];
		if (!before.length) return [highlightMark(page, pass, "steel", "Added.", after)];
		if (!after.length) return [deletionMark(page, pass, before, null, 0)];
		return [highlightMark(page, pass, "brass", `Was: ${joined(before, 500)}`, after)];
	}
	const marks = [];
	let removed = [];
	let added = [];
	let stack = 0;
	const flush = (anchor) => {
		if (!removed.length && !added.length) return;
		if (removed.length && added.length) marks.push(highlightMark(page, pass, "brass", `Was: ${joined(removed, 500)}`, added));
		else if (added.length) marks.push(highlightMark(page, pass, "steel", "Added.", added));
		else {
			marks.push(deletionMark(page, pass, removed, anchor, stack));
			stack += 1;
		}
		removed = [];
		added = [];
	};
	let lastAnchor = null;
	for (const op of ops) {
		if (op.op === "eq") {
			flush(after[op.b0]?.quad ?? lastAnchor);
			lastAnchor = after[op.b1 - 1]?.quad ?? lastAnchor;
			continue;
		}
		if (op.op === "del") removed.push(...before.slice(op.a0, op.a1));
		else added.push(...after.slice(op.b0, op.b1));
	}
	flush(lastAnchor);
	return marks;
}
function capChanges(marks) {
	if (marks.length <= MARK_CAP) return {
		marks,
		capped: false
	};
	return {
		marks: marks.slice(0, MARK_CAP),
		capped: true
	};
}
var MARK_CAP;
var init_text_diff = __esmMin((() => {
	MARK_CAP = 400;
}));
async function pageWords(pdf, pageNumber) {
	const content = await (await pdf.getPage(pageNumber)).getTextContent();
	const words = [];
	for (const item of content.items) {
		if (!("str" in item) || !item.str) continue;
		const run = item;
		const height = run.height || Math.hypot(run.transform[2] ?? 0, run.transform[3] ?? 0) || 10;
		words.push(...wordsInRun(run.str, run.transform[4] ?? 0, run.transform[5] ?? 0, run.width || 0, height));
	}
	return words;
}
/**
* This file is the later copy. Compare is the earlier copy.
* Inserted and replaced text is marked on the later copy. Deleted text becomes a callout there.
*/
async function compareDocuments(earlier, later, pass) {
	const shared = Math.min(earlier.numPages, later.numPages);
	const marks = [];
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
		const removed = [];
		for (let page = shared + 1; page <= earlier.numPages; page += 1) {
			removed.push(...await pageWords(earlier, page));
			if (removed.length > 80) break;
		}
		if (removed.length) {
			const anchor = (await pageWords(later, later.numPages)).at(-1)?.quad ?? null;
			const mark = marksForPage(removed, [], later.numPages, pass)[0];
			if (mark?.kind === "callout") marks.push({
				...mark,
				...anchor ? {
					quads: [{
						x: anchor.x,
						y: anchor.y + anchor.h + 8,
						w: 210,
						h: 48
					}],
					to: {
						x: anchor.x,
						y: anchor.y + anchor.h / 2
					}
				} : {},
				note: `Deleted, on later pages of the earlier copy: ${mark.quote}`
			});
		}
	}
	return capChanges(marks);
}
var init_compare_pdf = __esmMin((() => {
	init_text_diff();
}));
function pdfDate(ms) {
	const date = new Date(ms);
	const part = (value) => String(value).padStart(2, "0");
	return `D:${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}
function num(value) {
	return (Math.round(value * 100) / 100).toString();
}
function arrowDraw(x1, y1, x2, y2) {
	const angle = Math.atan2(y2 - y1, x2 - x1);
	const size = 10;
	const left = angle + Math.PI * .82;
	const right = angle - Math.PI * .82;
	const ax = x2 + Math.cos(left) * size;
	const ay = y2 + Math.sin(left) * size;
	const bx = x2 + Math.cos(right) * size;
	const by = y2 + Math.sin(right) * size;
	return [
		`${num(x1)} ${num(y1)} m`,
		`${num(x2)} ${num(y2)} l S`,
		`${num(x2)} ${num(y2)} m`,
		`${num(ax)} ${num(ay)} l`,
		`${num(bx)} ${num(by)} l h f`
	].join("\n");
}
function appearance(doc, rect, body) {
	const [x1, y1, x2, y2] = rect;
	const stream = doc.context.flateStream(body, {
		Type: "XObject",
		Subtype: "Form",
		BBox: [
			0,
			0,
			Math.max(1, x2 - x1),
			Math.max(1, y2 - y1)
		],
		Resources: doc.context.obj({ ProcSet: [PDFName.of("PDF")] })
	});
	return doc.context.obj({ N: stream });
}
function local(point, originX, originY) {
	return [point.x - originX, point.y - originY];
}
function paint(color) {
	const [r, g, b] = color.map(num);
	return `${r} ${g} ${b} RG\n${r} ${g} ${b} rg\n1.6 w\n1 J`;
}
function common(doc, page, mark, rect, color) {
	return {
		Type: PDFName.of("Annot"),
		Rect: rect,
		C: color,
		CA: 1,
		F: 4,
		Contents: PDFHexString.fromText(formatContents(mark)),
		T: PDFHexString.fromText("Quire"),
		Subj: PDFHexString.fromText(`${readName(mark.pass)} · ${labelName(mark.label)}`),
		NM: PDFHexString.fromText(`quire-${mark.id}`),
		M: PDFString.of(pdfDate(Date.now())),
		CreationDate: PDFString.of(pdfDate(mark.createdAt)),
		P: page.ref
	};
}
function makeLine(doc, page, mark) {
	if (!mark.from || !mark.to) return null;
	const pad = 14;
	const minX = Math.min(mark.from.x, mark.to.x) - pad;
	const minY = Math.min(mark.from.y, mark.to.y) - pad;
	const rect = [
		minX,
		minY,
		Math.max(mark.from.x, mark.to.x) + pad,
		Math.max(mark.from.y, mark.to.y) + pad
	];
	const [r, g, b] = INK_RGB[mark.ink];
	const [x1, y1] = local(mark.from, minX, minY);
	const [x2, y2] = local(mark.to, minX, minY);
	const body = `q\n${paint([
		r,
		g,
		b
	])}\n${arrowDraw(x1, y1, x2, y2)}\nQ`;
	return doc.context.obj({
		...common(doc, page, mark, rect, [
			r,
			g,
			b
		]),
		Subtype: PDFName.of("Line"),
		L: [
			mark.from.x,
			mark.from.y,
			mark.to.x,
			mark.to.y
		],
		LE: [PDFName.of("None"), PDFName.of("OpenArrow")],
		BS: doc.context.obj({
			W: 1.6,
			S: PDFName.of("S")
		}),
		AP: appearance(doc, rect, body)
	});
}
function makeCallout(doc, page, mark) {
	const box = mark.quads[0];
	if (!box) return null;
	const tip = mark.to ?? {
		x: box.x + box.w / 2,
		y: box.y + box.h
	};
	const edge = edgeToward(box, tip);
	const pad = 8;
	const minX = Math.min(box.x, tip.x) - pad;
	const minY = Math.min(box.y, tip.y) - pad;
	const maxX = Math.max(box.x + box.w, tip.x) + pad;
	const maxY = Math.max(box.y + box.h, tip.y) + pad;
	const rect = [
		minX,
		minY,
		maxX,
		maxY
	];
	const [r, g, b] = INK_RGB[mark.ink];
	const [x1, y1] = local(edge, minX, minY);
	const [x2, y2] = local(tip, minX, minY);
	const left = box.x - minX;
	const bottom = box.y - minY;
	const body = [
		"q",
		paint([
			r,
			g,
			b
		]),
		arrowDraw(x1, y1, x2, y2),
		`${num(left)} ${num(bottom)} ${num(box.w)} ${num(box.h)} re S`,
		"Q"
	].join("\n");
	return doc.context.obj({
		...common(doc, page, mark, rect, [
			r,
			g,
			b
		]),
		Subtype: PDFName.of("FreeText"),
		IT: PDFName.of("FreeTextCallout"),
		CL: [
			tip.x,
			tip.y,
			edge.x,
			edge.y
		],
		LE: PDFName.of("OpenArrow"),
		RD: [
			box.x - minX,
			box.y - minY,
			maxX - (box.x + box.w),
			maxY - (box.y + box.h)
		],
		BS: doc.context.obj({
			W: 1.4,
			S: PDFName.of("S")
		}),
		DA: PDFString.of("0 0 0 rg"),
		AP: appearance(doc, rect, body)
	});
}
function makeAnnot(doc, page, mark) {
	if (mark.kind === "arrow") return makeLine(doc, page, mark);
	if (mark.kind === "callout") return makeCallout(doc, page, mark);
	if (!mark.quads.length) return null;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	const quadPoints = [];
	for (const quad of mark.quads) {
		const left = quad.x;
		const bottom = quad.y;
		const right = quad.x + quad.w;
		const top = quad.y + quad.h;
		minX = Math.min(minX, left);
		minY = Math.min(minY, bottom);
		maxX = Math.max(maxX, right);
		maxY = Math.max(maxY, top);
		quadPoints.push(left, top, right, top, left, bottom, right, bottom);
	}
	if (!Number.isFinite(minX) || maxX - minX < .2 || maxY - minY < .2) return null;
	const pad = 1;
	const [r, g, b] = INK_RGB[mark.ink];
	const subtype = mark.kind === "highlight" ? "Highlight" : mark.kind === "underline" ? "Underline" : "StrikeOut";
	return doc.context.obj({
		Type: PDFName.of("Annot"),
		Subtype: PDFName.of(subtype),
		Rect: [
			minX - pad,
			minY - pad,
			maxX + pad,
			maxY + pad
		],
		QuadPoints: quadPoints,
		C: [
			r,
			g,
			b
		],
		CA: mark.kind === "highlight" ? .45 : 1,
		F: 4,
		Border: [
			0,
			0,
			0
		],
		Contents: PDFHexString.fromText(formatContents(mark)),
		T: PDFHexString.fromText("Quire"),
		Subj: PDFHexString.fromText(`${readName(mark.pass)} · ${labelName(mark.label)}`),
		NM: PDFHexString.fromText(`quire-${mark.id}`),
		M: PDFString.of(pdfDate(Date.now())),
		CreationDate: PDFString.of(pdfDate(mark.createdAt)),
		P: page.ref
	});
}
async function embedMarks(original, marks, importedSourceIds) {
	const doc = await PDFDocument.load(original, { updateMetadata: false });
	const drop = new Set(importedSourceIds);
	const byPage = /* @__PURE__ */ new Map();
	for (const mark of marks) {
		const list = byPage.get(mark.page) ?? [];
		list.push(mark);
		byPage.set(mark.page, list);
	}
	doc.getPages().forEach((page, index) => {
		const kept = [];
		const existing = page.node.Annots();
		if (existing) for (let indexAnnot = 0; indexAnnot < existing.size(); indexAnnot += 1) {
			const entry = existing.get(indexAnnot);
			if (entry instanceof PDFRef && drop.has(`${entry.objectNumber}R`)) continue;
			if (entry instanceof PDFRef) kept.push(entry);
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
async function markedPagesPdf(original, marks, importedSourceIds) {
	const pages = [...new Set(marks.map((mark) => mark.page).filter((page) => Number.isInteger(page) && page >= 1))].sort((a, b) => a - b);
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
function changeKind(mark) {
	if (mark.kind === "callout" || mark.note.startsWith("Deleted")) return "Deleted";
	if (mark.note.startsWith("Was:")) return "Replaced";
	return "Added";
}
function wrapLine(font, text, size, max) {
	const words = text.replace(/\s+/g, " ").trim().split(" ");
	if (!words[0]) return [];
	const lines = [];
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
async function summaryPdf(changes, laterName, earlierName) {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	const ink = rgb(.11, .09, .07);
	const quiet = rgb(.33, .3, .26);
	const left = 56;
	const width = 480;
	let page = doc.addPage([595.28, 841.89]);
	let y = 780;
	const ensure = (need) => {
		if (y - need >= 56) return;
		page = doc.addPage([595.28, 841.89]);
		y = 780;
	};
	const draw = (text, size, face, color, gap) => {
		for (const line of wrapLine(face, text, size, width)) {
			ensure(size + gap);
			page.drawText(line, {
				x: left,
				y,
				size,
				font: face,
				color
			});
			y -= size + gap;
		}
	};
	const count = changes.length;
	const when = (/* @__PURE__ */ new Date()).toLocaleString("en-GB", {
		dateStyle: "medium",
		timeStyle: "short"
	});
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
async function comparisonResultsPdf(later, changes, laterName, earlierName) {
	const body = await markedPagesPdf(later, changes, []);
	if (!body) return null;
	const summary = await summaryPdf(changes, laterName, earlierName);
	const out = await PDFDocument.create();
	const summaryDoc = await PDFDocument.load(summary);
	const bodyDoc = await PDFDocument.load(body);
	const copied = [...await out.copyPages(summaryDoc, summaryDoc.getPageIndices()), ...await out.copyPages(bodyDoc, bodyDoc.getPageIndices())];
	for (const page of copied) out.addPage(page);
	out.setTitle(`Comparison — ${laterName}`);
	return out.save();
}
var init_embed_marks = __esmMin((() => {
	init_marks();
	init_geometry();
}));
async function buildSamplePdf() {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	const left = 56;
	const first = doc.addPage([595.28, 841.89]);
	first.drawText("QUORUM HOLDINGS LIMITED", {
		x: left,
		y: 780,
		size: 14,
		font: bold,
		color: ink
	});
	first.drawLine({
		start: {
			x: left,
			y: 770
		},
		end: {
			x: 250,
			y: 770
		},
		thickness: 1.6,
		color: brass
	});
	first.drawText("(Incorporated in the Cayman Islands with limited liability)", {
		x: left,
		y: 750,
		size: 10,
		font,
		color: quiet
	});
	first.drawText("(Stock Code: 0000)", {
		x: left,
		y: 736,
		size: 10,
		font,
		color: quiet
	});
	first.drawText("INTERIM RESULTS ANNOUNCEMENT", {
		x: left,
		y: 696,
		size: 13,
		font: bold,
		color: ink
	});
	first.drawText("FOR THE SIX MONTHS ENDED 30 JUNE 2026", {
		x: left,
		y: 678,
		size: 11,
		font: bold,
		color: ink
	});
	for (const [y, text] of [
		[640, "The board of directors (the \"Board\") of Quorum Holdings Limited"],
		[624, "(the \"Company\") announces the unaudited consolidated results of"],
		[608, "the Company and its subsidiaries (the \"Group\") for the six months"],
		[592, "ended 30 June 2026, together with the comparative figures for 2025."],
		[560, "Revenue was HK$1,284 million, an increase of 18.4% compared with"],
		[544, "HK$1,086 million for the same period in 2025. Profit attributable"],
		[528, "to owners of the Company fell to HK$146 million (2025: HK$163 million)."],
		[496, "The Board does not recommend an interim dividend (2025: HK2.5 cents)."]
	]) first.drawText(text, {
		x: left,
		y,
		size: 11,
		font,
		color: ink
	});
	const second = doc.addPage([595.28, 841.89]);
	second.drawText("QUORUM HOLDINGS LIMITED", {
		x: left,
		y: 780,
		size: 11,
		font: bold,
		color: ink
	});
	second.drawText("Interim results announcement (continued)", {
		x: left,
		y: 762,
		size: 10,
		font,
		color: quiet
	});
	for (const [y, text] of [
		[720, "The rise in revenue came mainly from the property management segment."],
		[704, "Administrative expenses were HK$210 million (2025: HK$168 million),"],
		[688, "driven by staff costs. Cash and bank balances stood at HK$890 million"],
		[672, "(31 December 2025: HK$742 million)."],
		[640, "The current ratio was 1.8 times, against 2.1 times at the last year end."],
		[624, "No material change has occurred since 30 June 2026 that would require"],
		[608, "disclosure under the Listing Rules."],
		[560, "By order of the Board"],
		[544, "Quorum Holdings Limited"],
		[520, "Ada Chen"],
		[506, "Company Secretary"],
		[476, "Hong Kong, 28 August 2026"]
	]) {
		const face = y === 520 || y === 544 ? bold : font;
		second.drawText(text, {
			x: left,
			y,
			size: 11,
			font: face,
			color: ink
		});
	}
	return doc.save();
}
var ink;
var quiet;
var brass;
var init_sample_pdf = __esmMin((() => {
	ink = rgb(.11, .09, .07);
	quiet = rgb(.33, .3, .26);
	brass = rgb(141 / 255, 90 / 255, 43 / 255);
}));
function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
async function fingerprint(bytes) {
	const digest = await crypto.subtle.digest("SHA-256", bytes.slice(0));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function loadSession(key) {
	try {
		const db = await openDb();
		const record = await new Promise((resolve, reject) => {
			const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		db.close();
		if (!record || typeof record !== "object") return null;
		const session = record;
		if (!Array.isArray(session.marks) || !Array.isArray(session.importedSourceIds)) return null;
		const marks = session.marks.map(sanitizeMark).filter((mark) => mark !== null);
		return {
			name: typeof session.name === "string" ? session.name : "document.pdf",
			marks,
			importedSourceIds: session.importedSourceIds.filter((id) => typeof id === "string"),
			savedAt: typeof session.savedAt === "number" ? session.savedAt : Date.now()
		};
	} catch {
		return null;
	}
}
async function saveSession(key, session) {
	try {
		const db = await openDb();
		await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			tx.objectStore(STORE).put(session, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	} catch {}
}
var DB_NAME;
var STORE;
var init_session = __esmMin((() => {
	init_marks();
	DB_NAME = "quire-desk";
	STORE = "sessions";
}));
function pageSides(count, mode) {
	const left = [];
	const right = [];
	if (mode === "facing") for (let number = 1; number <= count; number += 1) if (number % 2 === 1) left.push(number);
	else right.push(number);
	else {
		const mid = Math.ceil(count / 2);
		for (let number = 1; number <= count; number += 1) if (number <= mid) left.push(number);
		else right.push(number);
	}
	return {
		left,
		right
	};
}
function nearestPage(el) {
	const rootTop = el.getBoundingClientRect().top + 32;
	let best = 0;
	let bestDist = Infinity;
	el.querySelectorAll("[data-page]").forEach((node) => {
		const dist = Math.abs(node.getBoundingClientRect().top - rootTop);
		const number = Number(node.dataset.page);
		if (dist < bestDist && Number.isFinite(number)) {
			bestDist = dist;
			best = number;
		}
	});
	return best;
}
function Desk() {
	const [pdf, setPdf] = (0, import_react.useState)(null);
	const [fileName, setFileName] = (0, import_react.useState)(null);
	const [numPages, setNumPages] = (0, import_react.useState)(0);
	const [baseWidth, setBaseWidth] = (0, import_react.useState)(595);
	const [scale, setScale] = (0, import_react.useState)(1);
	const [zoomMode, setZoomMode] = (0, import_react.useState)("fit");
	const [viewMode, setViewMode] = (0, import_react.useState)("single");
	const [mate, setMate] = (0, import_react.useState)(null);
	const [mateScale, setMateScale] = (0, import_react.useState)(1);
	const [linked, setLinked] = (0, import_react.useState)(true);
	const [mateBusy, setMateBusy] = (0, import_react.useState)(false);
	const [matePage, setMatePage] = (0, import_react.useState)(1);
	const [tool, setTool] = (0, import_react.useState)("select");
	const [pass, setPass] = (0, import_react.useState)(1);
	const [ink, setInk] = (0, import_react.useState)("brass");
	const [label, setLabel] = (0, import_react.useState)("query");
	const [marks, setMarks] = (0, import_react.useState)([]);
	const [imported, setImported] = (0, import_react.useState)([]);
	const [activeId, setActiveId] = (0, import_react.useState)(null);
	const [railOpen, setRailOpen] = (0, import_react.useState)(true);
	const [page, setPage] = (0, import_react.useState)(1);
	const [query, setQuery] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)([]);
	const [hitIndex, setHitIndex] = (0, import_react.useState)(0);
	const [searching, setSearching] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [exporting, setExporting] = (0, import_react.useState)(null);
	const [comparing, setComparing] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [status, setStatus] = (0, import_react.useState)("");
	const [sessionKey, setSessionKey] = (0, import_react.useState)(null);
	const [pending, setPending] = (0, import_react.useState)(null);
	const [dragOver, setDragOver] = (0, import_react.useState)(false);
	const [historyTick, setHistoryTick] = (0, import_react.useState)(0);
	const [staySelection, setStaySelection] = (0, import_react.useState)(false);
	const singleScrollRef = (0, import_react.useRef)(null);
	const leftScrollRef = (0, import_react.useRef)(null);
	const rightScrollRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	const mateFileRef = (0, import_react.useRef)(null);
	const findRef = (0, import_react.useRef)(null);
	const noteRef = (0, import_react.useRef)(null);
	const viewports = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const marksRef = (0, import_react.useRef)(marks);
	const importedRef = (0, import_react.useRef)(imported);
	const bytesRef = (0, import_react.useRef)(null);
	const pdfRef = (0, import_react.useRef)(null);
	const draftRef = (0, import_react.useRef)({
		tool,
		pass,
		ink,
		label
	});
	const undoRef = (0, import_react.useRef)([]);
	const redoRef = (0, import_react.useRef)([]);
	const noteDirty = (0, import_react.useRef)(false);
	const noteSnapshot = (0, import_react.useRef)(null);
	const activeIdRef = (0, import_react.useRef)(null);
	const mateDocRef = (0, import_react.useRef)(null);
	const mateTicket = (0, import_react.useRef)(0);
	const openTicket = (0, import_react.useRef)(0);
	const gestureBase = (0, import_react.useRef)(null);
	const scaleRef = (0, import_react.useRef)(scale);
	const earlierNameRef = (0, import_react.useRef)(null);
	const stayRef = (0, import_react.useRef)(false);
	const applyRef = (0, import_react.useRef)(() => false);
	marksRef.current = marks;
	importedRef.current = imported;
	pdfRef.current = pdf;
	draftRef.current = {
		tool,
		pass,
		ink,
		label
	};
	activeIdRef.current = activeId;
	mateDocRef.current = mate;
	scaleRef.current = scale;
	stayRef.current = staySelection;
	(0, import_react.useEffect)(() => {
		try {
			const stored = localStorage.getItem("quire-stay-selection") === "1";
			stayRef.current = stored;
			setStaySelection(stored);
		} catch {}
	}, []);
	(0, import_react.useEffect)(() => {
		document.title = fileName ? `${fileName} — Quire` : "Quire";
	}, [fileName]);
	(0, import_react.useEffect)(() => {
		if (window.innerWidth < 768) setRailOpen(false);
	}, []);
	(0, import_react.useEffect)(() => {
		if (zoomMode !== "fit" || !pdf) return;
		const split = !!mate || viewMode !== "single";
		const el = split ? leftScrollRef.current : singleScrollRef.current;
		const right = mate ? rightScrollRef.current : null;
		if (!el) return;
		const apply = () => {
			const gutter = split ? 24 : el.clientWidth < 640 ? 32 : 80;
			const next = Math.min(1.75, Math.max(.4, (el.clientWidth - gutter) / baseWidth));
			setScale(next);
			if (right && mate) {
				const fitted = Math.min(1.75, Math.max(.4, (right.clientWidth - gutter) / mate.baseWidth));
				setMateScale(fitted);
			}
		};
		apply();
		const observer = new ResizeObserver(apply);
		observer.observe(el);
		if (right) observer.observe(right);
		return () => observer.disconnect();
	}, [
		zoomMode,
		pdf,
		baseWidth,
		viewMode,
		mate
	]);
	(0, import_react.useEffect)(() => {
		if (!sessionKey || !fileName) return;
		const handle = window.setTimeout(() => {
			saveSession(sessionKey, {
				name: fileName,
				marks,
				importedSourceIds: imported,
				savedAt: Date.now()
			});
		}, 350);
		return () => window.clearTimeout(handle);
	}, [
		sessionKey,
		fileName,
		marks,
		imported
	]);
	(0, import_react.useEffect)(() => {
		if (!pdf) return;
		const q = query.trim();
		if (q.length < 2) {
			setHits([]);
			setHitIndex(0);
			setSearching(false);
			return;
		}
		let cancel = false;
		setSearching(true);
		const handle = window.setTimeout(() => {
			searchPdf(pdf, q).then((found) => {
				if (cancel) return;
				setHits(found);
				setHitIndex(0);
			}).catch(() => {
				if (!cancel) setHits([]);
			}).finally(() => {
				if (!cancel) setSearching(false);
			});
		}, 220);
		return () => {
			cancel = true;
			window.clearTimeout(handle);
		};
	}, [pdf, query]);
	(0, import_react.useEffect)(() => {
		const hit = hits[hitIndex];
		if (!hit) return;
		document.getElementById(`quire-page-a-${hit.page}`)?.scrollIntoView({
			block: "center",
			inline: "nearest"
		});
	}, [hits, hitIndex]);
	(0, import_react.useEffect)(() => {
		if (!activeId || !railOpen) return;
		const handle = window.requestAnimationFrame(() => noteRef.current?.focus());
		return () => window.cancelAnimationFrame(handle);
	}, [activeId, railOpen]);
	(0, import_react.useEffect)(() => {
		if (!pdf) return;
		const panes = !!mate || viewMode !== "single" ? [{
			el: leftScrollRef.current,
			set: setPage
		}, {
			el: rightScrollRef.current,
			set: setMatePage
		}] : [{
			el: singleScrollRef.current,
			set: setPage
		}];
		const stops = [];
		for (const pane of panes) {
			const el = pane.el;
			if (!el) continue;
			let frame = 0;
			const onScroll = () => {
				window.cancelAnimationFrame(frame);
				frame = window.requestAnimationFrame(() => {
					const best = nearestPage(el);
					if (best) pane.set((current) => current === best ? current : best);
				});
			};
			el.addEventListener("scroll", onScroll, { passive: true });
			onScroll();
			stops.push(() => {
				window.cancelAnimationFrame(frame);
				el.removeEventListener("scroll", onScroll);
			});
		}
		return () => {
			for (const stop of stops) stop();
		};
	}, [
		pdf,
		numPages,
		scale,
		viewMode,
		mate,
		mateScale
	]);
	(0, import_react.useEffect)(() => {
		if (!(!!mate || viewMode !== "single") || !(viewMode !== "single" || !!mate && linked) || !pdf) return;
		const left = leftScrollRef.current;
		const right = rightScrollRef.current;
		if (!left || !right) return;
		let lock = false;
		const apply = (source, target) => {
			if (lock) return;
			const sourceMax = source.scrollHeight - source.clientHeight;
			const targetMax = target.scrollHeight - target.clientHeight;
			const next = sourceMax <= 0 || targetMax <= 0 ? 0 : source.scrollTop / sourceMax * targetMax;
			if (Math.abs(target.scrollTop - next) < 1) return;
			lock = true;
			target.scrollTop = next;
			window.requestAnimationFrame(() => {
				lock = false;
			});
		};
		const onLeft = () => apply(left, right);
		const onRight = () => apply(right, left);
		left.addEventListener("scroll", onLeft, { passive: true });
		right.addEventListener("scroll", onRight, { passive: true });
		const observer = new ResizeObserver(() => apply(left, right));
		if (left.firstElementChild) observer.observe(left.firstElementChild);
		if (right.firstElementChild) observer.observe(right.firstElementChild);
		apply(left, right);
		return () => {
			observer.disconnect();
			left.removeEventListener("scroll", onLeft);
			right.removeEventListener("scroll", onRight);
		};
	}, [
		viewMode,
		pdf,
		numPages,
		scale,
		mate,
		mateScale,
		linked
	]);
	function bumpHistory() {
		setHistoryTick((tick) => tick + 1);
	}
	function commitNoteHistory() {
		if (!noteDirty.current || !noteSnapshot.current) {
			noteDirty.current = false;
			return;
		}
		undoRef.current.push(noteSnapshot.current);
		if (undoRef.current.length > 60) undoRef.current.shift();
		redoRef.current = [];
		noteDirty.current = false;
		noteSnapshot.current = null;
		bumpHistory();
	}
	function commit(next, record) {
		if (record) {
			undoRef.current.push(marksRef.current);
			if (undoRef.current.length > 60) undoRef.current.shift();
			redoRef.current = [];
		}
		marksRef.current = next;
		setMarks(next);
		bumpHistory();
	}
	function undo() {
		commitNoteHistory();
		const previous = undoRef.current.pop();
		if (!previous) return;
		redoRef.current.push(marksRef.current);
		marksRef.current = previous;
		setMarks(previous);
		bumpHistory();
	}
	function redo() {
		commitNoteHistory();
		const next = redoRef.current.pop();
		if (!next) return;
		undoRef.current.push(marksRef.current);
		marksRef.current = next;
		setMarks(next);
		bumpHistory();
	}
	function patchMark(id, patch) {
		commitNoteHistory();
		commit(marksRef.current.map((mark) => mark.id === id ? {
			...mark,
			...patch
		} : mark), true);
	}
	function onNote(id, value) {
		if (!noteDirty.current) {
			noteDirty.current = true;
			noteSnapshot.current = marksRef.current;
		}
		commit(marksRef.current.map((mark) => mark.id === id ? {
			...mark,
			note: value
		} : mark), false);
	}
	function removeMark(id) {
		commitNoteHistory();
		commit(marksRef.current.filter((mark) => mark.id !== id), true);
		setActiveId((current) => current === id ? null : current);
	}
	function clearMarks() {
		commitNoteHistory();
		commit([], true);
		setActiveId(null);
	}
	function pickMark(id, scroll) {
		commitNoteHistory();
		setActiveId(id);
		setRailOpen(true);
		if (!scroll) return;
		const mark = marksRef.current.find((item) => item.id === id);
		if (mark) document.getElementById(`quire-page-a-${mark.page}`)?.scrollIntoView({
			block: "center",
			inline: "nearest"
		});
	}
	function applyLiveSelection(kind) {
		const draft = draftRef.current;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
		const node = selection.anchorNode;
		const pageEl = (node instanceof Element ? node : node?.parentElement)?.closest("[data-page]");
		if (!pageEl || pageEl.dataset.pane === "mate") return false;
		const pageNumber = Number(pageEl.dataset.page);
		const viewport = viewports.current.get(pageNumber);
		if (!viewport || !pdfRef.current) return false;
		const picked = selectionOnPage(pageEl, viewport);
		if (!picked) return false;
		if (!stayRef.current) selection.removeAllRanges();
		commitNoteHistory();
		const mark = {
			id: crypto.randomUUID(),
			page: pageNumber,
			kind,
			pass: draft.pass,
			ink: draft.ink,
			label: draft.label,
			note: "",
			quote: picked.quote,
			quads: picked.quads,
			createdAt: Date.now()
		};
		commit([...marksRef.current, mark], true);
		setActiveId(mark.id);
		setRailOpen(true);
		return true;
	}
	applyRef.current = applyLiveSelection;
	function chooseTool(next) {
		const previous = draftRef.current.tool;
		setTool(next);
		if (!stayRef.current) return;
		if (next !== "highlight" && next !== "underline" && next !== "strikeout") return;
		if (next === previous) return;
		applyLiveSelection(next);
	}
	function toggleStay() {
		setStaySelection((value) => {
			const next = !value;
			stayRef.current = next;
			try {
				localStorage.setItem("quire-stay-selection", next ? "1" : "0");
			} catch {}
			return next;
		});
	}
	(0, import_react.useEffect)(() => {
		let last = 0;
		function createFromSelection() {
			const draft = draftRef.current;
			if (draft.tool !== "highlight" && draft.tool !== "underline" && draft.tool !== "strikeout") return;
			applyRef.current(draft.tool);
		}
		function onPointerUp(event) {
			const target = event.target;
			if (!(target instanceof Element ? target : target instanceof Node ? target.parentElement : null)?.closest("[data-page]")) return;
			const now = Date.now();
			if (now - last < 80) return;
			last = now;
			window.setTimeout(createFromSelection, 0);
		}
		document.addEventListener("mouseup", onPointerUp);
		document.addEventListener("touchend", onPointerUp);
		return () => {
			document.removeEventListener("mouseup", onPointerUp);
			document.removeEventListener("touchend", onPointerUp);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		function onKey(event) {
			const target = event.target;
			const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
				event.preventDefault();
				findRef.current?.focus();
				findRef.current?.select();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
				if (typing) return;
				event.preventDefault();
				if (event.shiftKey) redo();
				else undo();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
				if (typing) return;
				event.preventDefault();
				redo();
				return;
			}
			if (typing) return;
			const key = event.key.toLowerCase();
			if (key === "h") chooseTool("highlight");
			else if (key === "u") chooseTool("underline");
			else if (key === "s") chooseTool("strikeout");
			else if (key === "c") chooseTool("callout");
			else if (key === "a") chooseTool("arrow");
			else if (key === "v") chooseTool("select");
			else if ((key === "delete" || key === "backspace") && activeIdRef.current) {
				event.preventDefault();
				removeMark(activeIdRef.current);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	function choosePass(next) {
		setPass(next);
		setInk(next === 1 ? "brass" : "steel");
	}
	function gestureStart() {
		commitNoteHistory();
		gestureBase.current = marksRef.current;
	}
	function gestureMove(id, patch) {
		const next = marksRef.current.map((mark) => mark.id === id ? {
			...mark,
			...patch
		} : mark);
		marksRef.current = next;
		setMarks(next);
	}
	function gestureEnd(moved) {
		const base = gestureBase.current;
		gestureBase.current = null;
		if (!base || !moved) return;
		undoRef.current.push(base);
		if (undoRef.current.length > 60) undoRef.current.shift();
		redoRef.current = [];
		bumpHistory();
	}
	function placeShape(pageNumber, place) {
		const draft = draftRef.current;
		commitNoteHistory();
		const mark = {
			id: crypto.randomUUID(),
			page: pageNumber,
			kind: place.kind,
			pass: draft.pass,
			ink: draft.ink,
			label: draft.label,
			note: "",
			quote: "",
			quads: place.kind === "callout" ? [place.quad] : [],
			from: place.kind === "arrow" ? place.from : void 0,
			to: place.kind === "arrow" ? place.to : place.tip,
			createdAt: Date.now()
		};
		commit([...marksRef.current, mark], true);
		setActiveId(mark.id);
		setRailOpen(true);
	}
	function nudgeZoom(direction) {
		setZoomMode("manual");
		const factor = direction > 0 ? 1.1 : 1 / 1.1;
		const clamp = (current) => Math.min(2.5, Math.max(.5, Math.round(current * factor * 100) / 100));
		setScale((current) => clamp(current));
		setMateScale((current) => clamp(current));
	}
	function jumpTo(side, raw) {
		const count = side === "a" ? numPages : mate?.numPages ?? 0;
		const number = Number(raw);
		if (!Number.isFinite(number) || !count) return;
		const next = Math.min(count, Math.max(1, Math.round(number)));
		if (side === "a") setPage(next);
		else setMatePage(next);
		document.getElementById(`quire-page-${side}-${next}`)?.scrollIntoView({
			block: "start",
			inline: "nearest"
		});
	}
	function stepHit(direction) {
		if (!hits.length) return;
		setHitIndex((current) => (current + direction + hits.length) % hits.length);
	}
	async function loadBytes(name, bytes) {
		const ticket = ++openTicket.current;
		setBusy(true);
		setError("");
		setStatus("Opening…");
		setPending(null);
		try {
			const [nextPdf, key] = await Promise.all([openPdf(bytes), fingerprint(bytes)]);
			if (ticket !== openTicket.current) {
				nextPdf.cleanup();
				return;
			}
			const [first, session] = await Promise.all([nextPdf.getPage(1), loadSession(key)]);
			if (ticket !== openTicket.current) {
				nextPdf.cleanup();
				return;
			}
			const previous = pdfRef.current;
			const width = first.getViewport({ scale: 1 }).width;
			bytesRef.current = bytes;
			pdfRef.current = nextPdf;
			dropMate();
			setPdf(nextPdf);
			setFileName(name);
			setBaseWidth(width);
			setNumPages(nextPdf.numPages);
			setPage(1);
			setQuery("");
			setHits([]);
			setZoomMode("fit");
			undoRef.current = [];
			redoRef.current = [];
			noteDirty.current = false;
			noteSnapshot.current = null;
			viewports.current.clear();
			setActiveId(null);
			setSessionKey(key);
			if (previous && previous !== nextPdf) previous.cleanup();
			if (session) {
				marksRef.current = session.marks;
				setMarks(session.marks);
				setImported(session.importedSourceIds);
				setStatus(session.marks.length ? `Restored ${session.marks.length} mark${session.marks.length === 1 ? "" : "s"} kept on this machine.` : "Opened. Select text to mark it.");
				bumpHistory();
				return;
			}
			marksRef.current = [];
			setMarks([]);
			setImported([]);
			bumpHistory();
			setStatus("Reading marks already in the file…");
			const parsed = await readExisting(nextPdf);
			if (ticket !== openTicket.current || pdfRef.current !== nextPdf) return;
			marksRef.current = parsed.marks;
			setMarks(parsed.marks);
			setImported(parsed.ids);
			setStatus(parsed.marks.length ? `Opened with ${parsed.marks.length} mark${parsed.marks.length === 1 ? "" : "s"} already in the file.` : "Opened. Select text to mark it.");
			bumpHistory();
		} catch (err) {
			if (ticket !== openTicket.current) return;
			setError(messageFrom(err));
			setStatus("");
		} finally {
			if (ticket === openTicket.current) setBusy(false);
		}
	}
	function requestOpen(next) {
		if (next !== "sample" && !isPdf(next)) {
			setError("Choose a PDF.");
			return;
		}
		if (marksRef.current.length > 0) {
			setPending(next);
			return;
		}
		beginOpen(next);
	}
	async function beginOpen(next) {
		if (next === "sample") {
			setStatus("Preparing the sample…");
			await loadBytes("Quorum interim results.pdf", await buildSamplePdf());
			return;
		}
		const bytes = new Uint8Array(await next.arrayBuffer());
		await loadBytes(next.name, bytes);
	}
	async function exportPdf() {
		const bytes = bytesRef.current;
		if (!bytes || !fileName) return;
		setExporting("pdf");
		setError("");
		try {
			commitNoteHistory();
			const marked = marksRef.current;
			const pages = new Set(marked.map((mark) => mark.page)).size;
			if (!pages) {
				setStatus("No marked pages yet.");
				return;
			}
			const output = await markedPagesPdf(bytes, marked, importedRef.current);
			if (!output) {
				setStatus("No marked pages yet.");
				return;
			}
			downloadBlob(new Blob([output.slice(0)], { type: "application/pdf" }), `${safeStem(fileName)}-marked.pdf`);
			setStatus(pages === 1 ? "Downloaded 1 marked page. Open it in Acrobat, Preview, or back here." : `Downloaded ${pages} marked pages. Open them in Acrobat, Preview, or back here.`);
		} catch {
			setError("The comment sheet is still available. This PDF could not be rewritten.");
		} finally {
			setExporting(null);
		}
	}
	function dropMate() {
		mateTicket.current += 1;
		setMateBusy(false);
		const current = mateDocRef.current;
		if (!current) return;
		mateDocRef.current = null;
		setMate(null);
		current.pdf.cleanup();
	}
	function closeMate() {
		dropMate();
		setStatus("Compare closed. Marks are still on this file.");
	}
	async function loadMate(file) {
		if (!isPdf(file)) {
			setError("Choose a PDF.");
			return;
		}
		const ticket = ++mateTicket.current;
		setMateBusy(true);
		setError("");
		setStatus("Opening the second PDF…");
		try {
			const next = await openPdf(new Uint8Array(await file.arrayBuffer()));
			if (ticket !== mateTicket.current || !pdfRef.current) {
				next.cleanup();
				return;
			}
			const width = (await next.getPage(1)).getViewport({ scale: 1 }).width;
			const previous = mateDocRef.current;
			const opened = {
				pdf: next,
				name: file.name,
				numPages: next.numPages,
				baseWidth: width
			};
			mateDocRef.current = opened;
			setMate(opened);
			setMateScale(scaleRef.current);
			setLinked(true);
			setMatePage(1);
			if (previous) previous.pdf.cleanup();
			setStatus("Compare is open. Scrolling one side moves the other. Marks stay on this file.");
		} catch (err) {
			if (ticket === mateTicket.current) setError(messageFrom(err));
		} finally {
			if (ticket === mateTicket.current) setMateBusy(false);
		}
	}
	async function findChanges() {
		const later = pdfRef.current;
		const earlier = mateDocRef.current?.pdf;
		if (!later || !earlier || comparing) return;
		setComparing(true);
		setError("");
		setStatus("Comparing. This file is the later copy.");
		try {
			const found = await compareDocuments(earlier, later, draftRef.current.pass);
			earlierNameRef.current = mateDocRef.current?.name ?? earlierNameRef.current;
			const kept = marksRef.current.filter((mark) => !mark.id.startsWith("change-"));
			commitNoteHistory();
			commit([...kept, ...found.marks], true);
			if (found.marks[0]) {
				setActiveId(found.marks[0].id);
				setRailOpen(true);
			}
			if (!found.marks.length) setStatus("No text changes.");
			else if (found.capped) setStatus("Marked 400 changes, then stopped. Undo if these are not two versions of one text.");
			else {
				const count = found.marks.length;
				setStatus(count === 1 ? "Marked 1 change. Changes PDF downloads the list and the changed page." : `Marked ${count} changes. Changes PDF downloads the list and the changed pages.`);
			}
		} catch {
			setError("The two files could not be compared.");
		} finally {
			setComparing(false);
		}
	}
	async function exportChanges() {
		const bytes = bytesRef.current;
		if (!bytes || !fileName) return;
		const changes = marksRef.current.filter((mark) => mark.id.startsWith("change-"));
		if (!changes.length) {
			setStatus("No comparison results yet. Open Compare, then Changes.");
			return;
		}
		setExporting("changes");
		setError("");
		try {
			commitNoteHistory();
			const output = await comparisonResultsPdf(bytes, changes, fileName, earlierNameRef.current);
			if (!output) {
				setStatus("No comparison results yet. Open Compare, then Changes.");
				return;
			}
			downloadBlob(new Blob([output.slice(0)], { type: "application/pdf" }), `${safeStem(fileName)}-changes.pdf`);
			const pages = new Set(changes.map((mark) => mark.page)).size;
			setStatus(pages === 1 ? "Downloaded the comparison: a list, then 1 changed page." : `Downloaded the comparison: a list, then ${pages} changed pages.`);
		} catch {
			setError("The comparison PDF could not be written.");
		} finally {
			setExporting(null);
		}
	}
	function exportSheet() {
		if (!fileName) return;
		commitNoteHistory();
		const markdown = marksToMarkdown(fileName, marksRef.current);
		downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), `${safeStem(fileName)}-notes.md`);
		setStatus("Comment sheet downloaded.");
	}
	const canUndo = undoRef.current.length > 0 || noteDirty.current;
	const canRedo = redoRef.current.length > 0;
	const pair = !!pdf && !!mate;
	const sides = !!pdf && !mate && viewMode !== "single" ? pageSides(numPages, viewMode === "halves" ? "halves" : "facing") : null;
	const splitChrome = pair || viewMode !== "single";
	function renderPages(doc, numbers, side, pageScale) {
		const prefix = side === "work" ? "a" : "b";
		return numbers.map((pageNumber, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PdfPage, {
			pdf: doc,
			pageNumber,
			scale: pageScale,
			marks: side === "work" ? marks : [],
			hits: side === "work" ? hits : [],
			activeHit: side === "work" ? hitIndex : -1,
			activeId: side === "work" ? activeId : null,
			tool: side === "work" ? tool : "highlight",
			eager: index === 0,
			pane: side,
			domId: `quire-page-${prefix}-${pageNumber}`,
			onPick: (id) => pickMark(id, false),
			onPlace: side === "work" ? placeShape : void 0,
			onGestureStart: side === "work" ? gestureStart : void 0,
			onGestureMove: side === "work" ? gestureMove : void 0,
			onGestureEnd: side === "work" ? gestureEnd : void 0,
			onViewport: side === "work" ? (number, viewport) => {
				viewports.current.set(number, viewport);
			} : () => {}
		}, `${side}-${pageNumber}`));
	}
	const workNumbers = Array.from({ length: numPages }, (_, index) => index + 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "quire-app flex h-dvh flex-col overflow-hidden bg-desk text-paper",
		onDragOver: (event) => {
			event.preventDefault();
			setDragOver(true);
		},
		onDragLeave: () => setDragOver(false),
		onDrop: (event) => {
			event.preventDefault();
			setDragOver(false);
			const file = event.dataTransfer.files?.[0];
			if (file) requestOpen(file);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "shrink-0 border-b border-line-dark",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex h-14 items-center gap-2 px-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "quire-word font-display text-2xl leading-none tracking-tight",
							children: "Quire"
						}),
						fileName && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "hidden min-w-0 flex-1 truncate text-sm text-muted sm:block",
							children: fileName
						}),
						!fileName && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "min-w-0 flex-1" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							htmlFor: "quire-open",
							className: "quire-file inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-brass px-3 text-sm text-paper",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
									size: 16,
									strokeWidth: 1.75
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: "Open PDF"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "sm:hidden",
									children: "Open"
								})
							]
						}),
						pdf && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => void exportPdf(),
								disabled: !marks.length || exporting !== null,
								"aria-label": "Download marked PDF",
								title: "Download the pages that have marks",
								className: "inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDown, {
									size: 16,
									strokeWidth: 1.75
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden md:inline",
									children: exporting === "pdf" ? "Saving…" : "Marked PDF"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => void exportChanges(),
								disabled: !marks.some((mark) => mark.id.startsWith("change-")) || exporting !== null,
								"aria-label": "Download comparison PDF",
								title: "Download the comparison list, then the changed pages",
								className: "inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitCompare, {
									size: 16,
									strokeWidth: 1.75
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden md:inline",
									children: exporting === "changes" ? "Saving…" : "Changes PDF"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: exportSheet,
								disabled: !marks.length || exporting !== null,
								"aria-label": "Download comment sheet",
								title: "Download comment sheet",
								className: "inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {
									size: 16,
									strokeWidth: 1.75
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden md:inline",
									children: "Sheet"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setRailOpen((open) => !open),
								"aria-pressed": railOpen,
								"aria-label": "Marks",
								className: `inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${railOpen ? "bg-brass text-paper" : "bg-raised text-paper"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelRight, {
									size: 16,
									strokeWidth: 1.75
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular-nums",
									children: marks.length
								})]
							})
						] })
					]
				}), pdf && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 overflow-x-auto border-t border-line-dark px-3 py-2 md:flex-wrap md:overflow-visible",
					onMouseDown: (event) => {
						const target = event.target;
						if (target.closest("input, textarea, select, option")) return;
						if (!stayRef.current && !target.closest("[data-stay]")) return;
						event.preventDefault();
					},
					children: [
						TOOLS.map((item) => {
							const Icon = item.icon;
							const pressed = tool === item.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								title: item.hint,
								"aria-label": item.hint,
								"aria-pressed": pressed,
								onClick: () => chooseTool(item.id),
								className: `inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${pressed ? "bg-brass text-paper" : "bg-raised text-paper"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									size: 16,
									strokeWidth: 1.75
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: item.name
								})]
							}, item.id);
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-6 w-px shrink-0 bg-line-dark" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							title: "Undo (Ctrl+Z)",
							"aria-label": "Undo",
							disabled: !canUndo,
							onClick: undo,
							className: "inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, {
								size: 16,
								strokeWidth: 1.75
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Undo"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							title: "Redo (Ctrl+Shift+Z)",
							"aria-label": "Redo",
							disabled: !canRedo,
							onClick: redo,
							className: "inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Redo2, {
								size: 16,
								strokeWidth: 1.75
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Redo"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-6 w-px shrink-0 bg-line-dark" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": pass === 1,
							onClick: () => choosePass(1),
							className: `h-11 shrink-0 rounded-md px-3 text-sm ${pass === 1 ? "bg-brass text-paper" : "bg-raised text-paper"}`,
							children: "First read"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-pressed": pass === 2,
							onClick: () => choosePass(2),
							className: `h-11 shrink-0 rounded-md px-3 text-sm ${pass === 2 ? "bg-steel text-paper" : "bg-raised text-paper"}`,
							children: "Second read"
						}),
						INKS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							title: item.name,
							"aria-label": item.name,
							"aria-pressed": ink === item.id,
							onClick: () => setInk(item.id),
							className: `inline-flex h-11 w-11 shrink-0 items-center justify-center ${ink === item.id ? "bg-stamp" : "bg-paper"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block h-4 w-4 rounded-full",
								style: { background: `var(--color-${item.id})` }
							})
						}, item.id)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "sr-only",
							htmlFor: "quire-new-label",
							children: "Label for new marks"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							id: "quire-new-label",
							value: label,
							"aria-label": "Label for new marks",
							onChange: (event) => setLabel(event.target.value),
							className: "h-11 shrink-0 rounded-md border border-line-dark bg-raised px-2 text-sm text-paper",
							children: LABELS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: item.id,
								children: item.name
							}, item.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							role: "switch",
							"data-stay": "",
							"aria-checked": staySelection,
							title: "Stay selection. The passage stays selected, so the next highlight, underline, or strike uses it too.",
							onClick: toggleStay,
							className: `h-11 shrink-0 rounded-md px-3 text-sm ${staySelection ? "bg-brass text-paper" : "bg-raised text-paper"}`,
							children: "Stay selection"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-6 w-px shrink-0 bg-line-dark" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "relative shrink-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "sr-only",
									children: "Find in the PDF"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
									size: 16,
									strokeWidth: 1.75,
									className: "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									ref: findRef,
									value: query,
									onChange: (event) => setQuery(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											stepHit(event.shiftKey ? -1 : 1);
										}
									},
									placeholder: "Find",
									className: "h-11 w-36 rounded-md border border-line-dark bg-raised pr-3 pl-9 text-sm text-paper outline-none focus:border-brass sm:w-48"
								})
							]
						}),
						query.trim().length >= 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 text-sm text-muted tabular-nums",
							children: searching ? "Searching…" : hits.length ? `${hitIndex + 1} / ${hits.length}` : "No matches"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-1 h-6 w-px shrink-0 bg-line-dark" }),
						!mate && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": viewMode === "single",
								onClick: () => setViewMode("single"),
								className: `h-11 shrink-0 rounded-md px-3 text-sm ${viewMode === "single" ? "bg-brass text-paper" : "bg-raised text-paper"}`,
								children: "Single"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								title: "Odd pages beside even pages. Scrolling one side moves the other.",
								"aria-pressed": viewMode === "facing",
								onClick: () => setViewMode("facing"),
								className: `inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${viewMode === "facing" ? "bg-brass text-paper" : "bg-raised text-paper"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Columns2, {
									size: 16,
									strokeWidth: 1.75
								}), "Facing"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								title: "First half beside the second half. Scrolling one side moves the other.",
								"aria-pressed": viewMode === "halves",
								onClick: () => setViewMode("halves"),
								className: `h-11 shrink-0 rounded-md px-3 text-sm ${viewMode === "halves" ? "bg-brass text-paper" : "bg-raised text-paper"}`,
								children: "Halves"
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							title: "Compare. Open a second PDF beside this one. Scrolling stays linked. Marks stay on this file.",
							"aria-label": "Compare",
							"aria-pressed": !!mate,
							disabled: mateBusy,
							onClick: () => mateFileRef.current?.click(),
							className: `inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm disabled:opacity-40 ${mate ? "bg-brass text-paper" : "bg-raised text-paper"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Files, {
								size: 16,
								strokeWidth: 1.75
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: mateBusy ? "Opening…" : "Compare" })]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `flex min-h-0 flex-1 ${dragOver ? "quire-dropping" : ""}`,
				children: [
					!pdf && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0 flex-1 overflow-auto",
						children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex min-h-full items-center justify-center px-6",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: status || "Opening…"
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex min-h-full items-center justify-center px-4 py-10",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "quire-card w-full max-w-xl",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "quire-kicker",
										children: "Portable proof desk"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
										className: "mt-4 text-4xl text-balance text-paper sm:text-5xl",
										children: "Mark the text. Keep the file."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-4 max-w-lg text-base text-pretty text-muted",
										children: "Highlight, underline, or strike a passage, or drag a callout or an arrow. Each mark takes a note, a colour, and a first or second read. Nothing is uploaded. Marked PDF downloads only the pages you marked, for Acrobat or Preview. Or take a comment sheet."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-6 flex flex-wrap gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											htmlFor: "quire-open",
											className: "quire-file inline-flex h-11 items-center gap-2 rounded-md bg-brass px-4 text-sm text-paper",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
												size: 16,
												strokeWidth: 1.75
											}), "Open a PDF"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => requestOpen("sample"),
											className: "inline-flex h-11 items-center gap-2 rounded-md bg-raised px-4 text-sm text-paper",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
												size: 16,
												strokeWidth: 1.75
											}), "Try the sample"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-6 max-w-lg text-sm text-pretty text-muted",
										children: "The sample is a two-page interim results note. The revenue percentage does not match the figures. First read is the first time through the file. Second read is the check after that. Compare opens a second PDF beside this one. Changes marks what this later copy added or deleted. Changes PDF downloads that list and the changed pages."
									}),
									error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-4 text-sm text-paper",
										role: "alert",
										children: error
									})
								]
							})
						})
					}),
					pdf && !pair && viewMode === "single" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: singleScrollRef,
						className: "min-w-0 flex-1 overflow-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-3 py-6 sm:px-8",
							children: [marks.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-4 text-center text-sm text-muted",
								children: tool === "callout" ? "Press where it should point, then drag the box into place. A selected callout can be dragged; the dot moves the point." : tool === "arrow" ? "Drag the arrow. Select it, then drag the line or either end." : tool === "select" ? "Select is on. Click a mark to move it, or choose Highlight, Underline, or Strike." : `Select a line. This mark is a ${pass === 1 ? "first read" : "second read"}, in the colour chosen above.${staySelection ? " Stay selection keeps that line selected." : ""}`
							}), renderPages(pdf, workNumbers, "work", scale)]
						})
					}),
					pdf && sides && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pane, {
							title: viewMode === "facing" ? "Odd pages" : "First half",
							scrollerRef: leftScrollRef,
							children: sides.left.length ? renderPages(pdf, sides.left, "work", scale) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptySide, {})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pane, {
							title: viewMode === "facing" ? "Even pages" : "Second half",
							scrollerRef: rightScrollRef,
							children: sides.right.length ? renderPages(pdf, sides.right, "work", scale) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptySide, {})
						})]
					}),
					pdf && mate && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-h-0 min-w-0 flex-1 flex-col md:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Pane, {
							title: fileName ?? "This file",
							scrollerRef: leftScrollRef,
							children: [marks.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mb-4 text-center text-sm text-muted",
								children: [
									"Select a line on this file. This mark is a ",
									pass === 1 ? "first read" : "second read",
									", in the colour chosen above."
								]
							}), renderPages(pdf, workNumbers, "work", scale)]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Pane, {
							title: mate.name,
							scrollerRef: rightScrollRef,
							extra: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: comparing,
									title: "Mark how this file differs from Compare. This file is the later copy. Added text is highlighted. Deleted text becomes a callout.",
									onClick: () => void findChanges(),
									className: "h-11 shrink-0 rounded-md bg-brass px-3 text-sm text-paper disabled:opacity-40",
									children: comparing ? "Comparing…" : "Changes"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-pressed": linked,
									title: linked ? "Scrolling is linked. Click to move each file on its own." : "Scrolling is independent. Click to link the two files again.",
									onClick: () => setLinked((value) => !value),
									className: `h-11 shrink-0 rounded-md px-3 text-sm ${linked ? "bg-brass text-paper" : "bg-raised text-paper"}`,
									children: linked ? "Linked" : "Free"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: closeMate,
									className: "h-11 shrink-0 rounded-md bg-raised px-3 text-sm text-paper",
									children: "Close"
								})
							] }),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-4 text-center text-sm text-muted",
								children: "Compare. Marks stay on the other file. Changes treats this file as the later copy."
							}), renderPages(mate.pdf, Array.from({ length: mate.numPages }, (_, index) => index + 1), "mate", mateScale)]
						})]
					}),
					pdf && railOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rail, {
						marks,
						activeId,
						noteRef,
						onClose: () => setRailOpen(false),
						onPick: (id) => pickMark(id, true),
						onPatch: patchMark,
						onNote,
						onNoteBlur: commitNoteHistory,
						onDelete: removeMark,
						onClear: clearMarks
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-t border-line-dark px-3 text-sm text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden sm:inline",
						children: "On this machine"
					}),
					pdf && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "inline-flex items-center gap-2 tabular-nums",
							children: [
								splitChrome ? "Left" : "Page",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									defaultValue: page,
									inputMode: "numeric",
									"aria-label": splitChrome ? "Left page" : "Page number",
									onBlur: (event) => jumpTo("a", event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") {
											jumpTo("a", event.target.value);
											event.target.blur();
										}
									},
									className: "h-11 w-14 rounded-md bg-raised text-center text-paper"
								}, `${viewMode}-${pair ? "pair" : "one"}-${page}`),
								splitChrome ? null : `/ ${numPages}`
							]
						}),
						splitChrome && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "inline-flex items-center gap-2 tabular-nums",
							children: ["Right", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								defaultValue: matePage || "",
								inputMode: "numeric",
								"aria-label": "Right page",
								onBlur: (event) => jumpTo(pair ? "b" : "a", event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter") {
										jumpTo(pair ? "b" : "a", event.target.value);
										event.target.blur();
									}
								},
								className: "h-11 w-14 rounded-md bg-raised text-center text-paper"
							}, `${viewMode}-${pair ? "pair" : "one"}-mate-${matePage}`)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Zoom out",
									onClick: () => nudgeZoom(-1),
									className: "inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-raised",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, { size: 14 })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setZoomMode("fit"),
									className: "h-11 px-2 tabular-nums text-paper",
									title: "Fit width",
									children: zoomMode === "fit" ? "Fit" : `${Math.round(scale * 100)}%`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Zoom in",
									onClick: () => nudgeZoom(1),
									className: "inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-raised",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 14 })
								})
							]
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate text-paper",
						"aria-live": "polite",
						children: error || status
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: fileRef,
				id: "quire-open",
				type: "file",
				accept: ".pdf",
				className: "sr-only",
				onChange: (event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) requestOpen(file);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: mateFileRef,
				id: "quire-compare",
				type: "file",
				accept: "application/pdf,.pdf",
				className: "hidden",
				onChange: (event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) loadMate(file);
				}
			}),
			pending && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm rounded-md bg-paper p-5 text-ink",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-2xl text-balance",
							children: "Open another file?"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-pretty text-ink-soft",
							children: "Marks on this file stay in this browser. They are not uploaded."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 flex justify-end gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setPending(null),
								className: "h-11 rounded-md px-4 text-sm text-ink",
								children: "Stay"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void beginOpen(pending),
								className: "h-11 rounded-md bg-brass px-4 text-sm text-paper",
								children: "Open"
							})]
						})
					]
				})
			})
		]
	});
}
function isPdf(file) {
	return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
function Pane({ title, scrollerRef, children, extra }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex min-h-0 min-w-0 flex-1 flex-col border-t border-line-dark first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex shrink-0 items-center gap-2 border-b border-line-dark px-3 py-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "min-w-0 flex-1 truncate text-sm text-muted",
				children: title
			}), extra]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: scrollerRef,
			className: "min-h-0 flex-1 overflow-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-w-0 px-3 py-4",
				children
			})
		})]
	});
}
function EmptySide() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "py-6 text-sm text-muted",
		children: "No page on this side."
	});
}
function messageFrom(error) {
	if (error && typeof error === "object" && "name" in error) {
		const name = String(error.name);
		if (name === "PasswordException") return "This PDF is password-protected. Quire cannot open it.";
		if (name === "InvalidPDFException") return "That file is not a PDF Quire can read.";
	}
	if (error instanceof Error && /password/i.test(error.message)) return "This PDF is password-protected. Quire cannot open it.";
	return "Quire could not open that file. It may be damaged or not a PDF.";
}
var TOOLS;
var init_Desk = __esmMin((() => {
	init_PdfPage();
	init_Rail();
	init_geometry();
	init_markdown();
	init_marks();
	init_compare_pdf();
	init_embed_marks();
	init_pdf_client();
	init_sample_pdf();
	init_session();
	TOOLS = [
		{
			id: "select",
			name: "Select",
			hint: "Select marks (V)",
			icon: MousePointer2
		},
		{
			id: "highlight",
			name: "Highlight",
			hint: "Highlight (H)",
			icon: Highlighter
		},
		{
			id: "underline",
			name: "Underline",
			hint: "Underline (U)",
			icon: Underline
		},
		{
			id: "strikeout",
			name: "Strike",
			hint: "Strikeout (S)",
			icon: Strikethrough
		},
		{
			id: "callout",
			name: "Callout",
			hint: "Callout (C). Press the point, then drag the box.",
			icon: MessageSquare
		},
		{
			id: "arrow",
			name: "Arrow",
			hint: "Arrow (A). Drag. The head is where you let go.",
			icon: ArrowUpRight
		}
	];
}));
var SplitComponent;
__esmMin((() => {
	init_Desk();
	SplitComponent = Desk;
}))();
//#endregion
export { SplitComponent as component };
