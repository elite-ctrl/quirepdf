import { useState, type FormEvent } from "react";
import { loadUsage, type UsageReport } from "@/lib/usage";

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function Usage({ onClose }: { onClose: () => void }) {
  const [owner, setOwner] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Extract<UsageReport, { ok: true }> | null>(null);

  async function show(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await loadUsage({ data: { owner } });
      if (!next.ok) {
        setReport(null);
        setError("That owner code is not recognised.");
        return;
      }
      setReport(next);
    } catch {
      setReport(null);
      setError("The report could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  const computers = report?.browsers ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-md bg-paper p-5 text-ink" role="dialog" aria-modal="true" aria-labelledby="quire-usage-title">
        <h2 id="quire-usage-title" className="text-2xl text-balance">
          Passcode use
        </h2>
        <p className="mt-2 text-sm text-pretty text-ink-soft">
          Each computer that accepted the passcode. The PDF is not included. More than one computer means the code was typed somewhere else. A phone and a laptop count as two.
        </p>
        <form onSubmit={(event) => void show(event)} className="mt-4">
          <label className="block text-sm" htmlFor="quire-owner">
            Owner code
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="quire-owner"
              value={owner}
              onChange={(event) => {
                setOwner(event.target.value);
                setError("");
              }}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 rounded-md bg-white px-3 text-sm text-ink outline-none"
            />
            <button type="submit" disabled={busy} className="h-11 rounded-md bg-brass px-4 text-sm text-paper disabled:opacity-40">
              {busy ? "Loading" : "Show"}
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-3 text-sm" role="alert">
            {error}
          </p>
        )}
        {report && (
          <div className="mt-4 min-h-0 flex-1 overflow-auto">
            <p className="text-sm text-ink">
              {computers === 0
                ? "No computer has entered the passcode on this copy yet."
                : computers === 1
                  ? "1 computer has used the passcode."
                  : `${computers} computers have used the passcode.`}
            </p>
            <ul className="mt-3">
              {report.rows.map((row) => (
                <li key={row.browser} className="border-t border-line py-3 text-sm first:border-t-0">
                  <p className="text-ink">{row.agent}</p>
                  <p className="mt-1 text-ink-soft">
                    {row.browser.slice(0, 8)} · First {when(row.firstSeen)} · Last {when(row.lastSeen)} ·{" "}
                    {row.visits === 1 ? "1 visit" : `${row.visits} visits`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-md px-4 text-sm text-ink">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
