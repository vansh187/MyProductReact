// Opt-in latency logging: enable with localStorage.perf = "1" and reload.
// Nothing here is user-visible.

let enabled: boolean | null = null;

export function perfEnabled(): boolean {
  if (enabled === null) {
    try { enabled = localStorage.getItem("perf") === "1"; } catch { enabled = false; }
  }
  return enabled;
}

const counters: Record<string, number> = {};

// For 1 in 20 messages: network + parse lag (Date.now() - srv_ts), and the
// time from receiving the message to the next paint.
export function logStreamLag(stream: string, srvTs: number | null | undefined) {
  if (!perfEnabled()) return;
  counters[stream] = (counters[stream] ?? 0) + 1;
  if (counters[stream] % 20 !== 1) return;
  const recv = performance.now();
  const lag = typeof srvTs === "number" ? Date.now() - srvTs : null;
  requestAnimationFrame(() => {
    const toPaint = performance.now() - recv;
    console.log(`[perf] ${stream}: server→recv ${lag ?? "?"} ms · recv→paint ${toPaint.toFixed(1)} ms`);
  });
}

export function mark(name: string) {
  if (perfEnabled()) performance.mark(name);
}

export function measure(name: string, startMark: string) {
  if (!perfEnabled()) return;
  try {
    const m = performance.measure(name, startMark);
    console.log(`[perf] ${name}: ${m.duration.toFixed(1)} ms`);
  } catch { /* start mark missing */ }
}
