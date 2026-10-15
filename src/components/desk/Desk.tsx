import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  FileDown,
  FileText,
  Files,
  GitCompare,
  Highlighter,
  Languages,
  MessageSquare,
  Minus,
  MousePointer2,
  PanelRight,
  Plus,
  Redo2,
  Search,
  SpellCheck,
  Strikethrough,
  Underline,
  Undo2,
  Upload,
} from "lucide-react";
import { PdfPage, type ShapePlace } from "@/components/desk/PdfPage";
import { Rail } from "@/components/desk/Rail";
import { joinCopiedLines } from "@/lib/copy-text";
import { grammarMarks } from "@/lib/grammar";
import { selectionOnPage, type ViewportLike } from "@/lib/geometry";
import { downloadBlob, marksToMarkdown, safeStem } from "@/lib/markdown";
import {
  INKS,
  LABELS,
  type InkId,
  type Kind,
  type LabelId,
  type Mark,
  type Tool,
} from "@/lib/marks";
import { compareDocuments } from "@/lib/compare-pdf";
import { checkBilingual, marksOnTarget, type PairCheck } from "@/lib/bilingual-check";
import { comparisonResultsPdf, embedMarks, markedPagesPdf } from "@/lib/embed-marks";
import { openPdf, readExisting, searchPdf, type PdfDoc, type SearchHit } from "@/lib/pdf-client";
import { buildSamplePdf } from "@/lib/sample-pdf";
import { fingerprint, loadSession, saveSession } from "@/lib/session";
import { fetchLaunchedPdf } from "@/lib/launch-pdf";
import { chromeMimeAvailable, fetchChromePdf } from "@/lib/chrome-pdf";
import { tryPasscode, unlockStored } from "@/lib/passcode";
import { notePasscode } from "@/lib/report";
import { Usage } from "@/components/desk/Usage";

const TOOLS: { id: Tool; name: string; hint: string; icon: typeof MousePointer2 }[] = [
  { id: "select", name: "Select", hint: "Select marks (V)", icon: MousePointer2 },
  { id: "highlight", name: "Highlight", hint: "Highlight (H)", icon: Highlighter },
  { id: "underline", name: "Underline", hint: "Underline (U)", icon: Underline },
  { id: "strikeout", name: "Strike", hint: "Strikeout (S)", icon: Strikethrough },
  { id: "callout", name: "Callout", hint: "Callout (C). Press the point, then drag the box.", icon: MessageSquare },
  { id: "arrow", name: "Arrow", hint: "Arrow (A). Drag. The head is where you let go.", icon: ArrowUpRight },
];

type MateDoc = {
  pdf: PdfDoc;
  name: string;
  numPages: number;
  baseWidth: number;
  bytes: Uint8Array;
};

const docIds = new WeakMap<PdfDoc, string>();
let docSerial = 0;

function docKey(doc: PdfDoc) {
  let id = docIds.get(doc);
  if (!id) {
    docSerial += 1;
    id = `d${docSerial}`;
    docIds.set(doc, id);
  }
  return id;
}

function nearestPage(el: HTMLElement) {
  const rootTop = el.getBoundingClientRect().top + 32;
  let best = 0;
  let bestDist = Infinity;
  el.querySelectorAll<HTMLElement>("[data-page]").forEach((node) => {
    const dist = Math.abs(node.getBoundingClientRect().top - rootTop);
    const number = Number(node.dataset.page);
    if (dist < bestDist && Number.isFinite(number)) {
      bestDist = dist;
      best = number;
    }
  });
  return best;
}

export function Desk({ studio = false, portable = false }: { studio?: boolean; portable?: boolean }) {
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [baseWidth, setBaseWidth] = useState(595);
  const [scale, setScale] = useState(1);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [mate, setMate] = useState<MateDoc | null>(null);
  const [mateScale, setMateScale] = useState(1);
  const [linked, setLinked] = useState(true);
  const [mateBusy, setMateBusy] = useState(false);
  const [matePage, setMatePage] = useState(1);
  const [tool, setTool] = useState<Tool>("select");
  const [ink, setInk] = useState<InkId>("brass");
  const [label, setLabel] = useState<LabelId>("query");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [imported, setImported] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [hitIndex, setHitIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "changes" | "target" | null>(null);
  const [comparing, setComparing] = useState(false);
  const [grammarBusy, setGrammarBusy] = useState(false);
  const [pairKind, setPairKind] = useState<"compare" | "bilingual" | null>(null);
  const [figureReport, setFigureReport] = useState<PairCheck[] | null>(null);
  const [figureBusy, setFigureBusy] = useState(false);
  const [targetMarks, setTargetMarks] = useState<Mark[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [pending, setPending] = useState<File | "sample" | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [staySelection, setStaySelection] = useState(false);
  const [joinLines, setJoinLines] = useState(false);
  const [paid, setPaid] = useState(studio);
  const [usageOpen, setUsageOpen] = useState(false);
  const [gate, setGate] = useState<"open" | "compare" | "bilingual" | "changes" | "pdf" | "sheet" | "changes-pdf" | "unlock" | null>(null);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState("");
  const [heldName, setHeldName] = useState("");
  const heldLaunch = useRef<{ name: string; bytes: Uint8Array; source?: "file" | "chrome" } | null>(null);

  const singleScrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mateFileRef = useRef<HTMLInputElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const viewports = useRef(new Map<number, ViewportLike>());
  const marksRef = useRef(marks);
  const importedRef = useRef(imported);
  const bytesRef = useRef<Uint8Array | null>(null);
  const pdfRef = useRef<PdfDoc | null>(null);
  const draftRef = useRef({ tool, ink, label });
  const undoRef = useRef<Mark[][]>([]);
  const redoRef = useRef<Mark[][]>([]);
  const noteDirty = useRef(false);
  const noteSnapshot = useRef<Mark[] | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const mateDocRef = useRef<MateDoc | null>(null);
  const targetMarksRef = useRef<Mark[]>([]);
  const mateTicket = useRef(0);
  const mateIntent = useRef<"compare" | "bilingual">("compare");
  const openTicket = useRef(0);
  const gestureBase = useRef<Mark[] | null>(null);
  const scaleRef = useRef(scale);
  const earlierNameRef = useRef<string | null>(null);
  const stayRef = useRef(false);
  const joinRef = useRef(false);
  const paidRef = useRef(studio);
  const pendingMate = useRef<File | null>(null);
  const applyRef = useRef<(kind: "highlight" | "underline" | "strikeout") => boolean>(() => false);

  marksRef.current = marks;
  importedRef.current = imported;
  pdfRef.current = pdf;
  draftRef.current = { tool, ink, label };
  activeIdRef.current = activeId;
  mateDocRef.current = mate;
  scaleRef.current = scale;
  stayRef.current = staySelection;
  joinRef.current = joinLines;
  paidRef.current = paid;

  useEffect(() => {
    if (studio) {
      paidRef.current = true;
      setPaid(true);
      return;
    }
    const stored = unlockStored();
    paidRef.current = stored;
    setPaid(stored);
    if (stored && !portable) notePasscode("");
  }, [studio]);

  useEffect(() => {
    if (!portable) return;
    const launch = window.location.hash === "#launch";
    if (!launch && !chromeMimeAvailable()) return;
    let cancel = false;
    void (async () => {
      const launched = launch ? await fetchLaunchedPdf() : await fetchChromePdf();
      if (!launched || cancel) return;
      if (studio || paidRef.current || unlockStored()) {
        await loadBytes(launched.name, launched.bytes, launch ? "file" : "chrome");
        return;
      }
      heldLaunch.current = { name: launched.name, bytes: launched.bytes, source: launch ? "file" : "chrome" };
      setHeldName(launched.name);
      setStatus(`${launched.name} is waiting. Enter the passcode.`);
    })();
    return () => {
      cancel = true;
    };
  }, [portable, studio]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("quire-stay-selection") === "1";
      stayRef.current = stored;
      setStaySelection(stored);
      const join = localStorage.getItem("quire-join-lines") === "1";
      joinRef.current = join;
      setJoinLines(join);
    } catch {
      /* private browsing */
    }
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) setRailOpen(false);
  }, []);

  useEffect(() => {
    if (zoomMode !== "fit" || !pdf) return;
    const split = !!mate;
    const el = split ? leftScrollRef.current : singleScrollRef.current;
    const right = mate ? rightScrollRef.current : null;
    if (!el) return;
    const apply = () => {
      const gutter = split ? 24 : el.clientWidth < 640 ? 32 : 80;
      const next = Math.min(1.75, Math.max(0.4, (el.clientWidth - gutter) / baseWidth));
      setScale(next);
      if (right && mate) {
        const fitted = Math.min(1.75, Math.max(0.4, (right.clientWidth - gutter) / mate.baseWidth));
        setMateScale(fitted);
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    if (right) observer.observe(right);
    return () => observer.disconnect();
  }, [zoomMode, pdf, baseWidth, mate]);

  useEffect(() => {
    if (!sessionKey || !fileName) return;
    const handle = window.setTimeout(() => {
      void saveSession(sessionKey, {
        name: fileName,
        marks,
        importedSourceIds: imported,
        savedAt: Date.now(),
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [sessionKey, fileName, marks, imported]);

  useEffect(() => {
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
      void searchPdf(pdf, q)
        .then((found) => {
          if (cancel) return;
          setHits(found);
          setHitIndex(0);
        })
        .catch(() => {
          if (!cancel) setHits([]);
        })
        .finally(() => {
          if (!cancel) setSearching(false);
        });
    }, 220);
    return () => {
      cancel = true;
      window.clearTimeout(handle);
    };
  }, [pdf, query]);

  useEffect(() => {
    const hit = hits[hitIndex];
    if (!hit) return;
    document.getElementById(`quire-page-a-${hit.page}`)?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [hits, hitIndex]);

  useEffect(() => {
    if (!activeId || !railOpen) return;
    const handle = window.requestAnimationFrame(() => noteRef.current?.focus());
    return () => window.cancelAnimationFrame(handle);
  }, [activeId, railOpen]);

  useEffect(() => {
    if (!pdf) return;
    const panes = mate
      ? [
          { el: leftScrollRef.current, set: setPage },
          { el: rightScrollRef.current, set: setMatePage },
        ]
      : [{ el: singleScrollRef.current, set: setPage }];
    const stops: Array<() => void> = [];
    for (const pane of panes) {
      const el = pane.el;
      if (!el) continue;
      let frame = 0;
      const onScroll = () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const best = nearestPage(el);
          if (best) pane.set((current) => (current === best ? current : best));
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
  }, [pdf, numPages, scale, mate, mateScale]);

  useEffect(() => {
    if (!mate || !linked || !pdf) return;
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    let lock = false;
    const apply = (source: HTMLElement, target: HTMLElement) => {
      if (lock) return;
      const sourceMax = source.scrollHeight - source.clientHeight;
      const targetMax = target.scrollHeight - target.clientHeight;
      const next = sourceMax <= 0 || targetMax <= 0 ? 0 : (source.scrollTop / sourceMax) * targetMax;
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
  }, [pdf, numPages, scale, mate, mateScale, linked]);

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

  function commit(next: Mark[], record: boolean) {
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

  function patchMark(id: string, patch: Partial<Mark>) {
    commitNoteHistory();
    commit(
      marksRef.current.map((mark) => (mark.id === id ? { ...mark, ...patch } : mark)),
      true,
    );
  }

  function onNote(id: string, value: string) {
    if (!noteDirty.current) {
      noteDirty.current = true;
      noteSnapshot.current = marksRef.current;
    }
    commit(
      marksRef.current.map((mark) => (mark.id === id ? { ...mark, note: value } : mark)),
      false,
    );
  }

  function removeMark(id: string) {
    commitNoteHistory();
    commit(
      marksRef.current.filter((mark) => mark.id !== id),
      true,
    );
    setActiveId((current) => (current === id ? null : current));
  }

  function clearMarks() {
    commitNoteHistory();
    commit([], true);
    setActiveId(null);
  }

  function pickMark(id: string, scroll: boolean) {
    commitNoteHistory();
    setActiveId(id);
    setRailOpen(true);
    if (!scroll) return;
    const mark = marksRef.current.find((item) => item.id === id);
    if (mark) document.getElementById(`quire-page-a-${mark.page}`)?.scrollIntoView({ block: "center", inline: "nearest" });
  }

  function applyLiveSelection(kind: "highlight" | "underline" | "strikeout") {
    const draft = draftRef.current;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
    const node = selection.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const pageEl = element?.closest<HTMLElement>("[data-page]");
    if (!pageEl || pageEl.dataset.pane === "mate") return false;
    const pageNumber = Number(pageEl.dataset.page);
    const viewport = viewports.current.get(pageNumber);
    if (!viewport || !pdfRef.current) return false;
    const picked = selectionOnPage(pageEl, viewport);
    if (!picked) return false;
    if (!stayRef.current) selection.removeAllRanges();
    commitNoteHistory();
    const mark: Mark = {
      id: crypto.randomUUID(),
      page: pageNumber,
      kind,
      pass: 1,
      ink: draft.ink,
      label: draft.label,
      note: "",
      quote: picked.quote,
      quads: picked.quads,
      createdAt: Date.now(),
    };
    commit([...marksRef.current, mark], true);
    setActiveId(mark.id);
    setRailOpen(true);
    return true;
  }

  applyRef.current = applyLiveSelection;

  function chooseTool(next: Tool) {
    const previous = draftRef.current.tool;
    setTool(next);
    if (!stayRef.current) return;
    if (next !== "highlight" && next !== "underline" && next !== "strikeout") return;
    if (next === previous) return;
    applyLiveSelection(next);
  }

  function toggleJoin() {
    setJoinLines((value) => {
      const next = !value;
      joinRef.current = next;
      try {
        localStorage.setItem("quire-join-lines", next ? "1" : "0");
      } catch {
        /* private browsing */
      }
      return next;
    });
  }

  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      if (!joinRef.current) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const node = selection.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      if (!element?.closest(".quire-text")) return;
      const joined = joinCopiedLines(selection.toString());
      event.preventDefault();
      event.clipboardData?.setData("text/plain", joined);
    }
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, []);

  function toggleStay() {
    setStaySelection((value) => {
      const next = !value;
      stayRef.current = next;
      try {
        localStorage.setItem("quire-stay-selection", next ? "1" : "0");
      } catch {
        /* private browsing */
      }
      return next;
    });
  }

  useEffect(() => {
    let last = 0;
    function createFromSelection() {
      const draft = draftRef.current;
      if (draft.tool !== "highlight" && draft.tool !== "underline" && draft.tool !== "strikeout") return;
      applyRef.current(draft.tool);
    }
    function onPointerUp(event: Event) {
      const target = event.target;
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
      if (!element?.closest("[data-page]")) return;
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
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

  function gestureStart() {
    commitNoteHistory();
    gestureBase.current = marksRef.current;
  }

  function gestureMove(id: string, patch: Partial<Mark>) {
    const next = marksRef.current.map((mark) => (mark.id === id ? { ...mark, ...patch } : mark));
    marksRef.current = next;
    setMarks(next);
  }

  function gestureEnd(moved: boolean) {
    const base = gestureBase.current;
    gestureBase.current = null;
    if (!base || !moved) return;
    undoRef.current.push(base);
    if (undoRef.current.length > 60) undoRef.current.shift();
    redoRef.current = [];
    bumpHistory();
  }

  function placeShape(pageNumber: number, place: ShapePlace) {
    const draft = draftRef.current;
    commitNoteHistory();
    const mark: Mark = {
      id: crypto.randomUUID(),
      page: pageNumber,
      kind: place.kind,
      pass: 1,
      ink: draft.ink,
      label: draft.label,
      note: "",
      quote: "",
      quads: place.kind === "callout" ? [place.quad] : [],
      from: place.kind === "arrow" ? place.from : undefined,
      to: place.kind === "arrow" ? place.to : place.tip,
      createdAt: Date.now(),
    };
    commit([...marksRef.current, mark], true);
    setActiveId(mark.id);
    setRailOpen(true);
  }

  function nudgeZoom(direction: number) {
    setZoomMode("manual");
    const factor = direction > 0 ? 1.1 : 1 / 1.1;
    const clamp = (current: number) => Math.min(2.5, Math.max(0.5, Math.round(current * factor * 100) / 100));
    setScale((current) => clamp(current));
    setMateScale((current) => clamp(current));
  }

  function jumpTo(side: "a" | "b", raw: string) {
    const count = side === "a" ? numPages : (mate?.numPages ?? 0);
    const number = Number(raw);
    if (!Number.isFinite(number) || !count) return;
    const next = Math.min(count, Math.max(1, Math.round(number)));
    if (side === "a") setPage(next);
    else setMatePage(next);
    document.getElementById(`quire-page-${side}-${next}`)?.scrollIntoView({ block: "start", inline: "nearest" });
  }

  function stepHit(direction: number) {
    if (!hits.length) return;
    setHitIndex((current) => (current + direction + hits.length) % hits.length);
  }

  async function loadBytes(name: string, bytes: Uint8Array, source: "file" | "chrome" = "file") {
    const ticket = ++openTicket.current;
    setBusy(true);
    setError("");
    setStatus("Opening…");
    setPending(null);
    try {
      const [nextPdf, key] = await Promise.all([openPdf(bytes), fingerprint(bytes)]);
      if (ticket !== openTicket.current) {
        void nextPdf.cleanup();
        return;
      }
      const [first, session] = await Promise.all([nextPdf.getPage(1), loadSession(key)]);
      if (ticket !== openTicket.current) {
        void nextPdf.cleanup();
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
      if (previous && previous !== nextPdf) void previous.cleanup();
      if (session) {
        marksRef.current = session.marks;
        setMarks(session.marks);
        setImported(session.importedSourceIds);
        setStatus(
          session.marks.length
            ? `Restored ${session.marks.length} mark${session.marks.length === 1 ? "" : "s"} kept on this machine.`
            : "Opened. Select text to mark it.",
        );
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
      setStatus(
        parsed.marks.length
          ? `Opened with ${parsed.marks.length} mark${parsed.marks.length === 1 ? "" : "s"} already in the file.`
          : "Opened. Select text to mark it.",
      );
      bumpHistory();
    } catch (err) {
      if (ticket !== openTicket.current) return;
      if (source === "chrome" && error && typeof error === "object" && "name" in error && (error as { name: string }).name === "PasswordException") {
        const { fallbackToChromeViewer } = await import("@/lib/chrome-pdf");
        fallbackToChromeViewer();
      }
      setError(messageFrom(err));
      setStatus("");
    } finally {
      if (ticket === openTicket.current) setBusy(false);
    }
  }

  function requestOpen(next: File | "sample") {
    pendingMate.current = null;
    if (next !== "sample" && !isPdf(next)) {
      setError("Choose a PDF.");
      return;
    }
    if (next !== "sample" && !paidRef.current) {
      setPassError("");
      setStatus("Enter the passcode before opening a PDF.");
      if (pdfRef.current) setGate("open");
      return;
    }
    if (marksRef.current.length > 0) {
      setPending(next);
      return;
    }
    void beginOpen(next);
  }

  async function beginOpen(next: File | "sample") {
    if (next === "sample") {
      setStatus("Preparing the sample…");
      const bytes = await buildSamplePdf();
      await loadBytes("Quorum interim results.pdf", bytes);
      return;
    }
    const bytes = new Uint8Array(await next.arrayBuffer());
    await loadBytes(next.name, bytes);
  }

  function receiveFiles(list: FileList | File[]) {
    const pdfs = [...list].filter(isPdf);
    if (!pdfs.length) {
      setError("Choose a PDF.");
      return;
    }
    if (!paidRef.current) {
      setPassError("");
      setStatus("Enter the passcode before opening a PDF.");
      if (pdfRef.current) setGate("open");
      else document.getElementById("quire-passcode")?.focus();
      return;
    }
    if (pdfs.length >= 2) {
      if (marksRef.current.length > 0) {
        pendingMate.current = pdfs[1];
        setPending(pdfs[0]);
        return;
      }
      void openBilingual(pdfs[0], pdfs[1]);
      return;
    }
    requestOpen(pdfs[0]);
  }

  async function openBilingual(source: File, target: File) {
    mateIntent.current = "bilingual";
    const previous = pdfRef.current;
    await beginOpen(source);
    if (!pdfRef.current || pdfRef.current === previous) return;
    await loadMate(target);
  }

  async function exportPdf() {
    if (!paidRef.current) {
      setPassError("");
      setGate("pdf");
      return;
    }
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
      setStatus(
        pages === 1
          ? "Downloaded 1 marked page. Open it in Acrobat, Preview, or back here."
          : `Downloaded ${pages} marked pages. Open them in Acrobat, Preview, or back here.`,
      );
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
    setPairKind(null);
    setFigureReport(null);
    targetMarksRef.current = [];
    setTargetMarks([]);
    void current.pdf.cleanup();
  }

  function closeMate() {
    const bilingual = pairKind === "bilingual";
    dropMate();
    setStatus(bilingual ? "Bilingual closed. Marks are still on this file." : "Compare closed. Marks are still on this file.");
  }

  async function swapPdfs() {
    const left = pdfRef.current;
    const right = mateDocRef.current;
    const leftBytes = bytesRef.current;
    if (!left || !right || !leftBytes || !fileName || mateBusy) return;
    setMateBusy(true);
    setError("");
    try {
      const leftKey = sessionKey ?? (await fingerprint(leftBytes));
      await saveSession(leftKey, {
        name: fileName,
        marks: marksRef.current,
        importedSourceIds: importedRef.current,
        savedAt: Date.now(),
      });
      const rightKey = await fingerprint(right.bytes);
      const session = await loadSession(rightKey);
      let nextMarks = session?.marks ?? [];
      let nextImported = session?.importedSourceIds ?? [];
      if (!session) {
        const parsed = await readExisting(right.pdf);
        nextMarks = parsed.marks;
        nextImported = parsed.ids;
      }
      const moved: MateDoc = {
        pdf: left,
        name: fileName,
        numPages,
        baseWidth,
        bytes: leftBytes,
      };
      bytesRef.current = right.bytes;
      pdfRef.current = right.pdf;
      mateDocRef.current = moved;
      marksRef.current = nextMarks;
      importedRef.current = nextImported;
      setPdf(right.pdf);
      setFileName(right.name);
      setNumPages(right.numPages);
      setBaseWidth(right.baseWidth);
      setMate(moved);
      setPage(matePage);
      setMatePage(page);
      setScale(mateScale);
      setMateScale(scale);
      setMarks(nextMarks);
      setImported(nextImported);
      setSessionKey(rightKey);
      undoRef.current = [];
      redoRef.current = [];
      noteDirty.current = false;
      noteSnapshot.current = null;
      viewports.current.clear();
      setActiveId(null);
      setHits([]);
      setFigureReport(null);
      targetMarksRef.current = [];
      setTargetMarks([]);
      setStatus(
        pairKind === "bilingual"
          ? "Swapped. This file is now the source."
          : "Swapped. Marks stay on this file.",
      );
    } catch {
      setError("The two PDFs could not be swapped.");
    } finally {
      setMateBusy(false);
    }
  }

  function askSecond(kind: "compare" | "bilingual") {
    mateIntent.current = kind;
    if (!paidRef.current) {
      setPassError("");
      setGate(kind);
      return;
    }
    mateFileRef.current?.click();
  }

  async function loadMate(file: File) {
    if (!isPdf(file)) {
      setError("Choose a PDF.");
      return;
    }
    const ticket = ++mateTicket.current;
    setMateBusy(true);
    setError("");
    setStatus("Opening the second PDF…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const next = await openPdf(bytes);
      if (ticket !== mateTicket.current || !pdfRef.current) {
        void next.cleanup();
        return;
      }
      const first = await next.getPage(1);
      const width = first.getViewport({ scale: 1 }).width;
      const kind = mateIntent.current;
      const previous = mateDocRef.current;
      const opened: MateDoc = { pdf: next, name: file.name, numPages: next.numPages, baseWidth: width, bytes };
      mateDocRef.current = opened;
      setMate(opened);
      setPairKind(kind);
      setFigureReport(null);
      targetMarksRef.current = [];
      setTargetMarks([]);
      setMateScale(scaleRef.current);
      setLinked(true);
      setMatePage(1);
      if (previous) void previous.pdf.cleanup();
      setStatus(
        kind === "bilingual"
          ? "Bilingual is open. This file is the source. The other file is the target."
          : "Compare is open. Scrolling one side moves the other. Marks stay on this file.",
      );
    } catch (err) {
      if (ticket === mateTicket.current) setError(messageFrom(err));
    } finally {
      if (ticket === mateTicket.current) setMateBusy(false);
    }
  }

  async function findChanges() {
    if (!paidRef.current) {
      setPassError("");
      setGate("changes");
      return;
    }
    const later = pdfRef.current;
    const earlier = mateDocRef.current?.pdf;
    if (!later || !earlier || comparing) return;
    setComparing(true);
    setError("");
    setStatus("Comparing. This file is the later copy.");
    try {
      const found = await compareDocuments(earlier, later);
      earlierNameRef.current = mateDocRef.current?.name ?? earlierNameRef.current;
      const kept = marksRef.current.filter((mark) => !mark.id.startsWith("change-"));
      commitNoteHistory();
      commit([...kept, ...found.marks], true);
      if (found.marks[0]) {
        setActiveId(found.marks[0].id);
        setRailOpen(true);
      }
      if (!found.marks.length) setStatus("No text changes.");
      else if (found.capped) {
        setStatus("Marked 400 changes, then stopped. Undo if these are not two versions of one text.");
      } else {
        const count = found.marks.length;
        setStatus(
          count === 1
            ? "Marked 1 change. Changes PDF downloads the list and the changed page."
            : `Marked ${count} changes. Changes PDF downloads the list and the changed pages.`,
        );
      }
    } catch {
      setError("The two files could not be compared.");
    } finally {
      setComparing(false);
    }
  }

  async function checkGrammar() {
    const current = pdfRef.current;
    if (!current || grammarBusy || !paidRef.current) return;
    setGrammarBusy(true);
    setError("");
    setStatus("Checking English grammar…");
    try {
      const found = await grammarMarks(current);
      const kept = marksRef.current.filter((mark) => !mark.id.startsWith("grammar-"));
      commitNoteHistory();
      commit([...kept, ...found], true);
      const count = found.filter((mark) => mark.kind === "callout").length;
      if (found[0]) {
        setActiveId(found[0].id);
        setRailOpen(true);
      }
      setStatus(count ? `Marked ${count} English grammar ${count === 1 ? "point" : "points"}.` : "No English grammar points.");
    } catch {
      setError("English grammar could not be checked.");
    } finally {
      setGrammarBusy(false);
    }
  }

  async function exportChanges() {
    if (!paidRef.current) {
      setPassError("");
      setGate("changes-pdf");
      return;
    }
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
      setStatus(
        pages === 1
          ? "Downloaded the comparison: a list, then 1 changed page."
          : `Downloaded the comparison: a list, then ${pages} changed pages.`,
      );
    } catch {
      setError("The comparison PDF could not be written.");
    } finally {
      setExporting(null);
    }
  }

  function exportSheet() {
    if (!paidRef.current) {
      setPassError("");
      setGate("sheet");
      return;
    }
    if (!fileName) return;
    commitNoteHistory();
    const markdown = marksToMarkdown(fileName, marksRef.current);
    downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), `${safeStem(fileName)}-notes.md`);
    setStatus("Comment sheet downloaded.");
  }

  function closeGate() {
    setGate(null);
    setPassInput("");
    setPassError("");
  }

  function submitPasscode(openFile = false) {
    void acceptPasscode(openFile);
  }

  async function acceptPasscode(openFile: boolean) {
    const ok = await tryPasscode(passInput);
    if (!ok) {
      setPassError("That passcode is not recognised.");
      return;
    }
    paidRef.current = true;
    setPaid(true);
    if (!portable) notePasscode(passInput);
    const next = gate;
    setGate(null);
    setPassInput("");
    setPassError("");
    const held = heldLaunch.current;
    heldLaunch.current = null;
    if (held) {
      setHeldName("");
      setGate(null);
      void loadBytes(held.name, held.bytes, held.source ?? "file");
      return;
    }
    setStatus("Passcode accepted. Choose the PDF.");
    if (openFile || next === "open") fileRef.current?.click();
    else if (next === "compare" || next === "bilingual") {
      mateIntent.current = next;
      mateFileRef.current?.click();
    }
    else if (next === "changes") void findChanges();
    else if (next === "pdf") void exportPdf();
    else if (next === "sheet") exportSheet();
    else if (next === "changes-pdf") void exportChanges();
  }

  async function checkFigures() {
    const source = pdfRef.current;
    const target = mateDocRef.current?.pdf;
    if (!source || !target || pairKind !== "bilingual" || figureBusy) return;
    setFigureBusy(true);
    setError("");
    try {
      const report = await checkBilingual(source, target);
      const marked = await marksOnTarget(target, report);
      setFigureReport(report);
      targetMarksRef.current = marked;
      setTargetMarks(marked);
      const missed = report.filter(
        (pair) =>
          pair.sourcePage === null ||
          pair.targetPage === null ||
          pair.datesSource.length ||
          pair.datesTarget.length ||
          pair.figuresSource.length ||
          pair.figuresTarget.length ||
          pair.formats.length,
      ).length;
      const notes = marked.filter((mark) => mark.kind === "callout").length;
      setStatus(
        notes
          ? `Marked ${notes} on the target.`
          : missed
            ? `${missed} source and target ${missed === 1 ? "page differs" : "pages differ"}.`
            : "Source and target match.",
      );
    } catch {
      setError("Figures and dates could not be checked.");
    } finally {
      setFigureBusy(false);
    }
  }

  async function downloadTarget() {
    const current = mateDocRef.current;
    const marked = targetMarksRef.current;
    if (!current || !marked.length || exporting !== null) return;
    setExporting("target");
    setError("");
    try {
      const output = await embedMarks(current.bytes, marked, []);
      downloadBlob(new Blob([output.slice(0)], { type: "application/pdf" }), `${safeStem(current.name)}-figures.pdf`);
      setStatus("Downloaded the target PDF with the figure and date marks.");
    } catch {
      setError("The target PDF could not be written.");
    } finally {
      setExporting(null);
    }
  }

  const canUndo = undoRef.current.length > 0 || noteDirty.current;
  const canRedo = redoRef.current.length > 0;
  void historyTick;
  const pair = !!pdf && !!mate;

  function renderPages(doc: PdfDoc, numbers: number[], side: "work" | "mate", pageScale: number) {
    const prefix = side === "work" ? "a" : "b";
    return numbers.map((pageNumber, index) => (
      <PdfPage
        key={`${docKey(doc)}-${pageNumber}`}
        pdf={doc}
        pageNumber={pageNumber}
        scale={pageScale}
        marks={side === "work" ? marks : targetMarks}
        hits={side === "work" ? hits : []}
        activeHit={side === "work" ? hitIndex : -1}
        activeId={side === "work" ? activeId : null}
        tool={side === "work" ? tool : "highlight"}
        eager={index === 0}
        pane={side}
        domId={`quire-page-${prefix}-${pageNumber}`}
        onPick={side === "work" ? (id) => pickMark(id, false) : () => {}}
        onPlace={side === "work" ? placeShape : undefined}
        onGestureStart={side === "work" ? gestureStart : undefined}
        onGestureMove={side === "work" ? gestureMove : undefined}
        onGestureEnd={side === "work" ? gestureEnd : undefined}
        onViewport={
          side === "work"
            ? (number, viewport) => {
                viewports.current.set(number, viewport);
              }
            : () => {}
        }
      />
    ));
  }

  const workNumbers = Array.from({ length: numPages }, (_, index) => index + 1);

  return (
    <div
      className="quire-app flex h-dvh flex-col overflow-hidden bg-desk text-paper"
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const files = event.dataTransfer.files;
        if (!files?.length) return;
        receiveFiles(files);
      }}
    >
      <header className="shrink-0 border-b border-line-dark">
        <div className="flex h-14 items-center gap-2 overflow-x-auto px-3">
          <p className="quire-word font-display text-2xl leading-none tracking-tight">Quire</p>
          {fileName && (
            <p className="hidden min-w-0 flex-1 truncate text-sm text-muted sm:block">{fileName}</p>
          )}
          {!fileName && <span className="min-w-0 flex-1" />}
          <button
            type="button"
            onClick={() => {
              if (paidRef.current) {
                fileRef.current?.click();
                return;
              }
              setPassError("");
              setStatus("Enter the passcode before opening a PDF.");
              if (pdfRef.current) setGate("open");
              else document.getElementById("quire-passcode")?.focus();
            }}
            title="Open one PDF, or two. Two files open in bilingual mode. The first is the source."
            className="quire-file inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-brass px-3 text-sm text-paper"
          >
            <Upload size={16} strokeWidth={1.75} />
            Open PDF
          </button>
          {pdf && (
            <>
              <button
                type="button"
                onClick={() => void exportPdf()}
                disabled={!marks.length || exporting !== null}
                aria-label="Download marked PDF"
                title="Download the pages that have marks"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40"
              >
                <FileDown size={16} strokeWidth={1.75} />
                {exporting === "pdf" ? "Saving…" : "Marked PDF"}
              </button>
              <button
                type="button"
                onClick={() => void exportChanges()}
                disabled={!marks.some((mark) => mark.id.startsWith("change-")) || exporting !== null}
                aria-label="Download comparison PDF"
                title="Download the comparison list, then the changed pages"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40"
              >
                <GitCompare size={16} strokeWidth={1.75} />
                {exporting === "changes" ? "Saving…" : "Changes PDF"}
              </button>
              <button
                type="button"
                onClick={exportSheet}
                disabled={!marks.length || exporting !== null}
                aria-label="Download comment sheet"
                title="Download comment sheet"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40"
              >
                <FileText size={16} strokeWidth={1.75} />
                Sheet
              </button>
              <button
                type="button"
                onClick={() => void checkGrammar()}
                disabled={grammarBusy}
                aria-label="English grammar"
                title="English grammar and spelling on this file. British English. Chinese is left alone. The check stays on this computer."
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40"
              >
                <SpellCheck size={16} strokeWidth={1.75} />
                {grammarBusy ? "Checking…" : "Grammar"}
              </button>
              <button
                type="button"
                onClick={() => setRailOpen((open) => !open)}
                aria-pressed={railOpen}
                aria-label="Marks"
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${railOpen ? "bg-brass text-paper" : "bg-raised text-paper"}`}
              >
                <PanelRight size={16} strokeWidth={1.75} />
                Marks
                <span className="tabular-nums">{marks.length}</span>
              </button>
            </>
          )}
        </div>
        {pdf && (
          <div
            className="flex items-center gap-2 overflow-x-auto border-t border-line-dark px-3 py-2 md:flex-wrap md:overflow-visible"
            onMouseDown={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("input, textarea, select, option")) return;
              if (!stayRef.current && !target.closest("[data-stay]")) return;
              event.preventDefault();
            }}
          >
            {TOOLS.map((item) => {
              const Icon = item.icon;
              const pressed = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  aria-label={item.hint}
                  aria-pressed={pressed}
                  onClick={() => chooseTool(item.id)}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${pressed ? "bg-brass text-paper" : "bg-raised text-paper"}`}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {item.name}
                </button>
              );
            })}
            <span className="mx-1 h-6 w-px shrink-0 bg-line-dark" />
            <button
              type="button"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40"
            >
              <Undo2 size={16} strokeWidth={1.75} />
              Undo
            </button>
            <button
              type="button"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40"
            >
              <Redo2 size={16} strokeWidth={1.75} />
              Redo
            </button>
            <span className="mx-1 h-6 w-px shrink-0 bg-line-dark" />
            {INKS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.name}
                aria-label={item.name}
                aria-pressed={ink === item.id}
                onClick={() => setInk(item.id)}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${ink === item.id ? "bg-stamp" : "bg-paper"}`}
              >
                <span className="block h-4 w-4 rounded-full" style={{ background: `var(--color-${item.id})` }} />
                {item.name}
              </button>
            ))}
            <label className="sr-only" htmlFor="quire-new-label">
              Label for new marks
            </label>
            <select
              id="quire-new-label"
              value={label}
              aria-label="Label for new marks"
              onChange={(event) => setLabel(event.target.value as LabelId)}
              className="h-11 shrink-0 rounded-md border border-line-dark bg-raised px-2 text-sm text-paper"
            >
              {LABELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              role="switch"
              data-stay=""
              aria-checked={staySelection}
              title="Stay selection. The passage stays selected, so the next highlight, underline, or strike uses it too."
              onClick={toggleStay}
              className={`h-11 shrink-0 rounded-md px-3 text-sm ${staySelection ? "bg-brass text-paper" : "bg-raised text-paper"}`}
            >
              Stay selection
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={joinLines}
              title="Join lines. Copying the selected text removes the line breaks. A blank line stays. Chinese joins without a space."
              onClick={toggleJoin}
              className={`h-11 shrink-0 rounded-md px-3 text-sm ${joinLines ? "bg-brass text-paper" : "bg-raised text-paper"}`}
            >
              Join lines
            </button>
            <span className="mx-1 h-6 w-px shrink-0 bg-line-dark" />
            <label className="relative shrink-0">
              <span className="sr-only">Find in the PDF</span>
              <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input
                ref={findRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    stepHit(event.shiftKey ? -1 : 1);
                  }
                }}
                placeholder="Find"
                className="h-11 w-36 rounded-md border border-line-dark bg-raised pr-3 pl-9 text-sm text-paper outline-none focus:border-brass sm:w-48"
              />
            </label>
            {query.trim().length >= 2 && (
              <span className="shrink-0 text-sm text-muted tabular-nums">
                {searching ? "Searching…" : hits.length ? `${hitIndex + 1} / ${hits.length}` : "No matches"}
              </span>
            )}
            <span className="mx-1 h-6 w-px shrink-0 bg-line-dark" />
            <button
              type="button"
              title="Compare. Open a second PDF beside this one. Scrolling stays linked. Marks stay on this file."
              aria-label="Compare"
              aria-pressed={pairKind === "compare"}
              disabled={mateBusy}
              onClick={() => askSecond("compare")}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm disabled:opacity-40 ${pairKind === "compare" ? "bg-brass text-paper" : "bg-raised text-paper"}`}
            >
              <Files size={16} strokeWidth={1.75} />
              <span>{mateBusy && mateIntent.current === "compare" ? "Opening…" : "Compare"}</span>
            </button>
            <button
              type="button"
              title="Bilingual. Open the other language beside this file. This file is the source."
              aria-label="Bilingual"
              aria-pressed={pairKind === "bilingual"}
              disabled={mateBusy}
              onClick={() => askSecond("bilingual")}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm disabled:opacity-40 ${pairKind === "bilingual" ? "bg-brass text-paper" : "bg-raised text-paper"}`}
            >
              <Languages size={16} strokeWidth={1.75} />
              <span>{mateBusy && mateIntent.current === "bilingual" ? "Opening…" : "Bilingual"}</span>
            </button>
          </div>
        )}
      </header>

      <div className={`flex min-h-0 flex-1 ${dragOver ? "quire-dropping" : ""}`}>
        {!pdf && (
          <div className="min-w-0 flex-1 overflow-auto">
            {busy ? (
              <div className="flex min-h-full items-center justify-center px-6">
                <p className="text-sm text-muted">{status || "Opening…"}</p>
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center px-4 py-10">
                <div className="quire-card w-full max-w-xl">
                  <p className="quire-kicker">{studio ? "Studio copy" : "Portable proof desk"}</p>
                  <h1 className="mt-4 text-4xl text-balance text-paper sm:text-5xl">
                    Mark the text. Keep the file.
                  </h1>
                  <p className="mt-4 max-w-lg text-base text-pretty text-muted">
                    Highlight, underline, or strike a passage, or drag a callout or an arrow. Each mark takes a note and a colour.
                    Nothing is uploaded. Marked PDF downloads only the pages you marked, for Acrobat or Preview. Or take a comment sheet.
                  </p>
                  <div className="mt-6">
                    {import.meta.env.VITE_STUDIO
                      ? null
                      : !studio &&
                        !paid && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitPasscode(true);
                        }}
                      >
                        <label className="text-sm text-paper" htmlFor="quire-passcode">
                          Passcode
                        </label>
                        <p className="mt-1 text-sm text-muted">Enter this before opening your PDF. It stays on this computer.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            id="quire-passcode"
                            value={passInput}
                            onChange={(event) => {
                              setPassInput(event.target.value);
                              setPassError("");
                            }}
                            autoComplete="off"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            className="h-11 min-w-0 flex-1 rounded-md bg-white px-3 text-sm text-ink outline-none"
                          />
                          <button type="submit" className="h-11 rounded-md bg-brass px-4 text-sm text-paper">
                            Unlock
                          </button>
                        </div>
                        {passError && (
                          <p className="mt-3 text-sm" role="alert">
                            {passError}
                          </p>
                        )}
                      </form>
                    )}
                    <div className={`flex flex-wrap gap-2 ${paid ? "" : "mt-4"}`}>
                      <button
                        type="button"
                        disabled={!paid}
                        onClick={() => fileRef.current?.click()}
                        className="quire-file inline-flex h-11 items-center gap-2 rounded-md bg-brass px-4 text-sm text-paper disabled:opacity-40"
                      >
                        <Upload size={16} strokeWidth={1.75} />
                        Open a PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => requestOpen("sample")}
                        className="inline-flex h-11 items-center gap-2 rounded-md bg-raised px-4 text-sm text-paper"
                      >
                        <BookOpen size={16} strokeWidth={1.75} />
                        Try the sample
                      </button>
                      {portable ? null : studio ? (
                        <Link
                          to="/"
                          className="quire-file inline-flex h-11 items-center rounded-md bg-raised px-4 text-sm text-paper"
                        >
                          Customer version
                        </Link>
                      ) : (
                        <Link
                          to="/studio"
                          className="quire-file inline-flex h-11 items-center rounded-md bg-raised px-4 text-sm text-paper"
                        >
                          Studio copy
                        </Link>
                      )}
                    </div>
                  </div>
                  <p className="mt-6 max-w-lg text-sm text-pretty text-muted">
                    {studio
                      ? portable
                        ? "Studio copy. No passcode. Mark the source beside the target. The file stays on this computer."
                        : "Studio copy. No passcode while the desk is being changed. The customer version still asks for one."
                      : heldName
                        ? `${heldName} is waiting. Enter the passcode to open it.`
                        : `The sample needs no passcode. ${paid ? "Passcode accepted. Choose the PDF." : "Enter the passcode, then the file chooser opens."} Compare opens a second PDF beside this one. Changes marks what this later copy added or deleted. Bilingual opens the other language, then figures and dates can be checked. Grammar checks British English, including spelling.`}
                  </p>
                  {error && (
                    <p className="mt-4 text-sm text-paper" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {pdf && !pair && (
          <div ref={singleScrollRef} className="min-w-0 flex-1 overflow-auto">
            <div className="px-3 py-6 sm:px-8">
              {marks.length === 0 && (
                <p className="mb-4 text-center text-sm text-muted">
                  {tool === "callout"
                    ? "Press where it should point, then drag the box into place. Select it and drag the bar to move the box and the point together. Drag an edge or a corner to resize. The dot moves only the point."
                    : tool === "arrow"
                      ? "Drag the arrow. Select it, then drag the line or either end."
                      : tool === "select"
                        ? "Select is on. Click a mark to move it, or choose Highlight, Underline, or Strike."
                        : `Select a line, in the colour chosen above.${staySelection ? " Stay selection keeps that line selected." : ""}${joinLines ? " Join lines removes the breaks when you copy." : ""}`}
                </p>
              )}
              {renderPages(pdf, workNumbers, "work", scale)}
            </div>
          </div>
        )}
        {pdf && mate && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {pairKind === "bilingual" && (
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-dark px-3 py-2">
                <p className="min-w-0 flex-1 text-sm text-pretty text-muted">
                  Source, then target. Figures, dates, bold, and italic are marked on the target.
                </p>
                <button
                  type="button"
                  title="Check figures, dates, bold, and italic. A date matches by the day. An amount matches without the currency sign."
                  disabled={figureBusy}
                  onClick={() => void checkFigures()}
                  className="h-11 shrink-0 rounded-md bg-brass px-4 text-sm text-paper disabled:opacity-40"
                >
                  {figureBusy ? "Checking…" : "Figures and dates"}
                </button>
                <button
                  type="button"
                  title="Download the target PDF with the figure and date marks."
                  disabled={!targetMarks.length || exporting !== null}
                  onClick={() => void downloadTarget()}
                  className="h-11 shrink-0 rounded-md bg-raised px-4 text-sm text-paper disabled:opacity-40"
                >
                  {exporting === "target" ? "Saving…" : "Target PDF"}
                </button>
              </div>
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
              <Pane title={pairKind === "bilingual" ? `Source · ${fileName ?? "This file"}` : (fileName ?? "This file")} scrollerRef={leftScrollRef}>
                {marks.length === 0 && (
                  <p className="mb-4 text-center text-sm text-muted">
                    Select a line on this file, in the colour chosen above.
                  </p>
                )}
                {renderPages(pdf, workNumbers, "work", scale)}
              </Pane>
              <Pane
                title={pairKind === "bilingual" ? `Target · ${mate.name}` : mate.name}
                scrollerRef={rightScrollRef}
                extra={
                  <>
                    <button
                      type="button"
                      title="Swap the two PDFs. The file on the right becomes the source."
                      disabled={mateBusy}
                      onClick={() => void swapPdfs()}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-raised px-3 text-sm text-paper disabled:opacity-40"
                    >
                      <ArrowLeftRight size={16} strokeWidth={1.75} />
                      Swap
                    </button>
                    {pairKind !== "bilingual" && (
                      <button
                        type="button"
                        disabled={comparing}
                        title="Mark how this file differs from Compare. This file is the later copy. Added text is highlighted. Deleted text becomes a callout."
                        onClick={() => void findChanges()}
                        className="h-11 shrink-0 rounded-md bg-brass px-3 text-sm text-paper disabled:opacity-40"
                      >
                        {comparing ? "Comparing…" : "Changes"}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-pressed={linked}
                      title={linked ? "Scrolling is linked. Click to move each file on its own." : "Scrolling is independent. Click to link the two files again."}
                      onClick={() => setLinked((value) => !value)}
                      className={`h-11 shrink-0 rounded-md px-3 text-sm ${linked ? "bg-brass text-paper" : "bg-raised text-paper"}`}
                    >
                      {linked ? "Linked" : "Free"}
                    </button>
                    <button
                      type="button"
                      onClick={closeMate}
                      className="h-11 shrink-0 rounded-md bg-raised px-3 text-sm text-paper"
                    >
                      Close
                    </button>
                  </>
                }
              >
                <p className="mb-4 text-center text-sm text-muted">
                  {pairKind === "bilingual"
                    ? "Bilingual. Figure and date differences are marked on this file."
                    : "Compare. Marks stay on the other file. Changes treats this file as the later copy."}
                </p>
                {renderPages(mate.pdf, Array.from({ length: mate.numPages }, (_, index) => index + 1), "mate", mateScale)}
              </Pane>
            </div>
          </div>
        )}
        {pdf && railOpen && (
          <Rail
            marks={marks}
            activeId={activeId}
            noteRef={noteRef}
            onClose={() => setRailOpen(false)}
            onPick={(id) => pickMark(id, true)}
            onPatch={patchMark}
            onNote={onNote}
            onNoteBlur={commitNoteHistory}
            onDelete={removeMark}
            onClear={clearMarks}
          />
        )}
      </div>

      <footer className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-t border-line-dark px-3 text-sm text-muted">
        {portable ? (
          <span
            className="shrink-0 text-paper"
            title={studio ? "Studio copy. No passcode." : "Licensed copy. Do not copy or republish this extension."}
          >
            © Quire
          </span>
        ) : (
          <button type="button" onClick={() => setUsageOpen(true)} className="h-11 shrink-0 rounded-md px-2 text-paper">
            Usage
          </button>
        )}
        {studio && <span className="shrink-0 text-paper">Studio</span>}
        {pdf && (
          <>
            <label className="inline-flex items-center gap-2 tabular-nums">
              {pair ? (pairKind === "bilingual" ? "Source" : "Left") : "Page"}
              <input
                key={`${pairKind ?? "one"}-${page}`}
                defaultValue={page}
                inputMode="numeric"
                aria-label={pair ? (pairKind === "bilingual" ? "Source page" : "Left page") : "Page number"}
                onBlur={(event) => jumpTo("a", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    jumpTo("a", (event.target as HTMLInputElement).value);
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                className="h-11 w-14 rounded-md bg-raised text-center text-paper"
              />
              {pair ? null : `/ ${numPages}`}
            </label>
            {pair && (
              <label className="inline-flex items-center gap-2 tabular-nums">
                {pairKind === "bilingual" ? "Target" : "Right"}
                <input
                  key={`${pairKind}-mate-${matePage}`}
                  defaultValue={matePage || ""}
                  inputMode="numeric"
                  aria-label={pairKind === "bilingual" ? "Target page" : "Right page"}
                  onBlur={(event) => jumpTo("b", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      jumpTo("b", (event.target as HTMLInputElement).value);
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-11 w-14 rounded-md bg-raised text-center text-paper"
                />
              </label>
            )}
            <span className="inline-flex items-center">
              <button type="button" aria-label="Zoom out" onClick={() => nudgeZoom(-1)} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-2 text-paper hover:bg-raised">
                <Minus size={14} />
                Zoom out
              </button>
              <button
                type="button"
                onClick={() => setZoomMode("fit")}
                className="h-11 px-2 tabular-nums text-paper"
                title="Fit width"
              >
                {zoomMode === "fit" ? "Fit" : `${Math.round(scale * 100)}%`}
              </button>
              <button type="button" aria-label="Zoom in" onClick={() => nudgeZoom(1)} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-2 text-paper hover:bg-raised">
                <Plus size={14} />
                Zoom in
              </button>
            </span>
          </>
        )}
        <span className="min-w-0 flex-1 truncate text-paper" aria-live="polite">
          {error || status}
        </span>
      </footer>

      <input
        ref={fileRef}
        id="quire-open"
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (!files.length) return;
          receiveFiles(files);
        }}
      />
      <input
        ref={mateFileRef}
        id="quire-compare"
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void loadMate(file);
        }}
      />

      {!portable && usageOpen && <Usage onClose={() => setUsageOpen(false)} />}

      {import.meta.env.VITE_STUDIO
        ? null
        : gate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <form
            className="w-full max-w-sm rounded-md bg-paper p-5 text-ink"
            onSubmit={(event) => {
              event.preventDefault();
              submitPasscode();
            }}
          >
            <h2 className="text-2xl text-balance">Passcode</h2>
            <p className="mt-2 text-sm text-pretty text-ink-soft">
              Enter it before choosing a PDF. Once it is accepted, it stays on this computer.
            </p>
            <label className="mt-4 block text-sm" htmlFor="quire-passcode">
              Passcode
            </label>
            <input
              id="quire-passcode"
              value={passInput}
              onChange={(event) => {
                setPassInput(event.target.value);
                setPassError("");
              }}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="mt-1 h-11 w-full rounded-md bg-white px-3 text-sm text-ink outline-none"
            />
            {passError && (
              <p className="mt-3 text-sm" role="alert">
                {passError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeGate} className="h-11 rounded-md px-4 text-sm text-ink">
                Not now
              </button>
              <button type="submit" className="h-11 rounded-md bg-brass px-4 text-sm text-paper">
                Unlock
              </button>
            </div>
          </form>
        </div>
      )}

      {figureReport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-md bg-paper p-5 text-ink">
            <h2 className="text-2xl text-balance">Figures and dates</h2>
            <p className="mt-2 text-sm text-pretty text-ink-soft">
              The source page is checked against the target page with the same number. A date matches by the day. An amount matches without the currency sign or the thousands separators. Bold and italic are checked on a matching figure or date, and on other wording that is the same on both pages.
            </p>
            <div className="mt-4 min-h-0 flex-1 overflow-auto">
              {figureReport.every((pair) => !pairDiffers(pair)) ? (
                <p className="text-sm text-ink-soft">Figures, dates, and format match.</p>
              ) : (
                figureReport.filter(pairDiffers).map((pair) => (
                  <section key={pair.page} className="mt-4 border-t border-line pt-3 first:mt-0 first:border-t-0 first:pt-0">
                    <h3 className="text-base">
                      {pair.sourcePage && pair.targetPage
                        ? `Source page ${pair.sourcePage} and target page ${pair.targetPage}`
                        : pair.sourcePage
                          ? `Source page ${pair.sourcePage}`
                          : `Target page ${pair.targetPage}`}
                    </h3>
                    {pair.sourcePage === null && <p className="mt-1 text-sm text-ink-soft">No source page for this number.</p>}
                    {pair.targetPage === null && <p className="mt-1 text-sm text-ink-soft">No target page for this number.</p>}
                    <GapList title="Only on the source" dates={pair.datesSource} figures={pair.figuresSource} />
                    <GapList title="Only on the target" dates={pair.datesTarget} figures={pair.figuresTarget} />
                    {pair.formats.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm">Format</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
                          {pair.formats.map((item, index) => (
                            <li key={`s-${index}`}>{`${item.raw}. ${item.note}`}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                ))
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setFigureReport(null)} className="h-11 rounded-md bg-brass px-4 text-sm text-paper">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-sm rounded-md bg-paper p-5 text-ink">
            <h2 className="text-2xl text-balance">Open another file?</h2>
            <p className="mt-2 text-sm text-pretty text-ink-soft">
              Marks on this file stay in this browser. They are not uploaded.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { pendingMate.current = null; setPending(null); }} className="h-11 rounded-md px-4 text-sm text-ink">
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  const file = pending;
                  const mate = pendingMate.current;
                  pendingMate.current = null;
                  setPending(null);
                  if (file && file !== "sample" && mate) void openBilingual(file, mate);
                  else if (file) void beginOpen(file);
                }}
                className="h-11 rounded-md bg-brass px-4 text-sm text-paper"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function pairDiffers(pair: PairCheck) {
  return (
    pair.sourcePage === null ||
    pair.targetPage === null ||
    pair.datesSource.length > 0 ||
    pair.datesTarget.length > 0 ||
    pair.figuresSource.length > 0 ||
    pair.figuresTarget.length > 0 ||
    pair.formats.length > 0
  );
}

function GapList({
  title,
  dates,
  figures,
}: {
  title: string;
  dates: PairCheck["datesSource"];
  figures: PairCheck["figuresSource"];
}) {
  if (!dates.length && !figures.length) return null;
  return (
    <div className="mt-2">
      <p className="text-sm">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
        {dates.map((item, index) => (
          <li key={`d-${index}`}>{item.extra > 1 ? `Date: ${item.raw} ×${item.extra}` : `Date: ${item.raw}`}</li>
        ))}
        {figures.map((item, index) => (
          <li key={`f-${index}`}>{item.extra > 1 ? `Figure: ${item.raw} ×${item.extra}` : `Figure: ${item.raw}`}</li>
        ))}
      </ul>
    </div>
  );
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function Pane({
  title,
  scrollerRef,
  children,
  extra,
}: {
  title: string;
  scrollerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-line-dark first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0">
      <div className="flex shrink-0 items-center gap-2 border-b border-line-dark px-3 py-1">
        <p className="min-w-0 flex-1 truncate text-sm text-muted">{title}</p>
        {extra}
      </div>
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-0 px-3 py-4">{children}</div>
      </div>
    </section>
  );
}

function messageFrom(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name: string }).name);
    if (name === "PasswordException") return "This PDF is password-protected. Quire cannot open it.";
    if (name === "InvalidPDFException") return "That file is not a PDF Quire can read.";
  }
  if (error instanceof Error && /password/i.test(error.message)) {
    return "This PDF is password-protected. Quire cannot open it.";
  }
  return "Quire could not open that file. It may be damaged or not a PDF.";
}
