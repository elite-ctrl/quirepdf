const KEY = "quire-browser";
const BROWSER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function browserKey(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && BROWSER.test(existing)) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "00000000-0000-4000-8000-000000000000";
  }
}

export function agentLabel(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";
  return `${browser} · ${os}`;
}

export function notePasscode(code: string) {
  const browser = browserKey();
  const agent = agentLabel();
  void import("./usage")
    .then(({ noteUnlock }) => noteUnlock({ data: { code, browser, agent } }))
    .catch(() => undefined);
}
