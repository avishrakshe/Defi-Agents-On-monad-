/**
 * Latencies this backend instance measured itself when it submitted ER payments (sendRawTransaction → confirmed).
 * In-memory: everything else on /api/magicblock/metrics is read from chain; this ring buffer is the one exception,
 * so the API always reports its sample count and that it is per-instance.
 */
const MAX = 100;
const samples: { ms: number; sig: string; at: string }[] = [];

export function recordErConfirm(ms: number, sig: string) {
  samples.push({ ms, sig, at: new Date().toISOString() });
  if (samples.length > MAX) samples.shift();
}

export function erConfirmStats() {
  if (!samples.length) return { n: 0, medianMs: null as number | null, minMs: null as number | null, maxMs: null as number | null, last: [] as typeof samples };
  const s = samples.map((x) => x.ms).sort((a, b) => a - b);
  const median = s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  return { n: s.length, medianMs: median, minMs: s[0], maxMs: s[s.length - 1], last: samples.slice(-5) };
}
