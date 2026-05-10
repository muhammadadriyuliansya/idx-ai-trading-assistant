/**
 * Comparison Verdict — pilih pemenang + alasan saat user bandingin 2+ saham.
 */

export interface ComparisonStock {
  ticker: string;
  price: number;
  score: number;
  decision: string;
  rr: number;
  trend: string;
  rsi: number;
  volumeRatio: number;
}

export const COMPARISON_SYSTEM = `Kamu asisten trader saham Indonesia yang objektif.
Diberikan metrik beberapa saham. Tentukan mana yang paling menarik dan mana yang perlu hati-hati.
Output dalam Bahasa Indonesia:
- Baris pertama: "Pemenang: <TICKER>" (satu ticker saja)
- Selanjutnya: 2-3 bullet singkat alasan (mulai dengan "- ")
- Baris terakhir: "Perlu hati-hati: <TICKER>" kalau ada, atau skip kalau tidak ada.
JANGAN bilang "beli" atau "jual". Fokus pada rating relatif antar kandidat berdasarkan metrik.`;

export function buildComparisonPrompt(stocks: ComparisonStock[]): string {
  const lines = stocks.map(
    (s) =>
      `- ${s.ticker}: skor ${s.score}/100, keputusan ${s.decision}, tren ${s.trend}, RR 1:${s.rr.toFixed(2)}, RSI ${s.rsi.toFixed(1)}, volume ${s.volumeRatio.toFixed(2)}x`,
  );

  return `Bandingkan saham-saham berikut:
${lines.join("\n")}

Kasih verdict dalam format:
Pemenang: <TICKER>
- <alasan 1>
- <alasan 2>
- <alasan 3>
Perlu hati-hati: <TICKER>`;
}

export interface ParsedVerdict {
  winner: string | null;
  reasons: string[];
  warning: string | null;
  raw: string;
}

export function parseComparisonVerdict(text: string, tickers: string[]): ParsedVerdict {
  const out: ParsedVerdict = { winner: null, reasons: [], warning: null, raw: text.trim() };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const winnerMatch = line.match(/^pemenang\s*[:\-]\s*([A-Z]{2,5})/i);
    if (winnerMatch) {
      const t = winnerMatch[1].toUpperCase();
      if (tickers.includes(t)) out.winner = t;
      continue;
    }
    const warnMatch = line.match(/(?:perlu hati-hati|waspadai|hindari)\s*[:\-]\s*([A-Z]{2,5})/i);
    if (warnMatch) {
      const t = warnMatch[1].toUpperCase();
      if (tickers.includes(t)) out.warning = t;
      continue;
    }
    if (/^[-•]/.test(line)) {
      out.reasons.push(line.replace(/^[-•]\s*/, "").slice(0, 300));
    }
  }

  return out;
}
