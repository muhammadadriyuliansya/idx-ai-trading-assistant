/**
 * Multi-Timeframe Synthesis — gabungin 1D/1W/1M jadi satu verdict.
 *
 * Input: ringkasan trend, skor, dan RSI per timeframe.
 * Output: 2-4 bullet Bahasa Indonesia yang nyoritin alignment/conflict antar TF.
 */

export interface TimeframeSummary {
  label: string; // "Harian (1D)", "Mingguan (1W)", "Bulanan (1M)"
  score: number;
  decision: string;
  trend: string;
  rsi: number;
  volumeRatio: number;
}

export const MULTI_TF_SYSTEM = `Kamu asisten trader saham Indonesia.
Kamu dikasih rangkuman analisa di 3 timeframe (harian, mingguan, bulanan) untuk satu saham.
Tugasmu: kasih 2-4 bullet Bahasa Indonesia tentang bagaimana timeframe-timeframe tersebut aligned atau contradicting.
Bullet mulai dengan "- ". Jangan pakai istilah "beli" atau "jual".
Fokus pada apa yang terjadi antar timeframe: misalnya "1D bullish tapi 1M bearish menandakan pantulan jangka pendek", atau "semua TF aligned bullish menunjukan momentum multi-frame".`;

export function buildMultiTfPrompt(ticker: string, summaries: TimeframeSummary[]): string {
  const lines = summaries.map(
    (s) =>
      `- ${s.label}: skor ${s.score}/100, keputusan ${s.decision}, tren ${s.trend}, RSI ${s.rsi.toFixed(1)}, volume ${s.volumeRatio.toFixed(2)}x`,
  );

  return `Saham: ${ticker}

Data per timeframe:
${lines.join("\n")}

Kasih 2-4 bullet sintesis:`;
}

export function parseMultiTfResponse(text: string): string {
  const bullets = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || l.startsWith("•"))
    .map((l) => l.replace(/^[-•]\s*/, "- "))
    .slice(0, 4);

  if (bullets.length > 0) return bullets.join("\n");
  return text.trim().slice(0, 600);
}
