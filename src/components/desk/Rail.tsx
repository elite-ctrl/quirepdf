import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Trash2, X } from "lucide-react";
import {
  INKS,
  KINDS,
  LABELS,
  kindName,
  labelName,
  sortMarks,
  type InkId,
  type Kind,
  type LabelId,
  type Mark,
} from "@/lib/marks";

type KindFilter = "all" | Kind;

type Props = {
  marks: Mark[];
  remarks?: Mark[];
  activeId: string | null;
  noteRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onPick: (id: string) => void;
  onPatch: (id: string, patch: Partial<Mark>) => void;
  onNote: (id: string, value: string) => void;
  onNoteBlur: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

export function Rail({
  marks,
  remarks = [],
  activeId,
  noteRef,
  onClose,
  onPick,
  onPatch,
  onNote,
  onNoteBlur,
  onDelete,
  onClear,
}: Props) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [armed, setArmed] = useState(false);
  const sorted = sortMarks(marks);
  const remarkList = sortMarks(remarks);
  const filtered = sorted.filter((mark) => {
    if (kindFilter !== "all" && mark.kind !== kindFilter) return false;
    return true;
  });
  const active = marks.find((mark) => mark.id === activeId) ?? null;

  useEffect(() => {
    setArmed(false);
  }, [marks.length]);

  return (
    <aside className="fixed inset-0 z-30 flex min-h-0 flex-col bg-desk text-paper md:static md:z-auto md:w-96 md:shrink-0 md:border-l md:border-line-dark">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line-dark px-4">
        <div>
          <p className="text-xl font-bold leading-tight">Marks</p>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {filtered.length === marks.length ? `${marks.length}` : `${filtered.length} of ${marks.length}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close marks"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm hover:bg-raised"
        >
          <X size={18} strokeWidth={1.75} />
          Close
        </button>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-line-dark px-3 py-2">
        <FilterButton pressed={kindFilter === "all"} onClick={() => setKindFilter("all")}>
          All
        </FilterButton>
        {KINDS.map((kind) => (
          <FilterButton
            key={kind.id}
            pressed={kindFilter === kind.id}
            onClick={() => setKindFilter(kindFilter === kind.id ? "all" : kind.id)}
          >
            {kind.name}
          </FilterButton>
        ))}
      </div>

      {active && (
        <div className="shrink-0 border-b border-line-dark px-4 py-3">
          <p className="text-sm text-muted">
            Page {active.page} · {kindName(active.kind)}
          </p>
          {active.quote && (
            <p className="mt-2 line-clamp-3 text-sm text-pretty text-paper italic">“{active.quote}”</p>
          )}
          <label className="mt-3 block text-sm text-muted" htmlFor="quire-note">
            Note
          </label>
          <textarea
            id="quire-note"
            ref={noteRef}
            value={active.note}
            onChange={(event) => onNote(active.id, event.target.value)}
            onBlur={onNoteBlur}
            rows={4}
            spellCheck
            placeholder="What should change, and why."
            className="mt-1 w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Colour</span>
            {INKS.map((ink) => (
              <InkButton
                key={ink.id}
                ink={ink.id}
                name={ink.name}
                pressed={active.ink === ink.id}
                onClick={() => onPatch(active.id, { ink: ink.id })}
              />
            ))}
          </div>
          <label className="mt-3 block text-sm text-muted" htmlFor="quire-label">
            Label
          </label>
          <select
            id="quire-label"
            value={active.label}
            onChange={(event) => onPatch(active.id, { label: event.target.value as LabelId })}
            className="mt-1 h-11 w-full rounded-md border border-line-dark bg-raised px-3 text-sm text-paper"
          >
            {LABELS.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
          {active.kind !== "callout" && active.kind !== "arrow" && active.kind !== "square" && (
            <div className="mt-3 flex gap-2">
              {KINDS.filter((kind) => kind.id === "highlight" || kind.id === "underline" || kind.id === "strikeout").map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  aria-pressed={active.kind === kind.id}
                  onClick={() => onPatch(active.id, { kind: kind.id })}
                  className={`h-11 flex-1 rounded-md px-2 text-sm ${active.kind === kind.id ? "bg-brass text-paper" : "bg-raised text-paper"}`}
                >
                  {kind.name}
                </button>
              ))}
            </div>
          )}
          {active.kind === "square" && (
            <button
              type="button"
              aria-pressed={!!active.fill}
              onClick={() => onPatch(active.id, { fill: !active.fill })}
              className={`mt-3 h-11 w-full rounded-md px-2 text-sm ${active.fill ? "bg-brass text-paper" : "bg-raised text-paper"}`}
            >
              Tint inside
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(active.id)}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm text-paper hover:bg-raised"
          >
            <Trash2 size={16} strokeWidth={1.75} />
            Delete mark
          </button>
        </div>
      )}

      <ul className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {remarkList.length > 0 && (
          <li className="mb-3">
            <p className="px-1 pb-2 text-sm text-muted">
              Figures and dates
              <span className="ml-2 tabular-nums">{remarkList.length}</span>
            </p>
            <ul>
              {remarkList.map((mark) => (
                <li key={mark.id} className="mb-2">
                  <button
                    type="button"
                    id={`quire-note-${mark.id}`}
                    onClick={() => onPick(mark.id)}
                    aria-current={mark.id === activeId}
                    className={`w-full rounded-md border px-3 py-3 text-left ${mark.id === activeId ? "border-brass bg-raised" : "border-line-dark bg-desk hover:bg-raised"}`}
                    style={{ borderLeftWidth: 3, borderLeftColor: `var(--color-${mark.ink})` }}
                  >
                    <span className="flex items-baseline justify-between gap-3 text-sm text-muted">
                      <span>Target</span>
                      <span className="tabular-nums">p. {mark.page}</span>
                    </span>
                    <span className="mt-1 block text-sm text-pretty text-paper">{mark.note || mark.quote || "Difference"}</span>
                    {mark.quote && mark.note && (
                      <span className="mt-1 block line-clamp-2 text-sm text-muted">{mark.quote}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        )}
        {filtered.length === 0 && remarkList.length === 0 && (
          <li className="px-1 py-6 text-sm text-pretty text-muted">
            {marks.length === 0
              ? "No marks yet. Highlight a line, or drag a callout, an arrow, or a square."
              : "Nothing in this filter."}
          </li>
        )}
        {filtered.map((mark) => (
          <li key={mark.id} className="mb-2">
            <button
              type="button"
              id={`quire-note-${mark.id}`}
              onClick={() => onPick(mark.id)}
              aria-current={mark.id === activeId}
              className={`w-full rounded-md border px-3 py-3 text-left ${mark.id === activeId ? "border-brass bg-raised" : "border-line-dark bg-desk hover:bg-raised"}`}
              style={{ borderLeftWidth: 3, borderLeftColor: `var(--color-${mark.ink})` }}
            >
              <span className="flex items-baseline justify-between gap-3 text-sm text-muted">
                <span>
                  {kindName(mark.kind)} · {labelName(mark.label)}
                </span>
                <span className="tabular-nums">p. {mark.page}</span>
              </span>
              <span className="mt-1 block line-clamp-2 text-sm text-pretty text-paper">
                {mark.quote || (mark.kind === "callout" || mark.kind === "arrow" || mark.kind === "square" ? kindName(mark.kind) : "Marked text")}
              </span>
              {mark.note && <span className="mt-1 block line-clamp-2 text-sm text-muted">{mark.note}</span>}
            </button>
          </li>
        ))}
      </ul>

      {marks.length > 0 && (
        <div className="shrink-0 border-t border-line-dark px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              onClear();
              setArmed(false);
            }}
            className={`h-11 px-3 text-sm ${armed ? "bg-pink" : ""}`}
          >
            {armed ? "Confirm clear all" : "Clear all marks"}
          </button>
        </div>
      )}
    </aside>
  );
}

function FilterButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-11 shrink-0 rounded-md px-3 text-sm ${pressed ? "bg-brass text-paper" : "bg-raised text-paper"}`}
    >
      {children}
    </button>
  );
}

function InkButton({
  ink,
  name,
  pressed,
  onClick,
}: {
  ink: InkId;
  name: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={name}
      title={name}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${pressed ? "bg-stamp" : "bg-paper"}`}
    >
      <span className="block h-4 w-4 rounded-full" style={{ background: `var(--color-${ink})` }} />
      {name}
    </button>
  );
}
