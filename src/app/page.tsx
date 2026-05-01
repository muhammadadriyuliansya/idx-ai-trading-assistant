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
import { Loader2, Sparkles, Zap } from "lucide-react";
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
  JournalDisplay,
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

            <JournalDisplay />
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
