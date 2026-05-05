import type { AnalysisPipeline } from "@/pipeline/types";

export interface ExportData {
  ticker: string;
  pipeline?: AnalysisPipeline;
  fundamental?: {
    per: number | null;
    pbv: number | null;
    roe: number | null;
    der: number | null;
    dividendYield: number | null;
    earningsGrowth: number | null;
    eps: number | null;
  } | null;
  news?: NewsItem[];
  generatedAt?: string;
}

export interface NewsItem {
  date: string;
  title: string;
  source: string;
}

// ============================================================================
// LEGACY EXPORT (backward compatible)
// ============================================================================

export function exportToBrief(data: ExportData): string {
  const { ticker, pipeline, fundamental, news } = data;
  const now = new Date().toLocaleDateString("id-ID");

  const lines: string[] = [];

  lines.push("=".repeat(50));
  lines.push(`IDX TRADING BRIEF: ${ticker}`);
  lines.push(`Generated: ${now}`);
  lines.push("=".repeat(50));
  lines.push("");

  if (pipeline) {
    lines.push("--- TECHNICAL ANALYSIS ---");
    const s = pipeline.scanner;
    const d = pipeline.decision;
    const c = pipeline.context;
    const r = pipeline.risk;
    const ind = pipeline.indicators;

    lines.push(`Setup Score  : ${s?.setupScore ?? "-"}/100`);
    lines.push(`Verdict      : ${d?.finalDecision ?? "-"}`);
    lines.push(`Confidence   : ${s?.confidence ?? "-"}`);
    lines.push(`Market Regime: ${c?.marketRegime ?? "-"}`);
    lines.push("");

    lines.push(`Trend    : ${ind?.trend ?? "-"}`);
    lines.push(`Volume   : ${ind?.volumeRatio != null ? ind.volumeRatio.toFixed(2) + "x" : "-"}`);
    lines.push(`RSI      : ${ind?.rsi != null ? ind.rsi.toFixed(1) : "-"}`);
    lines.push(`MACD     : ${ind?.macd?.label ?? "-"}`);
    lines.push("");

    lines.push(`Entry : ${r?.entryZone ?? "-"}`);
    lines.push(`SL    : ${r?.stopLoss ?? "-"}`);
    lines.push(`TP1   : ${r?.tp1 ?? "-"}`);
    lines.push(`TP2   : ${r?.tp2 ?? "-"}`);
    lines.push(`RR    : ${r?.rr1 != null ? r.rr1.toFixed(2) : "-"}`);
    lines.push("");
  }

  if (fundamental) {
    lines.push("--- FUNDAMENTAL ---");
    if (fundamental.per != null) lines.push(`PER           : ${fundamental.per.toFixed(2)}x`);
    if (fundamental.pbv != null) lines.push(`PBV           : ${fundamental.pbv.toFixed(2)}x`);
    if (fundamental.roe != null) lines.push(`ROE           : ${(fundamental.roe * 100).toFixed(1)}%`);
    if (fundamental.der != null) lines.push(`DER           : ${fundamental.der.toFixed(2)}`);
    if (fundamental.earningsGrowth != null) lines.push(`EPS Growth YoY: ${(fundamental.earningsGrowth * 100).toFixed(1)}%`);
    if (fundamental.dividendYield != null) lines.push(`Div Yield     : ${(fundamental.dividendYield * 100).toFixed(2)}%`);
    if (fundamental.eps != null) lines.push(`EPS (Trailing) : Rp ${fundamental.eps.toFixed(0)}`);
    lines.push("");
  }

  if (news && news.length > 0) {
    lines.push("--- BERITA TERBARU ---");
    news.forEach((n) => {
      lines.push(`[${n.date}] ${n.source}: "${n.title}"`);
    });
    lines.push("");
  }

  lines.push("--- PROMPT UNTUK AI ---");
  lines.push(`Analisis saham ${ticker} berikut berdasarkan data di atas.`);
  lines.push("=".repeat(50));

  return lines.join("\n");
}

// ============================================================================
// INSTITUTIONAL EXPORT - Full Brief (Plain Text Format)
// ============================================================================

type BriefBias = "BULLISH" | "BEARISH" | "NEUTRAL";

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(digits);
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percent.toFixed(digits)}%`;
}

function formatCurrency(value: number | string | null | undefined): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (numeric == null || !Number.isFinite(numeric)) return String(value ?? "N/A");
  return `Rp ${numeric.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function dedupeBullets(items: Array<string | null | undefined>, fallback: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of [...items, ...fallback]) {
    const clean = item?.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= 4) break;
  }

  while (result.length < 2) {
    result.push("Data belum cukup kuat, sehingga interpretasi tetap perlu dibuat konservatif.");
  }

  return result;
}

function getDominantBias(score: number): BriefBias {
  if (score < 40) return "BEARISH";
  if (score > 60) return "BULLISH";
  return "NEUTRAL";
}

function buildTechnicalBullets(pipeline: AnalysisPipeline): string[] {
  const { indicators, marketData, scanner } = pipeline;
  const bullets: string[] = [];

  if (indicators.trend === "bearish") {
    bullets.push("Struktur harga masih menunjukkan tren turun, sehingga rebound perlu diperlakukan sebagai counter-trend sampai ada reversal yang jelas.");
  } else if (indicators.trend === "bullish") {
    bullets.push("Struktur harga masih konstruktif dan mendukung skenario continuation selama support utama tidak ditembus.");
  } else {
    bullets.push("Harga bergerak sideways, sehingga entry sebaiknya menunggu breakout atau pullback yang lebih bersih.");
  }

  if (indicators.rsi < 40) {
    bullets.push(`Momentum masih lemah dengan RSI ${formatNumber(indicators.rsi, 1)}, belum cukup untuk mengonfirmasi pembalikan arah.`);
  } else if (indicators.rsi > 70) {
    bullets.push(`RSI ${formatNumber(indicators.rsi, 1)} berada di area panas, sehingga upside harus dibaca bersama risiko pullback.`);
  } else {
    bullets.push(`RSI ${formatNumber(indicators.rsi, 1)} berada di zona netral, belum memberi sinyal ekstrem untuk entry agresif.`);
  }

  if (indicators.volumeRatio < 1) {
    bullets.push(`Volume hanya ${formatNumber(indicators.volumeRatio, 2)}x rata-rata, jadi buyer belum menunjukkan partisipasi kuat.`);
  } else {
    bullets.push(`Volume ${formatNumber(indicators.volumeRatio, 2)}x rata-rata memberi konfirmasi partisipasi yang lebih baik, tetapi tetap perlu validasi price action.`);
  }

  if (marketData.currentPrice < indicators.ema20 && marketData.currentPrice < indicators.ema50) {
    bullets.push("Harga masih di bawah EMA20 dan EMA50, tanda buyer belum mengambil kontrol jangka pendek.");
  } else if (marketData.currentPrice > indicators.ema20 && marketData.currentPrice > indicators.ema50) {
    bullets.push("Harga berada di atas EMA20 dan EMA50, sehingga struktur jangka pendek lebih mendukung skenario follow-through.");
  }

  return dedupeBullets(bullets, [
    `Scanner membaca setup ${scanner.setupType} dengan status ${scanner.status} dan skor ${scanner.setupScore}/100.`,
    scanner.reasoning,
  ]);
}

function buildFundamentalBullets(pipeline: AnalysisPipeline): { bullets: string[]; bias: BriefBias } {
  const { fundamental, analystReports } = pipeline;
  const report = analystReports.find((item) => item.agent === "fundamental-analyst");
  const bullets: string[] = [];
  let score = 0;

  if (!fundamental) {
    return {
      bullets: [
        "Data fundamental tidak tersedia, jadi brief tidak menaruh bobot besar pada valuasi atau kualitas laba.",
        "Keputusan lebih banyak ditentukan oleh teknikal, risiko, market regime, dan sentimen yang tersedia.",
      ],
      bias: "NEUTRAL",
    };
  }

  if (fundamental.per != null) {
    if (fundamental.per > 25) {
      bullets.push(`PER ${formatNumber(fundamental.per, 1)}x relatif mahal dan membutuhkan growth kuat untuk membenarkan upside.`);
      score -= 1;
    } else if (fundamental.per > 0 && fundamental.per < 10) {
      bullets.push(`PER ${formatNumber(fundamental.per, 1)}x memberi bantalan valuasi karena saham terlihat relatif murah.`);
      score += 1;
    } else {
      bullets.push(`PER ${formatNumber(fundamental.per, 1)}x berada di area wajar, sehingga valuasi bukan katalis utama.`);
    }
  }

  if (fundamental.roe != null) {
    const roe = Math.abs(fundamental.roe) <= 1 ? fundamental.roe * 100 : fundamental.roe;
    if (roe >= 15) {
      bullets.push(`ROE ${formatNumber(roe, 1)}% menunjukkan profitabilitas kuat dan kualitas bisnis yang lebih defensif.`);
      score += 1;
    } else {
      bullets.push(`ROE ${formatNumber(roe, 1)}% belum cukup kuat untuk menjadi penopang utama thesis bullish.`);
      score -= 1;
    }
  }

  const growth = fundamental.earningsGrowth ?? fundamental.revenueGrowth;
  if (growth != null) {
    const growthPct = Math.abs(growth) <= 1 ? growth * 100 : growth;
    if (growthPct < 5) {
      bullets.push(`Growth ${formatNumber(growthPct, 1)}% masih terbatas, sehingga upside perlu dibantu katalis lain.`);
      score -= 1;
    } else {
      bullets.push(`Growth ${formatNumber(growthPct, 1)}% memberi dukungan terhadap ekspektasi perbaikan laba.`);
      score += 1;
    }
  }

  const bias: BriefBias = report?.bias === "bullish" || score > 0 ? "BULLISH" : report?.bias === "bearish" || score < 0 ? "BEARISH" : "NEUTRAL";

  return {
    bullets: dedupeBullets(bullets, [
      ...(report?.summary ? [report.summary] : []),
      ...(report?.signals ?? []),
      ...(report?.risks ?? []),
      "Fundamental tidak memberi sinyal ekstrem; eksekusi tetap bergantung pada kualitas setup dan risiko.",
    ]),
    bias,
  };
}

function buildNewsBullets(pipeline: AnalysisPipeline): { bullets: string[]; bias: BriefBias } {
  const news = pipeline.newsIntelligence;
  const bullets: string[] = [];

  if (news.totalArticles === 0 || news.recentHeadlines.length === 0) {
    bullets.push("Tidak ada katalis berita signifikan yang terdeteksi dari feed terbaru.");
    bullets.push("Tanpa headline pendukung, pergerakan harga harus lebih banyak divalidasi oleh volume dan struktur teknikal.");
  } else {
    bullets.push(`${news.totalArticles} artikel terdeteksi dengan sentimen dominan ${news.dominantSentiment}.`);
    news.recentHeadlines.slice(0, 2).forEach((headline) => {
      bullets.push(`Highlight berita: ${headline}`);
    });
  }

  let bias: BriefBias = "NEUTRAL";
  if (news.sentimentScore > 0 || news.dominantSentiment === "positive") bias = "BULLISH";
  if (news.sentimentScore < 0 || news.dominantSentiment === "negative") bias = "BEARISH";

  return {
    bullets: dedupeBullets(bullets, ["Berita belum memberi edge mandiri dan tetap harus dibaca bersama price action."]),
    bias,
  };
}

function buildSocialBullets(pipeline: AnalysisPipeline): { bullets: string[]; bias: BriefBias } {
  const social = pipeline.socialSentiment;
  const bullets: string[] = [];

  if (social.score > 0) {
    bullets.push(`Sentimen sosial cenderung positif dengan skor ${formatNumber(social.score, 2)}.`);
  } else if (social.score < 0) {
    bullets.push(`Sentimen sosial cenderung negatif dengan skor ${formatNumber(social.score, 2)}.`);
  } else {
    bullets.push("Sentimen sosial masih netral dan belum memberi dorongan arah yang jelas.");
  }

  bullets.push(`Momentum percakapan ${social.momentum} dengan ${social.mentions} mentions; ini konfirmasi sekunder, bukan sinyal entry utama.`);

  if (social.topKeywords.length > 0) {
    bullets.push(`Keyword dominan: ${social.topKeywords.slice(0, 3).join(", ")}.`);
  }

  return {
    bullets: dedupeBullets(bullets, ["Belum terlihat tema retail yang cukup kuat untuk mengubah keputusan utama."]),
    bias: social.score > 0 ? "BULLISH" : social.score < 0 ? "BEARISH" : "NEUTRAL",
  };
}

function buildExecutiveSummary(pipeline: AnalysisPipeline, dominantBias: BriefBias): string {
  const { indicators, risk, decision, finalScore } = pipeline;
  const weakTrend = indicators.trend === "bearish";
  const weakMomentum = indicators.rsi < 40;
  const weakVolume = indicators.volumeRatio < 1;
  const rejected = decision.finalDecision === "REJECT" || pipeline.portfolioDecision.action === "REJECTED";

  if (rejected && weakTrend) {
    return `Setup ${pipeline.ticker} belum layak entry. Skor ${finalScore}/100 berada pada bias ${dominantBias}, trend masih bearish, momentum lemah, dan volume belum cukup mendukung reversal.`;
  }

  if (risk.rr1 >= 2 && finalScore < 50) {
    return `RR terlihat menarik di ${formatNumber(risk.rr1, 2)}x, tetapi probabilitas setup masih rendah karena kualitas sinyal belum memadai. Ini lebih cocok dipantau daripada dieksekusi agresif.`;
  }

  if (decision.finalDecision === "BUY_NOW") {
    return `Setup ${pipeline.ticker} layak dipertimbangkan karena keputusan akhir ${decision.finalDecision}, skor ${finalScore}/100, dan risk plan sudah terbentuk. Eksekusi tetap harus mengikuti stop loss.`;
  }

  const blockers = [
    weakTrend ? "trend belum pulih" : null,
    weakMomentum ? "momentum masih lemah" : null,
    weakVolume ? "volume belum mengonfirmasi" : null,
  ].filter(Boolean).join(", ");

  return `Setup ${pipeline.ticker} masih membutuhkan konfirmasi tambahan${blockers ? ` karena ${blockers}` : ""}. Keputusan saat ini lebih defensif daripada agresif.`;
}

export function exportFullBrief(pipeline: AnalysisPipeline): string {
  const technical = buildTechnicalBullets(pipeline);
  const fundamental = buildFundamentalBullets(pipeline);
  const news = buildNewsBullets(pipeline);
  const social = buildSocialBullets(pipeline);
  const dominantBias = getDominantBias(pipeline.finalScore);
  const rejected = pipeline.decision.finalDecision === "REJECT" || pipeline.portfolioDecision.action === "REJECTED";
  const bullCase = dedupeBullets(
    [
      ...pipeline.debateMatrix.bullCase,
      ...pipeline.debate.bullishArguments,
      pipeline.risk.rr1 >= 2 ? `RR TP1 ${formatNumber(pipeline.risk.rr1, 2)}x memberi payoff menarik jika setup terkonfirmasi.` : null,
      pipeline.indicators.rsi < 35 ? `RSI ${formatNumber(pipeline.indicators.rsi, 1)} mulai oversold dan membuka peluang technical bounce.` : null,
    ],
    ["Ada peluang perbaikan jika harga bertahan di atas support dan volume mulai masuk."]
  );
  const bearCase = dedupeBullets(
    [
      ...pipeline.debateMatrix.bearCase,
      ...pipeline.debate.bearishArguments,
      pipeline.indicators.trend === "bearish" ? "Trend bearish masih menjadi hambatan utama karena struktur belum menunjukkan reversal." : null,
      pipeline.indicators.volumeRatio < 1 ? "Volume lemah membuat peluang rebound menjadi kurang dapat dipercaya." : null,
      pipeline.newsIntelligence.totalArticles === 0 ? "Tidak ada katalis berita yang dapat mempercepat rerating jangka pendek." : null,
    ],
    [pipeline.decision.keyRisk, "Setup rentan gagal jika support ditembus atau market regime tetap defensif."]
  );
  const portfolioReasons = dedupeBullets(
    [
      ...pipeline.portfolioDecision.reasoning,
      rejected ? "Setup tidak memenuhi kriteria entry karena edge belum cukup kuat dibanding risiko." : "Setup dapat dipantau selama level risiko tetap dipatuhi.",
      `Market regime ${pipeline.context.marketRegime}, scanner ${pipeline.scanner.status}, dan risk verdict ${pipeline.risk.verdict} menjadi filter utama.`,
    ],
    [pipeline.decision.reasoning]
  );

  return `
==================================================
IDX INSTITUTIONAL BRIEF: ${pipeline.ticker}
Generated: ${new Date(pipeline.timestamp || Date.now()).toLocaleDateString("id-ID")}
==================================================

FINAL DECISION
Action:     ${pipeline.decision.finalDecision}
Portfolio:  ${pipeline.portfolioDecision.action}
Score:      ${pipeline.finalScore}/100
Confidence: ${pipeline.confidence}
Regime:     ${pipeline.context.marketRegime}

--------------------------------------------------
EXECUTIVE SUMMARY
${buildExecutiveSummary(pipeline, dominantBias)}

--------------------------------------------------
TECHNICAL THESIS
${technical.map((item) => `- ${item}`).join("\n")}

Kesimpulan:
${pipeline.scanner.status === "VALID" ? "Setup teknikal dapat dipertimbangkan, tetapi eksekusi tetap harus mengikuti risk plan." : "Belum ada sinyal entry berkualitas tinggi; prioritasnya adalah menunggu konfirmasi yang lebih kuat."}

--------------------------------------------------
FUNDAMENTAL CONTEXT
${fundamental.bullets.map((item) => `- ${item}`).join("\n")}
Bias: ${fundamental.bias}

--------------------------------------------------
NEWS INTELLIGENCE
${news.bullets.map((item) => `- ${item}`).join("\n")}
Bias: ${news.bias}

--------------------------------------------------
SOCIAL SENTIMENT
${social.bullets.map((item) => `- ${item}`).join("\n")}
Bias: ${social.bias}

--------------------------------------------------
BULL vs BEAR

Bull Case:
${bullCase.map((item) => `- ${item}`).join("\n")}

Bear Case:
${bearCase.map((item) => `- ${item}`).join("\n")}

Dominant Bias: ${dominantBias}

--------------------------------------------------
RISK ANALYSIS
Entry:     ${pipeline.risk.entryZone}
Stop Loss: ${formatCurrency(pipeline.risk.stopLoss)}
TP1:       ${formatCurrency(pipeline.risk.tp1)} (RR ${formatNumber(pipeline.risk.rr1, 2)}x)
TP2:       ${formatCurrency(pipeline.risk.tp2)} (RR ${formatNumber(pipeline.risk.rr2, 2)}x)
Size:      ${pipeline.risk.positionSize.lots} lot / ${pipeline.risk.positionSize.shares} saham
Max Loss:  ${formatCurrency(pipeline.risk.positionSize.maxLoss)}

Catatan:
- ${pipeline.risk.rr1 >= 2 && pipeline.decision.successProbability < 50 ? `RR menarik, tetapi probability ${pipeline.decision.successProbability}% masih rendah sehingga size harus konservatif.` : pipeline.risk.reasoning}
- Stop loss di ${formatCurrency(pipeline.risk.stopLoss)} menjadi level invalidasi thesis.

--------------------------------------------------
PORTFOLIO DECISION
Status: ${pipeline.portfolioDecision.action}
Recommended Risk: ${formatPercent(pipeline.portfolioDecision.recommendedRiskPercent)}

Alasan:
${portfolioReasons.map((item) => `- ${item}`).join("\n")}

--------------------------------------------------
EXECUTION PLAN
${rejected ? "Tidak ada entry yang direkomendasikan. Pantau ulang hanya jika trend membaik, volume kembali masuk, dan struktur harga mengonfirmasi reversal." : `Entry di ${pipeline.risk.entryZone}, stop di ${formatCurrency(pipeline.risk.stopLoss)}, target bertahap di ${formatCurrency(pipeline.risk.tp1)} lalu ${formatCurrency(pipeline.risk.tp2)}.`}

--------------------------------------------------
FINAL NOTE
Brief ini adalah second-layer trading memo dari pipeline deterministic. Gunakan untuk menantang thesis, memeriksa alasan keputusan, dan menjaga disiplin risiko; bukan sebagai sinyal beli otomatis.

==================================================
`.trim();
}

// ============================================================================
// MARKDOWN REPORT (cleaner version)
// ============================================================================

export function exportMarkdownReport(pipeline: AnalysisPipeline): string {
  return exportFullBrief(pipeline);
}

// ============================================================================
// JSON REPORT
// ============================================================================

export function exportJsonReport(pipeline: AnalysisPipeline): string {
  const exportData = {
    ticker: pipeline.ticker,
    timestamp: new Date(pipeline.timestamp).toISOString(),
    finalScore: pipeline.finalScore,
    status: pipeline.status,
    marketRegime: pipeline.context.marketRegime,
    analystReports: pipeline.analystReports,
    debateMatrix: pipeline.debateMatrix,
    thesis: pipeline.thesis,
    portfolioDecision: pipeline.portfolioDecision,
    scanner: pipeline.scanner,
    risk: pipeline.risk,
    decision: pipeline.decision,
    newsIntelligence: pipeline.newsIntelligence,
    macroContext: pipeline.macroContext,
  };

  return JSON.stringify(exportData, null, 2);
}

// ============================================================================
// AI-READY PROMPT
// ============================================================================

export function exportAIReadyPrompt(pipeline: AnalysisPipeline): string {
  const brief = exportFullBrief(pipeline);

  return `You are an institutional equity analyst reviewing a deterministic trading analysis.

Below is a complete trading brief generated by a rule-based analysis pipeline.

Please provide:
1. **Second Opinion** - Do you agree or disagree with the pipeline's conclusion? Why?
2. **Strategic Refinement** - What would you add or change to improve the thesis?
3. **Institutional Commentary** - Any macro, sector, or structural factors the pipeline may have missed?
4. **Risk Assessment** - Any overlooked risks or tail events?
5. **Final Recommendation** - BUY / HOLD / SELL with 1-sentence rationale

Be concise and institutional in tone. Do not repeat data already in the brief.

---

${brief}`;
}
