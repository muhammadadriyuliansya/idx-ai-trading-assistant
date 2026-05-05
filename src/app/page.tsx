/**
 * Main Page - Unified Analysis Flow
 *
 * This is the ONLY entry point for analysis.
 * User flow:
 * 1. Enter ticker and capital
 * 2. Click "Analyze"
 * 3. See full analysis instantly
 *
 * No manual input needed. No disconnected modules.
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Zap, Copy, Download, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import {
  runFullAnalysis,
  type AnalysisResult,
  type AnalysisInput,
} from "@/lib/orchestrator";
import {
  ScannerDisplay,
  RiskDisplay,
  ContextDisplay,
  DecisionDisplay,
} from "@/components/displays";
import { useLocalStorage } from "@/lib/storage";
import { FormattedNumberInput } from "@/components/formatted-input";

const STORAGE_KEYS = {
  settings: "idxai.settings",
  lastTicker: "idxai.last.ticker",
  lastCapital: "idxai.last.capital",
  lastRisk: "idxai.last.risk",
} as const;

export default function HomePage() {
  const [ticker, setTicker] = useLocalStorage(STORAGE_KEYS.lastTicker, "");
  const [capital, setCapital] = useLocalStorage(STORAGE_KEYS.lastCapital, "10000000");
  const [riskPerTrade, setRiskPerTrade] = useLocalStorage(STORAGE_KEYS.lastRisk, "1");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportText, setExportText] = useState("");
  const [exportTitle, setExportTitle] = useState("");

  const handleAnalyze = async () => {
    const trimmedTicker = ticker.trim().toUpperCase();
    if (!trimmedTicker) {
      setError("Please enter a ticker");
      return;
    }

    const capitalNum = Number(capital);
    const riskNum = Number(riskPerTrade);

    if (!Number.isFinite(capitalNum) || capitalNum <= 0) {
      setError("Please enter a valid capital amount");
      return;
    }

    if (!Number.isFinite(riskNum) || riskNum <= 0 || riskNum > 10) {
      setError("Risk per trade must be between 0.1% and 10%");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const input: AnalysisInput = {
        ticker: trimmedTicker,
        capital: capitalNum,
        riskPerTrade: riskNum,
      };

      const result = await runFullAnalysis(input);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  IDX AI Trading Assistant
                </h1>
                <p className="text-[11px] text-zinc-500">
                  Unified analysis pipeline · One click, full picture
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Input Section */}
        <Card className="mb-8 border-blue-500/15 bg-blue-500/5">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                <Sparkles className="h-3 w-3" /> Quick Analysis
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ticker">Ticker</Label>
                <Input
                  id="ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="BBRI"
                  autoComplete="off"
                  spellCheck={false}
                  className="uppercase"
                />
              </div>

              <FormattedNumberInput
                id="capital"
                label="Trading Capital (Rp)"
                value={capital}
                onChange={setCapital}
                onKeyDown={handleKeyDown}
                placeholder="10000000"
              />

              <div className="space-y-1.5">
                <Label htmlFor="risk">Risk Per Trade (%)</Label>
                <Input
                  id="risk"
                  type="number"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="1"
                  inputMode="decimal"
                  step="0.1"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-[10px] text-zinc-500">
                Press Enter or click Analyze to run full analysis
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={loading || !ticker.trim()}
                size="lg"
                className="min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <Card className="border-emerald-500/15 bg-emerald-500/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Analysis Result
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {analysis.ticker}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Verdict
                    </div>
                    <div
                      className={`mt-1 text-2xl font-bold ${
                        analysis.decision.verdict === "BUY_NOW"
                          ? "text-emerald-300"
                          : analysis.decision.verdict === "WAIT"
                          ? "text-amber-300"
                          : analysis.decision.verdict === "WATCHLIST"
                          ? "text-blue-300"
                          : "text-red-300"
                      }`}
                    >
                      {analysis.decision.verdict.replace("_", " ")}
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Setup Score
                    </div>
                    <div className="mt-1 font-semibold">
                      {analysis.summary.score}/100
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Confidence
                    </div>
                    <div className="mt-1 font-semibold">
                      {analysis.summary.confidence}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Risk Reward
                    </div>
                    <div className="mt-1 font-semibold">
                      1:{analysis.risk.rr.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Market Regime
                    </div>
                    <div className="mt-1 font-semibold">
                      {analysis.context.regime}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Module Displays */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ScannerDisplay analysis={analysis} />
              <RiskDisplay analysis={analysis} />
              <ContextDisplay analysis={analysis} />
              <DecisionDisplay analysis={analysis} />
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* KESIMPULAN — Ringkasan Utama + Export */}
            {/* ═══════════════════════════════════════════════ */}
            <Card className="border-2 border-zinc-700/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${
                    analysis.decision.verdict === "BUY_NOW"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : analysis.decision.verdict === "WATCHLIST"
                      ? "bg-amber-500/15 text-amber-400"
                      : analysis.decision.verdict === "WAIT"
                      ? "bg-blue-500/15 text-blue-400"
                      : "bg-red-500/15 text-red-400"
                  }`}>
                    {analysis.decision.verdict === "BUY_NOW" ? (
                      <CheckCircle2 className="h-7 w-7" />
                    ) : analysis.decision.verdict === "WATCHLIST" ? (
                      <Eye className="h-7 w-7" />
                    ) : analysis.decision.verdict === "WAIT" ? (
                      <Sparkles className="h-7 w-7" />
                    ) : (
                      <AlertTriangle className="h-7 w-7" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">Kesimpulan</span>
                      <Badge
                        className={`text-xs px-2 py-0.5 ${
                          analysis.decision.verdict === "BUY_NOW"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : analysis.decision.verdict === "WATCHLIST"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : analysis.decision.verdict === "WAIT"
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                            : "bg-red-500/20 text-red-300 border-red-500/30"
                        }`}
                      >
                        {analysis.decision.verdict.replace("_", " ")}
                      </Badge>
                    </div>

                    {/* Verdict text */}
                    <h3 className="text-base font-semibold text-zinc-100 mb-2">
                      {analysis.decision.verdict === "BUY_NOW" && (
                        <>Setup <span className="text-emerald-400">BUY NOW</span> untuk {analysis.ticker}</>
                      )}
                      {analysis.decision.verdict === "WATCHLIST" && (
                        <><span className="text-amber-400">Masukkan ke Watchlist</span> — pantau entry yang lebih baik</>
                      )}
                      {analysis.decision.verdict === "WAIT" && (
                        <><span className="text-blue-400">Tunggu</span> — belum ada sinyal yang jelas</>
                      )}
                      {analysis.decision.verdict === "REJECT" && (
                        <><span className="text-red-400">Setup ditolak</span> — tidak memenuhi kriteria</>
                      )}
                    </h3>

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-zinc-500">Score</span>
                        <div className={`font-mono font-bold text-base ${
                          analysis.summary.score >= 70 ? "text-emerald-400" :
                          analysis.summary.score >= 50 ? "text-amber-400" : "text-red-400"
                        }`}>{analysis.summary.score}/100</div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Confidence</span>
                        <div className="font-mono font-bold text-base text-zinc-200">{analysis.summary.confidence}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Risk/Reward</span>
                        <div className="font-mono font-bold text-base text-zinc-200">1:{analysis.risk.rr.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Regime</span>
                        <div className="font-mono font-bold text-base text-zinc-200">{analysis.context.regime}</div>
                      </div>
                    </div>

                    {/* Entry details (if BUY_NOW or WATCHLIST) */}
                    {analysis.risk.calc && (analysis.decision.verdict === "BUY_NOW" || analysis.decision.verdict === "WATCHLIST") && (
                      <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/50 p-3 text-xs text-zinc-300 mb-3">
                        <strong>Entry:</strong> {analysis.risk.calc.entry.toFixed(0)} &nbsp;|&nbsp;
                        <strong>SL:</strong> {analysis.risk.calc.stopLoss.toFixed(0)} &nbsp;|&nbsp;
                        <strong>TP1:</strong> {analysis.risk.calc.takeProfit1.toFixed(0)} &nbsp;|&nbsp;
                        <strong>TP2:</strong> {analysis.risk.calc.takeProfit2.toFixed(0)} &nbsp;|&nbsp;
                        <strong>Size:</strong> {analysis.risk.calc.lots} lots
                      </div>
                    )}

                    {/* Reasoning */}
                    {analysis.decision.reasoning && (
                      <p className="text-sm text-zinc-400 mb-3">{analysis.decision.reasoning}</p>
                    )}

                    {/* Export buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/50">
                      <button
                        onClick={() => {
                          const lines: string[] = [];
                          const a = analysis;
                          lines.push("=".repeat(50));
                          lines.push(`IDX TRADING BRIEF: ${a.ticker}`);
                          lines.push(`Generated: ${new Date().toLocaleDateString("id-ID")}`);
                          lines.push("=".repeat(50));
                          lines.push("");
                          lines.push(`Verdict    : ${a.decision.verdict.replace("_", " ")}`);
                          lines.push(`Score      : ${a.summary.score}/100`);
                          lines.push(`Confidence : ${a.summary.confidence}`);
                          lines.push(`RR         : 1:${a.risk.rr.toFixed(2)}`);
                          lines.push(`Regime     : ${a.context.regime}`);
                          lines.push("");
                          lines.push("--- TECHNICAL ---");
                          lines.push(`Trend  : ${a.scanner.trend}`);
                          lines.push(`Score  : ${a.scanner.setupScore.total}/100`);
                          lines.push(`Status : ${a.scanner.setupScore.status}`);
                          lines.push("");
                          if (a.risk.calc) {
                            lines.push("--- RISK PLAN ---");
                            lines.push(`Entry    : ${a.risk.calc.entry.toFixed(0)}`);
                            lines.push(`Stop Loss: ${a.risk.calc.stopLoss.toFixed(0)}`);
                            lines.push(`TP1      : ${a.risk.calc.takeProfit1.toFixed(0)} (RR: ${a.risk.calc.riskReward1.toFixed(2)})`);
                            lines.push(`TP2      : ${a.risk.calc.takeProfit2.toFixed(0)} (RR: ${a.risk.calc.riskReward2.toFixed(2)})`);
                            lines.push(`Lots     : ${a.risk.calc.lots}`);
                            lines.push(`Max Loss : Rp ${a.risk.calc.maxLoss.toLocaleString("id-ID")}`);
                            lines.push("");
                          }
                           lines.push("--- CONTEXT ---");
                           lines.push(`Regime     : ${a.context.regime}`);
                           if (a.context.ihsgChange1d != null) lines.push(`IHSG 1d  : ${a.context.ihsgChange1d.toFixed(2)}%`);
                           if (a.context.ihsgChange5d != null) lines.push(`IHSG 5d  : ${a.context.ihsgChange5d.toFixed(2)}%`);
                           lines.push("");
                           lines.push("--- REASONING ---");
                           lines.push(a.decision.reasoning || "-");
                           lines.push("=".repeat(50));
                           const text = lines.join("\n");
                           navigator.clipboard.writeText(text);
                         }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        <Copy className="h-3 w-3" /> Copy Brief
                      </button>
                      <button
                        onClick={() => {
                          const lines: string[] = [];
                          const a = analysis;
                          lines.push("=".repeat(50));
                          lines.push(`IDX TRADING BRIEF: ${a.ticker}`);
                          lines.push(`Generated: ${new Date().toLocaleDateString("id-ID")}`);
                          lines.push("=".repeat(50));
                          lines.push("");
                          lines.push(`Verdict    : ${a.decision.verdict.replace("_", " ")}`);
                          lines.push(`Score      : ${a.summary.score}/100`);
                          lines.push(`Confidence : ${a.summary.confidence}`);
                          lines.push(`RR         : 1:${a.risk.rr.toFixed(2)}`);
                          lines.push(`Regime     : ${a.context.regime}`);
                          lines.push("");
                          lines.push("--- TECHNICAL ---");
                          lines.push(`Trend  : ${a.scanner.trend}`);
                          lines.push(`Score  : ${a.scanner.setupScore.total}/100`);
                          lines.push(`Status : ${a.scanner.setupScore.status}`);
                          lines.push("");
                          if (a.risk.calc) {
                            lines.push("--- RISK PLAN ---");
                            lines.push(`Entry    : ${a.risk.calc.entry.toFixed(0)}`);
                            lines.push(`Stop Loss: ${a.risk.calc.stopLoss.toFixed(0)}`);
                            lines.push(`TP1      : ${a.risk.calc.takeProfit1.toFixed(0)}`);
                            lines.push(`TP2      : ${a.risk.calc.takeProfit2.toFixed(0)}`);
                            lines.push(`Lots     : ${a.risk.calc.lots}`);
                            lines.push(`Max Loss : Rp ${a.risk.calc.maxLoss.toLocaleString("id-ID")}`);
                            lines.push("");
                          }
                           lines.push("--- CONTEXT ---");
                           lines.push(`Regime     : ${a.context.regime}`);
                           if (a.context.ihsgChange1d != null) lines.push(`IHSG 1d  : ${a.context.ihsgChange1d.toFixed(2)}%`);
                           if (a.context.ihsgChange5d != null) lines.push(`IHSG 5d  : ${a.context.ihsgChange5d.toFixed(2)}%`);
                           lines.push("");
                           lines.push("--- REASONING ---");
                           lines.push(a.decision.reasoning || "-");
                           lines.push("=".repeat(50));
                           const text = lines.join("\n");
                           setExportText(text);
                          setExportTitle("Trading Brief");
                          setShowExportModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        <Download className="h-3 w-3" /> Export Brief
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty State */}
        {!analysis && !loading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold">Ready to Analyze</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Enter a ticker above and click Analyze to get the full picture
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
