"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Metric } from "@/components/shared";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { AnalysisPipeline } from "@/pipeline/types";
import type { BadgeTone } from "@/features/trading/types";
import {
  exportFullBrief,
  exportAIReadyPrompt,
} from "@/lib/export";
import { CollapsibleSection } from "@/components/pipeline-viewer/collapsible-section";
import {
  AnalystAgreementMeter,
  ConfidenceHeatmap,
  ConflictIndicator,
} from "@/components/pipeline-viewer/analyst-metrics";
import {
  formatNullable,
  formatPercent,
} from "@/components/pipeline-viewer/formatters";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Brain,
  Shield,
  Target,
  Copy,
  Download,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Eye,
  MessageSquare,
  Layers,
} from "lucide-react";

interface PipelineViewerProps {
  pipeline: AnalysisPipeline;
  onAnalyzeWithAI?: (prompt: string) => void;
}

// MAIN PIPELINE VIEWER
// ============================================================================

export function PipelineViewer({ pipeline, onAnalyzeWithAI }: PipelineViewerProps) {
  const {
    scanner,
    risk,
    context,
    decision,
    finalScore,
    fundamental,
    marketData,
    indicators,
    analystReports,
    debateMatrix,
    thesis,
    portfolioDecision,
    newsIntelligence,
    socialSentiment,
    macroContext,
    riskGovernor,
  } = pipeline;

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportText, setExportText] = useState("");
  const [exportTitle, setExportTitle] = useState("");

  const handleExportBrief = () => {
    setExportText(exportFullBrief(pipeline));
    setExportTitle("Institutional Brief");
    setShowExportModal(true);
  };

  const handleCopyBrief = async () => {
    if (!pipeline) return;
    await navigator.clipboard.writeText(exportFullBrief(pipeline));
  };

  const handleAnalyzeWithAI = () => {
    if (onAnalyzeWithAI) {
      onAnalyzeWithAI(exportAIReadyPrompt(pipeline));
    }
  };

  const verdictColor: Record<string, BadgeTone> = {
    BUY_NOW: "emerald",
    WAIT: "blue",
    WATCHLIST: "amber",
    REJECT: "red",
    NO_TRADE: "red",
  };

  const regimeColor: Record<string, BadgeTone> = {
    AGGRESSIVE: "emerald",
    NORMAL: "blue",
    DEFENSIVE: "amber",
  };

  const actionColor: Record<string, BadgeTone> = {
    APPROVED: "emerald",
    WATCHLIST: "amber",
    REJECTED: "red",
    REDUCE_SIZE: "violet",
  };

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════ */}
      {/* KESIMPULAN — Ringkasan Utama */}
      {/* ═══════════════════════════════════════════════ */}
      <Card className="border-2 border-zinc-700/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${
              portfolioDecision.action === "APPROVED"
                ? "bg-emerald-500/15 text-emerald-400"
                : portfolioDecision.action === "WATCHLIST"
                ? "bg-amber-500/15 text-amber-400"
                : portfolioDecision.action === "REDUCE_SIZE"
                ? "bg-violet-500/15 text-violet-400"
                : "bg-red-500/15 text-red-400"
            }`}>
              {portfolioDecision.action === "APPROVED" ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : portfolioDecision.action === "WATCHLIST" ? (
                <Eye className="h-7 w-7" />
              ) : (
                <AlertTriangle className="h-7 w-7" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Kesimpulan</span>
                <Badge
                  tone={actionColor[portfolioDecision.action] ?? "neutral"}
                  className="text-xs px-2 py-0.5"
                >
                  {portfolioDecision.action}
                </Badge>
              </div>
              <h3 className="text-base font-semibold text-zinc-100 mb-1">
                {portfolioDecision.action === "APPROVED" && (
                  <>Setup <span className="text-emerald-400">{decision.finalDecision}</span> untuk {pipeline.ticker}</>
                )}
                {portfolioDecision.action === "WATCHLIST" && (
                  <><span className="text-amber-400">Masukkan ke Watchlist</span> — belum ideal untuk entry</>
                )}
                {portfolioDecision.action === "REDUCE_SIZE" && (
                  <><span className="text-violet-400">Setup valid tapi kurangi size</span> karena risiko tinggi</>
                )}
                {portfolioDecision.action === "REJECTED" && (
                  <><span className="text-red-400">Setup ditolak</span> — tidak memenuhi kriteria</>
                )}
              </h3>
              <p className="text-sm text-zinc-400 mb-3">
                {thesis.executiveSummary}
              </p>

              {/* Key metrics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div>
                  <span className="text-zinc-500">Score</span>
                  <div className={`font-mono font-bold text-base ${
                    finalScore >= 70 ? "text-emerald-400" :
                    finalScore >= 50 ? "text-amber-400" : "text-red-400"
                  }`}>{finalScore}/100</div>
                </div>
                <div>
                  <span className="text-zinc-500">Conviction</span>
                  <div className="font-mono font-bold text-base text-zinc-200">{portfolioDecision.conviction}/100</div>
                </div>
                <div>
                  <span className="text-zinc-500">Risk/Reward</span>
                  <div className="font-mono font-bold text-base text-zinc-200">1:{risk.rr1.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Regime</span>
                  <div>
                    <Badge tone={regimeColor[context.marketRegime]} className="text-[10px]">
                      {context.marketRegime}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Action summary */}
              {portfolioDecision.action === "APPROVED" && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                  <strong>Entry:</strong> {risk.entryZone} &nbsp;|&nbsp;
                  <strong>SL:</strong> {risk.stopLoss} &nbsp;|&nbsp;
                  <strong>TP1:</strong> {risk.tp1} &nbsp;|&nbsp;
                  <strong>TP2:</strong> {risk.tp2} &nbsp;|&nbsp;
                  <strong>Size:</strong> {risk.positionSize.lots} lots ({risk.positionSize.shares} shares) &nbsp;|&nbsp;
                  <strong>Max Loss:</strong> {formatCurrency(risk.positionSize.maxLoss)}
                </div>
              )}

              {portfolioDecision.action === "REJECTED" && portfolioDecision.reasoning.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {portfolioDecision.reasoning.slice(0, 3).map((r, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`border ${
        riskGovernor.entryAllowed
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      }`}>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                <Shield className="h-3.5 w-3.5" />
                Daily Capital Guard
                <Badge tone={riskGovernor.entryAllowed ? "emerald" : "amber"} className="text-[10px]">
                  {riskGovernor.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                {riskGovernor.entryAllowed
                  ? "Entry is allowed by the daily guard, with reduced risk sizing enforced."
                  : `No trade state: ${riskGovernor.noTradeReason ?? "one or more guard gates failed"}.`}
              </p>
              {riskGovernor.notes.length > 0 && (
                <div className="mt-2 text-xs text-zinc-500">
                  {riskGovernor.notes.slice(0, 2).join(" ")}
                </div>
              )}
            </div>

            <div className="grid flex-1 grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <Metric label="Mode" value={riskGovernor.mode.toUpperCase()} />
              <Metric label="Daily P&L" value={`${riskGovernor.realizedPct.toFixed(2)}%`} />
              <Metric label="Trades" value={`${riskGovernor.tradesTaken}/${riskGovernor.maxTrades}`} />
              <Metric label="Risk/Trade" value={`${riskGovernor.effectiveRiskPerTrade.toFixed(2)}%`} />
              <Metric label="Risk Left" value={formatCurrency(riskGovernor.remainingDailyRisk)} />
            </div>
          </div>

          {riskGovernor.gates.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {riskGovernor.gates.map((gate) => (
                <span
                  key={gate.label}
                  className={`rounded border px-2 py-1 text-[10px] ${
                    gate.passed
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/20 bg-red-500/10 text-red-300"
                  }`}
                >
                  {gate.label}: {gate.reason}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════ */}
      {/* HEADER: Portfolio Decision + Final Score */}
      {/* ═══════════════════════════════════════════════ */}
      <Card className="border-2 border-zinc-800/80 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Portfolio Decision
              </div>
              <div className="mt-1 flex items-center gap-3">
                <Badge
                  tone={actionColor[portfolioDecision.action] ?? "neutral"}
                  className="text-sm px-3 py-1"
                >
                  {portfolioDecision.action}
                </Badge>
                <span className="text-xs text-zinc-500">
                  Recommended Risk: {portfolioDecision.recommendedRiskPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-zinc-500">Verdict</span>
              <div>
                <Badge tone={verdictColor[decision.finalDecision]}>
                  {decision.finalDecision}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-zinc-500">Urgency</span>
              <div className="font-semibold text-zinc-200 capitalize">
                {decision.urgency}
              </div>
            </div>
            <div>
              <span className="text-zinc-500">Risk Level</span>
              <div className="font-semibold text-zinc-200">{decision.riskLevel}</div>
            </div>
            <div>
              <span className="text-zinc-500">Success Prob.</span>
              <div className="font-mono font-semibold text-zinc-200">{decision.successProbability}%</div>
            </div>
          </div>

          {/* Portfolio reasoning */}
          {portfolioDecision.reasoning.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800/50">
              <div className="text-[10px] text-zinc-500 mb-1">Portfolio Reasoning</div>
              <div className="flex flex-wrap gap-1.5">
                {portfolioDecision.reasoning.map((r, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/60 text-zinc-300"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════ */}
      {/* MARKET REGIME BADGE + MACRO CONTEXT */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Market Intelligence"
        icon={<BarChart3 className="h-4 w-4" />}
        badge={context.marketRegime}
        badgeTone={regimeColor[context.marketRegime]}
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <Metric label="Regime" value={context.marketRegime} />
          <Metric label="Risk Stance" value={context.riskStance} />
          <Metric label="Strategy Bias" value={context.strategyBias} />
        </div>

        {macroContext && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <Metric label="Volatility" value={macroContext.volatilityState} />
            <Metric label="Liquidity" value={macroContext.liquidityCondition} />
            <Metric label="Global Cue" value={macroContext.globalCue} />
          </div>
        )}

        {/* Social Sentiment */}
        <div className="mt-3 pt-3 border-t border-zinc-800/50">
          <div className="text-xs text-zinc-400 mb-2">Social Sentiment</div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-500">Sentiment Score</span>
                <span className={`font-mono font-semibold ${
                  socialSentiment.score > 0.1 ? "text-emerald-400" :
                  socialSentiment.score < -0.1 ? "text-red-400" : "text-zinc-300"
                }`}>{socialSentiment.score.toFixed(2)}</span>
              </div>
              <Progress
                value={Math.round((socialSentiment.score + 1) * 50)}
                tone={socialSentiment.score > 0.1 ? "emerald" : socialSentiment.score < -0.1 ? "red" : "blue"}
                className="h-1.5"
              />
            </div>
            <div className="text-[10px] text-zinc-500">
              <span className="text-emerald-400">+{(socialSentiment.positiveRatio * 100).toFixed(0)}%</span>
              {" / "}
              <span className="text-red-400">-{(socialSentiment.negativeRatio * 100).toFixed(0)}%</span>
              {" / "}
              <span className="text-zinc-400">={(socialSentiment.neutralRatio * 100).toFixed(0)}%</span>
            </div>
          </div>
          {socialSentiment.topKeywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {socialSentiment.topKeywords.map((kw, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* News Intelligence */}
        {newsIntelligence.totalArticles > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-zinc-400">
                News: {newsIntelligence.totalArticles} articles
              </span>
              <Badge
                tone={
                  newsIntelligence.dominantSentiment === "positive"
                    ? "emerald"
                    : newsIntelligence.dominantSentiment === "negative"
                    ? "red"
                    : "neutral"
                }
              >
                {newsIntelligence.dominantSentiment}
              </Badge>
            </div>
            {newsIntelligence.recentHeadlines.slice(0, 3).map((h, i) => (
              <div key={i} className="text-[11px] text-zinc-400 py-0.5 truncate">
                • {h}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* ANALYST REPORTS + CONFIDENCE HEATMAP */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Analyst Team"
        icon={<Brain className="h-4 w-4" />}
        badge={`${analystReports.length} analysts`}
        badgeTone="blue"
        defaultOpen={false}
      >
        <div className="mb-4">
          <AnalystAgreementMeter reports={analystReports} />
        </div>
        <ConfidenceHeatmap reports={analystReports} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* INSTITUTIONAL THESIS */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Institutional Thesis"
        icon={<Layers className="h-4 w-4" />}
        badge={`Conviction: ${thesis.conviction}`}
        badgeTone={thesis.conviction >= 60 ? "emerald" : thesis.conviction >= 40 ? "amber" : "red"}
        defaultOpen={false}
      >
        <div className="text-xs text-zinc-300 mb-3">{thesis.executiveSummary}</div>

        {thesis.technicalThesis.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-zinc-500 mb-1">Technical Thesis</div>
            {thesis.technicalThesis.map((t, i) => (
              <div key={i} className="text-xs text-zinc-300 py-0.5">{t}</div>
            ))}
          </div>
        )}

        {thesis.fundamentalThesis.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-zinc-500 mb-1">Fundamental Thesis</div>
            {thesis.fundamentalThesis.map((t, i) => (
              <div key={i} className="text-xs text-zinc-300 py-0.5">{t}</div>
            ))}
          </div>
        )}

        {thesis.sentimentThesis.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-zinc-500 mb-1">Sentiment Thesis</div>
            {thesis.sentimentThesis.map((t, i) => (
              <div key={i} className="text-xs text-zinc-300 py-0.5">{t}</div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-zinc-800/50">
          <div>
            <div className="text-[10px] text-emerald-400 mb-1">Opportunities</div>
            {thesis.opportunities.map((o, i) => (
              <div key={i} className="text-xs text-emerald-300/80 py-0.5">✓ {o}</div>
            ))}
          </div>
          <div>
            <div className="text-[10px] text-red-400 mb-1">Risks</div>
            {thesis.risks.map((r, i) => (
              <div key={i} className="text-xs text-red-300/80 py-0.5">✗ {r}</div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* BULL VS BEAR DEBATE */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Research Debate"
        icon={<MessageSquare className="h-4 w-4" />}
        badge={debateMatrix.dominantBias}
        badgeTone={
          debateMatrix.dominantBias === "bullish"
            ? "emerald"
            : debateMatrix.dominantBias === "bearish"
            ? "red"
            : "neutral"
        }
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Consensus</div>
            <div className="text-lg font-bold text-zinc-100">
              {debateMatrix.consensusScore}/100
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Conflict</div>
            <ConflictIndicator conflictScore={debateMatrix.conflictScore} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-emerald-400 mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Bull Case
            </div>
            {debateMatrix.bullCase.length > 0 ? (
              debateMatrix.bullCase.slice(0, 5).map((b, i) => (
                <div key={i} className="text-xs text-zinc-300 py-0.5">✓ {b}</div>
              ))
            ) : (
              <div className="text-xs text-zinc-500">No bull case identified</div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-red-400 mb-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Bear Case
            </div>
            {debateMatrix.bearCase.length > 0 ? (
              debateMatrix.bearCase.slice(0, 5).map((b, i) => (
                <div key={i} className="text-xs text-zinc-300 py-0.5">✗ {b}</div>
              ))
            ) : (
              <div className="text-xs text-zinc-500">No bear case identified</div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* SCANNER + TECHNICAL */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Scanner — Technical Setup"
        icon={<Target className="h-4 w-4" />}
        badge={scanner.setupType}
        badgeTone={scanner.status === "VALID" ? "emerald" : scanner.status === "WATCHLIST" ? "amber" : "red"}
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Metric label="Setup Score" value={`${scanner.setupScore}/100`} />
          <Metric label="Status" value={scanner.status} />
          <Metric label="Confidence" value={scanner.confidence} />
          <Metric label="Trend" value={indicators.trend} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Price</span>
            <div className="text-xs text-zinc-300">
              C:{formatCurrency(marketData.currentPrice)} | O:{formatCurrency(marketData.open)} | H:{formatCurrency(marketData.high)} | L:{formatCurrency(marketData.low)}
            </div>
            <div className="text-xs text-zinc-300">
              Prev: {formatCurrency(marketData.previousClose)} | Vol: {formatNumber(marketData.todayVolume)}
            </div>
          </div>
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Indicators</span>
            <div className="text-xs text-zinc-300">
              EMA20: {formatCurrency(indicators.ema20)} | EMA50: {formatCurrency(indicators.ema50)}
            </div>
            <div className="text-xs text-zinc-300">
              RSI: {formatNullable(indicators.rsi, 1)} | VWAP: {formatCurrency(indicators.vwap)}
            </div>
            <div className="text-xs text-zinc-300">
              MACD: {indicators.macd.label} | Stoch: {indicators.stochastic.label}
            </div>
          </div>
        </div>

        {scanner.warnings.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-red-400 block mb-1">Warnings</span>
            {scanner.warnings.map((w, i) => (
              <div key={i} className="text-xs text-red-300 py-0.5">⚠ {w}</div>
            ))}
          </div>
        )}

        <div className="mt-2">
          <span className="text-xs text-zinc-500 block mb-1">Action Plan</span>
          <p className="text-xs text-zinc-300">{scanner.actionPlan}</p>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* RISK MANAGEMENT */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title={`Risk Management — ${risk.ticker.replace(".JK", "")}`}
        icon={<Shield className="h-4 w-4" />}
        badge={risk.verdict}
        badgeTone={risk.verdict === "ACCEPT" ? "emerald" : risk.verdict === "ADJUST" ? "amber" : "red"}
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Metric label="Ticker Price" value={formatCurrency(risk.currentPrice)} />
          <Metric label="Support" value={formatCurrency(risk.support)} />
          <Metric label="Resistance" value={formatCurrency(risk.resistance)} />
          <Metric label="Risk Budget" value={formatCurrency(risk.riskBudget)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Metric label="Entry Zone" value={risk.entryZone} />
          <Metric label="Stop Loss" value={formatCurrency(Number(risk.stopLoss))} />
          <Metric label="TP1" value={formatCurrency(Number(risk.tp1))} />
          <Metric label="TP2" value={formatCurrency(Number(risk.tp2))} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Metric label="RR (TP1)" value={risk.rr1.toFixed(2)} />
          <Metric label="RR (TP2)" value={risk.rr2.toFixed(2)} />
          <Metric label="Lots" value={risk.positionSize.lots.toString()} />
          <Metric label="Max Loss" value={formatCurrency(risk.positionSize.maxLoss)} />
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          <span className="text-zinc-500">Sizing: </span>
          {formatCurrency(risk.capital)} capital x {risk.riskPerTrade.toFixed(2)}% risk.{" "}
          <span className="text-zinc-500">Stop: </span>{risk.stopReason}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* FUNDAMENTAL */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Fundamental Context"
        icon={<BarChart3 className="h-4 w-4" />}
        badge={fundamental ? "Yahoo Finance" : "Unavailable"}
        badgeTone={fundamental ? "blue" : "amber"}
        defaultOpen={false}
      >
        {fundamental ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Metric label="PER (Trailing)" value={formatNullable(fundamental.per) + "x"} />
            <Metric label="PBV" value={formatNullable(fundamental.pbv) + "x"} />
            <Metric label="ROE" value={formatPercent(fundamental.roe)} />
            <Metric label="DER" value={formatNullable(fundamental.der)} />
            <Metric label="EPS Growth" value={formatPercent(fundamental.earningsGrowth)} />
            <Metric label="Div Yield" value={formatPercent(fundamental.dividendYield)} />
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
            Fundamental data is not available from Yahoo Finance for this ticker. The pipeline keeps this as a data-health warning and does not invent valuation numbers.
          </div>
        )}
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* DECISION DETAIL */}
      {/* ═══════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Decision Detail"
        icon={<Eye className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <Metric label="Verdict" value={decision.finalDecision} />
          <Metric label="Success Prob." value={`${decision.successProbability}%`} />
          <Metric label="Risk Level" value={decision.riskLevel} />
        </div>
        <div className="mb-2">
          <span className="text-xs text-emerald-400 block mb-1">Key Edge</span>
          <p className="text-xs text-zinc-300">{decision.keyEdge}</p>
        </div>
        <div className="mb-2">
          <span className="text-xs text-red-400 block mb-1">Key Risk</span>
          <p className="text-xs text-zinc-300">{decision.keyRisk}</p>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════ */}
      {/* EXPORT BUTTONS (bottom-right) */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          onClick={handleCopyBrief}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
        >
          <Copy className="h-3 w-3" /> Copy Brief
        </button>
        <button
          onClick={handleExportBrief}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
        >
          <Download className="h-3 w-3" /> Export Brief
        </button>
        {onAnalyzeWithAI && (
          <button
            onClick={handleAnalyzeWithAI}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            <Sparkles className="h-3 w-3" /> Analyze With AI
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* EXPORT MODAL */}
      {/* ═══════════════════════════════════════════════ */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col gap-4 border border-zinc-800">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-semibold">{exportTitle} — {pipeline.ticker}</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <textarea
              value={exportText}
              readOnly
              className="flex-1 bg-black/40 text-green-300 font-mono text-xs p-4 rounded-lg resize-none min-h-[400px] border border-white/10"
            />

            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(exportText)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
              >
                <Copy className="h-3 w-3 inline mr-1" /> Copy
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([exportText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${pipeline.ticker}-${exportTitle.toLowerCase().replace(/\s/g, "-")}-${Date.now()}.txt`;
                  a.click();
                }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium"
              >
                <Download className="h-3 w-3 inline mr-1" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
