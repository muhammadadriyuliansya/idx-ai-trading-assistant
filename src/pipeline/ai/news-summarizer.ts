/**
 * News Summarizer — 3-baris rangkuman Bahasa Indonesia dari headline yang ada.
 *
 * Headline dikumpulin dari /api/news (deterministic). Ringkasan AI ini cuma
 * tambahan narasi; sentiment score tetap dihitung dari lexicon match, tidak
 * pernah dari AI (biar tetap reproducible).
 */

export const NEWS_SUMMARY_SYSTEM = `Kamu asisten riset pasar saham Indonesia.
Kamu diberikan sekumpulan headline berita tentang satu saham.
Tugasmu: bikin 3 bullet point Bahasa Indonesia yang merangkum tema utama berita tersebut.
Tiap bullet maksimal 140 karakter, mulai dengan "- ".
JANGAN menyimpulkan "beli" atau "jual". JANGAN ngarang fakta di luar headline.
Kalau headline bertentangan, akui itu secara eksplisit.`;

export function buildNewsSummaryPrompt(ticker: string, headlines: string[]): string {
  const list = headlines.slice(0, 10).map((h, i) => `${i + 1}. ${h}`).join("\n");
  return `Saham: ${ticker}

Headline terbaru:
${list}

Buat 3 bullet rangkuman dengan format tepat:
- <poin 1>
- <poin 2>
- <poin 3>`;
}

/**
 * Ambil baris-baris yang diawali "- " sebagai bullet. Kalau AI gagal kasih
 * format bullet, balikin apa adanya (sudah trimmed).
 */
export function parseNewsSummary(text: string): string {
  const bullets = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || l.startsWith("•"))
    .map((l) => l.replace(/^[-•]\s*/, "- "))
    .slice(0, 3);

  if (bullets.length > 0) return bullets.join("\n");
  return text.trim().slice(0, 500);
}
