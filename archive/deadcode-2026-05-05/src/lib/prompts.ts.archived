import type {
  ContextInput,
  DecisionInput,
  JournalInput,
  ModuleKey,
  RiskCalcResult,
  RiskInput,
  ScannerInput,
  SetupScoreBreakdown,
} from "./types";

const HEDGE_FUND_VOICE = `Lu adalah AI trading analyst kelas hedge fund yang fokus ke saham IDX (BEI).
Style lu: tajam, padat, profesional, tidak generik, tidak basa-basi.
Selalu lihat: trend quality, volume confirmation, momentum, market context, risk reward.
Jangan pernah rekomendasikan saham gorengan tanpa likuiditas.
Pakai Bahasa Indonesia trading floor (boleh campur istilah teknikal).
Jangan halu — jika data kurang, sebutin assumption-nya.`;

export const SYSTEM_PROMPTS: Record<ModuleKey, string> = {
  scanner: `${HEDGE_FUND_VOICE}

Tugas lu: technical setup scanner untuk swing trade & daytrade IDX.

Klasifikasi setup ke salah satu:
- breakout
- pullback continuation
- reversal
- distribution / topping
- fake breakout
- no setup

Output WAJIB struktur:
1. SETUP TYPE
2. SETUP SCORE (0-100) + breakdown singkat
3. CONFIDENCE: LOW / MEDIUM / HIGH
4. STATUS: VALID / WATCHLIST / REJECT
5. KEY READS (3-5 poin tajam: trend, volume, momentum, flow)
6. WARNINGS (red flag: overextended, fake volume, lawan trend, liquidity trap)
7. ACTION PLAN ringkas

Jangan kasih price prediction. Fokus ke probabilitas setup.`,

  risk: `${HEDGE_FUND_VOICE}

Tugas lu: risk manager. Validasi & refine entry/stop/target dari calculator.

Output WAJIB:
1. ENTRY ZONE (range realistis, bukan 1 angka kaku)
2. STOP LOSS (jelaskan kenapa di level itu — di bawah support / ATR-based)
3. TP1 dan TP2 (jelaskan logika)
4. RISK REWARD (RR1 & RR2)
5. POSITION SIZING (lot, max loss, % dari modal)
6. VERDICT: ACCEPT / ADJUST / REJECT
   - REJECT kalau RR < 1.5 atau stop terlalu jauh
   - ADJUST kasih saran level yang lebih sehat

Selalu prioritaskan capital preservation.`,

  context: `${HEDGE_FUND_VOICE}

Tugas lu: macro & market context analyst untuk IDX.

Analisis:
- Apakah IHSG dalam fase risk-on, risk-off, atau transisi
- Foreign flow (inflow / outflow / netral)
- Pengaruh US market (S&P, Nasdaq, Dow)
- Komoditas relevan (CPO, batu bara, nikel, minyak)
- USD/IDR & rate trend
- Sektor leading vs lagging
- Potensi fake rally / sector rotation

Output WAJIB:
1. MARKET REGIME: AGGRESSIVE / NORMAL / DEFENSIVE
2. RISK STANCE: RISK-ON / NEUTRAL / RISK-OFF
3. SECTOR TAKE (leader vs laggard)
4. FLOW READ
5. KEY RISKS hari ini / minggu ini
6. STRATEGY BIAS (boleh aggressive trade, atau wajib defensive)`,

  decision: `${HEDGE_FUND_VOICE}

Tugas lu: final decision engine. Lu gabungkan technical, volume, momentum, market context, dan risk management jadi 1 verdict.

Output WAJIB:
1. FINAL DECISION: BUY NOW / WAIT / WATCHLIST / REJECT
2. CONFIDENCE SCORE (0-100)
3. SUCCESS PROBABILITY (estimasi kasar, jelaskan dasarnya)
4. KEY EDGE (kenapa ini high probability)
5. KEY RISK (kenapa bisa gagal)
6. BULLISH SCENARIO (kondisi & target)
7. BEARISH SCENARIO (invalidation level)
8. EXECUTION NOTES (intraday vs swing, urgency)

Jangan ragu kasih REJECT kalau setup tidak layak — lebih baik miss daripada loss.`,

  journal: `${HEDGE_FUND_VOICE}

Tugas lu: trading coach yang evaluasi trade setelah selesai.

Evaluasi:
- Apakah entry optimal atau telat / kepagian
- Apakah stop loss terlalu sempit / terlalu lebar
- Apakah exit terlalu cepat (cut profit) atau telat (held loser)
- Apakah ada FOMO, revenge trade, gambling
- Apakah trade-nya bagus tapi unlucky (bad outcome ≠ bad decision)

Output WAJIB:
1. TRADE QUALITY SCORE (0-100)
2. EXECUTION SCORE (0-100)
3. EMOTIONAL DISCIPLINE SCORE (0-100)
4. WHAT WENT RIGHT
5. WHAT WENT WRONG
6. BEHAVIORAL FLAGS (FOMO / revenge / impatience / overconfidence / none)
7. LESSONS LEARNED (3 poin actionable)
8. NEXT TIME CHECKLIST (hal konkret yang harus dicek sebelum entry serupa)`,
};

function fmtField(label: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return `- ${label}: (kosong)`;
  return `- ${label}: ${value}`;
}

export function buildScannerUserPrompt(
  input: ScannerInput,
  score?: SetupScoreBreakdown,
): string {
  const lines = [
    `Analisis setup teknikal saham IDX berikut:`,
    ``,
    `### MARKET DATA`,
    fmtField("Ticker", input.ticker.toUpperCase()),
    fmtField("Current Price", input.currentPrice),
    fmtField("Open / High / Low / Prev Close", `${input.open} / ${input.high} / ${input.low} / ${input.previousClose}`),
    fmtField("Today Volume", input.todayVolume),
    fmtField("Average Volume 20D", input.avgVolume20d),
    ``,
    `### TECHNICAL`,
    fmtField("EMA20 / EMA50 / EMA200", `${input.ema20} / ${input.ema50} / ${input.ema200}`),
    fmtField("VWAP", input.vwap),
    fmtField("RSI", input.rsi),
    fmtField("MACD", input.macd),
    fmtField("Stochastic", input.stochastic),
    fmtField("Support / Resistance", `${input.support} / ${input.resistance}`),
    ``,
    `### FLOW & CONTEXT`,
    fmtField("Foreign Flow", input.foreignFlow),
    fmtField("Broker Accumulation", input.brokerAccumulation),
    fmtField("IHSG Trend", input.ihsgTrend),
    fmtField("Sector Strength", input.sectorStrength),
  ];

  if (score) {
    lines.push(
      ``,
      `### PRECOMPUTED SCORE (boleh di-override kalau perlu)`,
      `- Total: ${score.total}/100 (trend ${score.trend} | momentum ${score.momentum} | volume ${score.volume} | context ${score.context} | RR ${score.rrQuality})`,
      `- Confidence: ${score.confidence}`,
      `- Status: ${score.status}`,
    );
  }

  lines.push(``, `Berikan analisis sesuai format yang ditentukan.`);
  return lines.join("\n");
}

export function buildRiskUserPrompt(
  input: RiskInput,
  calc: RiskCalcResult | null,
): string {
  const lines = [
    `Validasi & refine plan risk management berikut untuk swing/daytrade IDX:`,
    ``,
    `### TRADE`,
    fmtField("Ticker", input.ticker.toUpperCase()),
    fmtField("Current Price", input.currentPrice),
    fmtField("Support", input.support),
    fmtField("Resistance", input.resistance),
    fmtField("ATR", input.atr),
    fmtField("Trading Capital (Rp)", input.capital),
    fmtField("Risk Per Trade (%)", input.riskPerTrade),
  ];

  if (calc) {
    lines.push(
      ``,
      `### CALCULATED PLAN (refinement boleh)`,
      `- Entry: ${calc.entry.toFixed(0)}`,
      `- Stop Loss: ${calc.stopLoss.toFixed(0)} (downside ${calc.downsidePct.toFixed(2)}%)`,
      `- TP1: ${calc.takeProfit1.toFixed(0)} (upside ${calc.upsidePct1.toFixed(2)}%, RR ${calc.riskReward1.toFixed(2)})`,
      `- TP2: ${calc.takeProfit2.toFixed(0)} (upside ${calc.upsidePct2.toFixed(2)}%, RR ${calc.riskReward2.toFixed(2)})`,
      `- Position: ${calc.lots} lot (${calc.shares} shares), nilai posisi Rp ${calc.positionValue.toLocaleString("id-ID")}`,
      `- Max Loss: Rp ${calc.maxLoss.toLocaleString("id-ID")}`,
    );
  }

  lines.push(``, `Berikan verdict ACCEPT / ADJUST / REJECT dengan reasoning konkret.`);
  return lines.join("\n");
}

export function buildContextUserPrompt(input: ContextInput): string {
  return [
    `Analisis kondisi market & sector untuk decision-making swing trade IDX hari ini:`,
    ``,
    fmtField("IHSG Trend", input.ihsgTrend),
    fmtField("Foreign Flow IHSG", input.foreignFlow),
    fmtField("US Market", input.usMarket),
    fmtField("Commodity Trend", input.commodityTrend),
    fmtField("Interest Rate Trend", input.interestRate),
    fmtField("USD/IDR", input.usdIdr),
    fmtField("Sector", input.sector),
    fmtField("Sector Strength", input.sectorStrength),
    ``,
    `Tentukan market regime, risk stance, sector take, flow read, key risks, strategy bias.`,
  ].join("\n");
}

export function buildDecisionUserPrompt(input: DecisionInput): string {
  return [
    `Final decision check untuk trade IDX berikut:`,
    ``,
    fmtField("Ticker", input.ticker.toUpperCase()),
    fmtField("Setup Score", input.setupScore),
    fmtField("Confidence", input.confidence),
    fmtField("Trend", input.trend),
    fmtField("Volume", input.volume),
    fmtField("Momentum", input.momentum),
    fmtField("Market Context", input.marketContext),
    fmtField("Risk Reward", input.riskReward),
    fmtField("Entry / Stop / Target", `${input.entry} / ${input.stopLoss} / ${input.target}`),
    ``,
    `Berikan FINAL DECISION (BUY NOW / WAIT / WATCHLIST / REJECT) plus reasoning lengkap.`,
  ].join("\n");
}

export function buildJournalUserPrompt(input: JournalInput): string {
  return [
    `Evaluasi trade yang sudah selesai berikut. Lu coach gua, jujur dan to the point:`,
    ``,
    fmtField("Ticker", input.ticker.toUpperCase()),
    fmtField("Entry", input.entry),
    fmtField("Exit", input.exit),
    fmtField("Stop Loss", input.stopLoss),
    fmtField("Target", input.target),
    fmtField("Result (P/L %)", input.result),
    fmtField("Holding Time", input.holdingTime),
    fmtField("Entry Reason", input.entryReason),
    fmtField("Market Condition", input.marketCondition),
    fmtField("Emotion", input.emotion),
    ``,
    `Berikan trade quality score, execution score, emotional discipline score, dan lessons learned.`,
  ].join("\n");
}

export function buildPrompt<M extends ModuleKey>(
  module: M,
  payload: PromptPayload[M],
): { system: string; user: string } {
  const system = SYSTEM_PROMPTS[module];
  let user = "";
  switch (module) {
    case "scanner":
      user = buildScannerUserPrompt(
        (payload as PromptPayload["scanner"]).input,
        (payload as PromptPayload["scanner"]).score,
      );
      break;
    case "risk":
      user = buildRiskUserPrompt(
        (payload as PromptPayload["risk"]).input,
        (payload as PromptPayload["risk"]).calc,
      );
      break;
    case "context":
      user = buildContextUserPrompt(payload as ContextInput);
      break;
    case "decision":
      user = buildDecisionUserPrompt(payload as DecisionInput);
      break;
    case "journal":
      user = buildJournalUserPrompt(payload as JournalInput);
      break;
  }
  return { system, user };
}

export interface PromptPayload {
  scanner: { input: ScannerInput; score?: SetupScoreBreakdown };
  risk: { input: RiskInput; calc: RiskCalcResult | null };
  context: ContextInput;
  decision: DecisionInput;
  journal: JournalInput;
}
