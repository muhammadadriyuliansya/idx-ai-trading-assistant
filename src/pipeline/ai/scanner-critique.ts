/**
 * Scanner Critique — generate 1-2 kalimat narasi per kandidat scanner.
 *
 * Deterministic pipeline sudah ranking saham berdasarkan skor. Fitur ini nambah
 * layer naratif: kenapa kandidat ini layak dilirik, atau kenapa perlu hati-hati.
 * Tidak mengubah skor, tidak mengubah ranking, cuma tambah konteks kualitatif.
 */
import type { ScanCandidate } from "@/pipeline/types";

export interface CritiqueInput {
  ticker: string;
  setupScore: number;
  status: ScanCandidate["status"];
  trend: ScanCandidate["trend"];
  volumeRatio: number;
  rr: number;
  mode: ScanCandidate["mode"];
  reason: string;
}

export const CRITIQUE_SYSTEM = `Kamu adalah asisten trader saham IDX yang kritis dan objektif.
Tugasmu: kasih 1-2 kalimat komentar tentang setup saham yang diberikan.
Bahasa Indonesia, tone profesional tapi santai. Fokus ke apa yang menonjol (positif maupun negatif) dari metrik yang diberikan.
JANGAN mengulang angka yang sudah diberikan. JANGAN bilang "beli" atau "jual" — itu bukan tugasmu.
Panjang maksimal 200 karakter. Satu output untuk satu saham.`;

export function buildCritiquePrompt(inputs: CritiqueInput[]): string {
  const lines = inputs.map((c, i) => {
    const rrLabel = c.rr >= 2 ? "bagus" : c.rr >= 1.5 ? "wajar" : "tipis";
    const volLabel =
      c.volumeRatio >= 2 ? "spike tinggi" : c.volumeRatio >= 1.2 ? "di atas rata-rata" : "sepi";
    return `${i + 1}. ${c.ticker} | mode: ${c.mode} | skor: ${c.setupScore}/100 | status: ${c.status} | tren: ${c.trend} | volume: ${c.volumeRatio.toFixed(2)}x (${volLabel}) | RR: 1:${c.rr.toFixed(2)} (${rrLabel}) | catatan: ${c.reason}`;
  });

  return `Berikut kandidat hasil scanner IDX hari ini. Untuk TIAP saham, kasih 1-2 kalimat komentar kritis & ringkas (maksimal 200 karakter). Format output HARUS seperti ini — tidak ada pengantar, tidak ada penutup:

${inputs.map((c, i) => `${i + 1}. ${c.ticker}: <komentar>`).join("\n")}

Data saham:
${lines.join("\n")}`;
}

/**
 * Parse balikan model ke map { ticker → critique }.
 * Format yang diharapkan:
 *   1. BBRI: <komentar>
 *   2. TLKM: <komentar>
 */
export function parseCritiqueResponse(
  text: string,
  tickers: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Match "1. BBRI: something" or "- BBRI: something" or "BBRI: something"
    const match = line.match(/^(?:[-*]|\d+\.)?\s*([A-Z]{2,5})\s*[:\-—]\s*(.+)$/);
    if (!match) continue;
    const ticker = match[1].toUpperCase();
    const critique = match[2].trim();
    if (tickers.includes(ticker) && critique.length > 0) {
      result[ticker] = critique.slice(0, 300);
    }
  }

  return result;
}
