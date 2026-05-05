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
// INSTITUTIONAL EXPORT — Full Brief (Plain Text Format)
// ============================================================================

export function exportFullBrief(pipeline: AnalysisPipeline): string {
  const now = new Date().toLocaleDateString("en-GB");
  const separator = "=".repeat(50);
  const dash = "-".repeat(50);

  const lines: string[] = [];

  // Header
  lines.push(separator);
  lines.push(`📊 IDX INSTITUTIONAL BRIEF: ${pipeline.ticker}`);
  lines.push(`Generated: ${now}`);
  lines.push(separator);
  lines.push("");

  // FINAL DECISION
  lines.push("FINAL DECISION");
  lines.push(`Action     : ${pipeline.decision.finalDecision}`);
  lines.push(`Score      : ${pipeline.finalScore} / 100`);
  lines.push(`Confidence : ${pipeline.decision.successProbability >= 70 ? "HIGH" : pipeline.decision.successProbability >= 40 ? "MEDIUM" : "LOW"}`);
  lines.push(`Regime     : ${pipeline.context.marketRegime}`);
  lines.push("");

  // EXECUTIVE SUMMARY
  lines.push(dash);
  lines.push("🧠 EXECUTIVE SUMMARY");
  if (pipeline.thesis && pipeline.thesis.executiveSummary) {
    lines.push(pipeline.thesis.executiveSummary);
  } else {
    const decision = pipeline.decision.finalDecision;
    if (decision === "REJECT") {
      lines.push("Setup tidak layak untuk entry. Struktur harga masih dalam tren turun dengan momentum lemah dan tidak ada katalis kuat dari sisi fundamental maupun sentimen untuk membalik arah dalam waktu dekat.");
    } else {
      lines.push(`${pipeline.ticker} menunjukkan setup trading yang valid dengan multiple konfirmasi dari analisis teknikal, fundamental, dan sentimen.`);
    }
  }
  lines.push("");

  // TECHNICAL THESIS
  lines.push(dash);
  lines.push("📉 TECHNICAL THESIS");
  if (pipeline.thesis && pipeline.thesis.technicalThesis.length > 0) {
    for (const t of pipeline.thesis.technicalThesis) {
      lines.push(`- ${t}`);
    }
  } else {
    const ind = pipeline.indicators;
    lines.push(`- Trend: ${ind?.trend ?? "-"}`);
    lines.push(`- Momentum: ${ind?.rsi != null ? (ind.rsi > 50 ? "kuat" : ind.rsi > 30 ? "netral" : "lemah") : "-"} (RSI: ${ind?.rsi?.toFixed(1) ?? "-"})`);
    lines.push(`- Volume: ${ind?.volumeRatio != null ? (ind.volumeRatio > 1.5 ? "tinggi" : ind.volumeRatio > 1 ? "moderat" : "rendah") : "-"}`);
    lines.push(`- Price structure: ${ind?.trend === "bullish" ? "higher high & higher low" : ind?.trend === "bearish" ? "lower high & lower low" : "-"}`);
  }
  lines.push("");
  lines.push("Kesimpulan:");
  if (pipeline.scanner?.setupScore != null && pipeline.scanner.setupScore >= 70) {
    lines.push("Terdapat sinyal valid untuk entry.");
  } else {
    lines.push("Tidak ada sinyal valid untuk entry.");
  }
  lines.push("");

  // FUNDAMENTAL CONTEXT
  lines.push(dash);
  lines.push("🏦 FUNDAMENTAL CONTEXT");
  const fundamentalReport = pipeline.analystReports?.find(r => r.agent === "fundamental-analyst");
  if (fundamentalReport) {
    lines.push(`- ${fundamentalReport.summary}`);
  } else {
    lines.push("- Tidak ada faktor fundamental kuat yang mendukung upside");
    lines.push("- Tidak ada katalis signifikan dalam waktu dekat");
  }
  lines.push("");
  const fundBias = fundamentalReport?.bias ?? "neutral";
  lines.push(`Bias: ${fundBias.toUpperCase() === "BULLISH" ? "Bullish" : fundBias.toUpperCase() === "BEARISH" ? "Bearish" : "Neutral to Weak"}`);
  lines.push("");

  // NEWS INTELLIGENCE
  lines.push(dash);
  lines.push("📰 NEWS INTELLIGENCE");
  if (pipeline.newsIntelligence && pipeline.newsIntelligence.totalArticles > 0) {
    lines.push(`- ${pipeline.newsIntelligence.totalArticles} artikel ditemukan dengan sentimen ${pipeline.newsIntelligence.dominantSentiment}`);
    if (pipeline.newsIntelligence.keyTopics.length > 0) {
      lines.push(`- Topik: ${pipeline.newsIntelligence.keyTopics.slice(0, 3).join(", ")}`);
    }
  } else {
    lines.push("- Tidak ditemukan berita signifikan yang mendukung pergerakan bullish");
    lines.push("- Tidak ada katalis jangka pendek");
  }
  const newsBias = pipeline.newsIntelligence?.dominantSentiment ?? "neutral";
  lines.push("");
  lines.push(`Bias: ${newsBias.charAt(0).toUpperCase() + newsBias.slice(1)}`);
  lines.push("");

  // SOCIAL SENTIMENT
  lines.push(dash);
  lines.push("💬 SOCIAL SENTIMENT");
  if (pipeline.macroContext?.socialSentiment) {
    lines.push(`- Sentimen: ${pipeline.macroContext.socialSentiment.bias}`);
    lines.push(`- Skor: ${pipeline.macroContext.socialSentiment.score.toFixed(2)}`);
  } else {
    lines.push("- Aktivitas rendah");
    lines.push("- Tidak ada peningkatan minat retail");
  }
  lines.push("");
  lines.push("Bias: Neutral / Weak");
  lines.push("");

  // BULL vs BEAR ANALYSIS
  lines.push(dash);
  lines.push("⚖️ BULL vs BEAR ANALYSIS");
  lines.push("");
  lines.push("Bull Case:");
  if (pipeline.debateMatrix?.bullCase && pipeline.debateMatrix.bullCase.length > 0) {
    for (const b of pipeline.debateMatrix.bullCase.slice(0, 3)) {
      lines.push(`- ${b}`);
    }
  } else {
    lines.push("- Potensi technical bounce minor di area support");
  }
  lines.push("");
  lines.push("Bear Case:");
  if (pipeline.debateMatrix?.bearCase && pipeline.debateMatrix.bearCase.length > 0) {
    for (const b of pipeline.debateMatrix.bearCase.slice(0, 3)) {
      lines.push(`- ${b}`);
    }
  } else {
    lines.push("- Trend utama masih turun");
    lines.push("- Tidak ada volume masuk");
    lines.push("- Tidak ada katalis");
  }
  lines.push("");
  const dominantBias = pipeline.debateMatrix?.dominantBias ?? (pipeline.scanner?.setupScore >= 70 ? "bullish" : "bearish");
  lines.push(`Dominant Bias: ${dominantBias.toUpperCase()}`);
  lines.push("");

  // RISK ANALYSIS
  lines.push(dash);
  lines.push("⚠️ RISK ANALYSIS");
  lines.push(`Entry    : ${pipeline.risk.entryZone}`);
  lines.push(`Stop Loss: ${pipeline.risk.stopLoss}`);
  lines.push(`TP1      : ${pipeline.risk.tp1}`);
  lines.push(`TP2      : ${pipeline.risk.tp2}`);
  lines.push("");
  lines.push("Risk Reward:");
  lines.push(`- TP1: 1 : ${pipeline.risk.rr1.toFixed(2)}`);
  lines.push(`- TP2: 1 : ${pipeline.risk.rr2.toFixed(2)}`);
  lines.push("");
  lines.push("Masalah utama:");
  if (pipeline.risk.rr1 < 1.5) {
    lines.push("- RR terlalu rendah (minimal 1.5)");
  }
  if (pipeline.scanner?.setupScore != null && pipeline.scanner.setupScore < 70) {
    lines.push("- Probabilitas hit TP rendah");
    lines.push("- Setup quality buruk");
  }
  lines.push("");

  // PORTFOLIO DECISION
  lines.push(dash);
  lines.push("📊 PORTFOLIO DECISION");
  lines.push(`Status: ${pipeline.portfolioDecision?.action ?? pipeline.decision.finalDecision}`);
  lines.push("");
  lines.push("Alasan:");
  if (pipeline.portfolioDecision?.reasoning && pipeline.portfolioDecision.reasoning.length > 0) {
    for (const r of pipeline.portfolioDecision.reasoning.slice(0, 3)) {
      lines.push(`- ${r}`);
    }
  } else {
    lines.push(`- Setup score ${pipeline.scanner?.setupScore ?? pipeline.finalScore}/100`);
    lines.push("- Trend tidak mendukung");
    lines.push("- Tidak ada konfirmasi dari sentiment & news");
  }
  lines.push("");

  // EXECUTION PLAN
  lines.push(dash);
  lines.push("🎯 EXECUTION PLAN");
  if (pipeline.decision.finalDecision === "REJECT" || pipeline.portfolioDecision?.action === "REJECT") {
    lines.push("Tidak ada entry yang direkomendasikan.");
  } else {
    lines.push(`Entry: ${pipeline.risk.entryZone}`);
    lines.push(`Stop Loss: ${pipeline.risk.stopLoss}`);
    lines.push(`Target: ${pipeline.risk.tp1} (TP1), ${pipeline.risk.tp2} (TP2)`);
    lines.push(`Position Size: ${pipeline.risk.positionSize.lots} lots`);
  }
  lines.push("");

  // FINAL NOTE
  lines.push(dash);
  lines.push("📌 FINAL NOTE");
  if (pipeline.decision.finalDecision === "REJECT") {
    lines.push("Fokus ke saham dengan:");
    lines.push("- Trend jelas");
    lines.push("- Volume kuat");
    lines.push("- Catalyst ada");
  } else {
    lines.push("Setup valid. Pastikan risk management diterapkan dengan disiplin.");
  }
  lines.push("");

  lines.push(separator);

  return lines.join("\n");
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
1. **Second Opinion** — Do you agree or disagree with the pipeline's conclusion? Why?
2. **Strategic Refinement** — What would you add or change to improve the thesis?
3. **Institutional Commentary** — Any macro, sector, or structural factors the pipeline may have missed?
4. **Risk Assessment** — Any overlooked risks or tail events?
5. **Final Recommendation** — BUY / HOLD / SELL with 1-sentence rationale

Be concise and institutional in tone. Do not repeat data already in the brief.

---

${brief}`;
}
