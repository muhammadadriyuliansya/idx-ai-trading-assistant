"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { runFullAnalysis } from "@/pipeline/orchestrator";
import type { AnalysisPipeline } from "@/pipeline/types";
import { useLocalStorage } from "@/lib/storage";
import { STORAGE_KEYS, DEFAULT_AI_SETTINGS } from "@/config/app";
import type { AISettings } from "@/lib/types";

type TimeFrame = "1D" | "1W" | "1M";

interface TimeframeData {
  timeframe: TimeFrame;
  analysis: AnalysisPipeline | null;
  loading: boolean;
  error: string | null;
}

// Label Bahasa Indonesia untuk komponen multi-timeframe
const decisionLabels: Record<string, string> = {
  BUY_NOW: "Beli Sekarang",
  WAIT: "Tunggu",
  WATCHLIST: "Pantauan",
  REJECT: "Lewati",
  NO_TRADE: "Tidak Trade",
};

const trendLabels: Record<string, string> = {
  bullish: "Naik",
  bearish: "Turun",
  sideways: "Mendatar",
};

const timeframeLabels: Record<TimeFrame, string> = {
  "1D": "Harian",
  "1W": "Mingguan",
  "1M": "Bulanan",
};

export function MultiTimeframeTab() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<Record<TimeFrame, TimeframeData>>({
    "1D": { timeframe: "1D", analysis: null, loading: false, error: null },
    "1W": { timeframe: "1W", analysis: null, loading: false, error: null },
    "1M": { timeframe: "1M", analysis: null, loading: false, error: null },
  });
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [aiSettings] = useLocalStorage<AISettings>(
    STORAGE_KEYS.aiSettings,
    DEFAULT_AI_SETTINGS,
  );
  const [synthesis, setSynthesis] = useState<string>("");
  const [synthesisLoading, setSynthesisLoading] = useState(false);

  const analyzeTimeframe = async (tf: TimeFrame) => {
    if (!ticker.trim()) return;
    
    setData(prev => ({
      ...prev,
      [tf]: { ...prev[tf], loading: true, error: null }
    }));

    try {
      const symbol = ticker.trim().toUpperCase().includes(".JK")
        ? ticker.trim().toUpperCase()
        : `${ticker.trim().toUpperCase()}.JK`;

      const result = await runFullAnalysis(symbol, {
        capital: 10000000,
        riskPerTrade: 1,
      });

      setData(prev => ({
        ...prev,
        [tf]: { ...prev[tf], analysis: result, loading: false }
      }));
    } catch (err) {
      setData(prev => ({
        ...prev,
        [tf]: { 
          ...prev[tf], 
          loading: false, 
          error: err instanceof Error ? err.message : "Gagal mengambil data" 
        }
      }));
    }
  };

  const analyzeAll = async () => {
    setAnalyzingAll(true);
    await Promise.all([
      analyzeTimeframe("1D"),
      analyzeTimeframe("1W"),
      analyzeTimeframe("1M"),
    ]);
    setAnalyzingAll(false);
  };

  const getSummary = () => {
    const results = Object.values(data).filter(d => d.analysis);
    if (results.length === 0) return null;

    const scores = results.map(d => d.analysis!.finalScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const buyCount = results.filter(d => d.analysis!.decision.finalDecision === "BUY_NOW").length;
    const watchCount = results.filter(d => d.analysis!.decision.finalDecision === "WATCHLIST").length;

    return { avgScore, buyCount, watchCount, results: results.length };
  };

  const summary = getSummary();

  const synthesisEnabled =
    aiSettings.aiEnabled &&
    aiSettings.features.multiTfSynthesis &&
    summary !== null &&
    summary.results === 3;

  // Auto-sintesis saat 3 TF selesai analisa + fitur aktif.
  useEffect(() => {
    if (!synthesisEnabled) {
      const clearHandle = setTimeout(() => setSynthesis(""), 0);
      return () => clearTimeout(clearHandle);
    }

    const entries: TimeFrame[] = ["1D", "1W", "1M"];
    const summaries = entries
      .map((tf) => {
        const a = data[tf].analysis;
        if (!a) return null;
        return {
          label:
            tf === "1D"
              ? "Harian (1D)"
              : tf === "1W"
                ? "Mingguan (1W)"
                : "Bulanan (1M)",
          score: a.finalScore,
          decision: a.decision.finalDecision,
          trend: a.indicators.trend,
          rsi: a.indicators.rsi,
          volumeRatio: a.indicators.volumeRatio,
        };
      })
      .filter(Boolean) as Array<{
        label: string;
        score: number;
        decision: string;
        trend: string;
        rsi: number;
        volumeRatio: number;
      }>;

    if (summaries.length < 3) return;

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setSynthesisLoading(true);
      try {
        const model =
          aiSettings.provider === "ollama"
            ? aiSettings.ollamaModel
            : aiSettings.provider === "openai"
              ? aiSettings.openaiModel
              : aiSettings.anthropicModel;
        const res = await fetch("/api/ai/timeframe-synthesis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: ticker.trim().toUpperCase(),
            summaries,
            provider: aiSettings.provider,
            model,
            apiKey:
              aiSettings.provider === "openai"
                ? aiSettings.openaiKey
                : aiSettings.provider === "anthropic"
                  ? aiSettings.anthropicKey
                  : undefined,
            baseUrl:
              aiSettings.provider === "ollama" && aiSettings.ollamaBaseUrl
                ? aiSettings.ollamaBaseUrl
                : undefined,
          }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { synthesis?: string };
        if (!cancelled && json.synthesis) setSynthesis(json.synthesis);
      } catch {
        // silent
      } finally {
        if (!cancelled) setSynthesisLoading(false);
      }
    };

    const timer = setTimeout(() => {
      void run();
    }, 0);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    synthesisEnabled,
    ticker,
    data,
    aiSettings.provider,
    aiSettings.ollamaModel,
    aiSettings.openaiModel,
    aiSettings.anthropicModel,
    aiSettings.ollamaBaseUrl,
    aiSettings.openaiKey,
    aiSettings.anthropicKey,
  ]);

  return (
    <div className="space-y-6">
      {/* Input */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Label>Ticker</Label>
              <Input
                placeholder="BBRI, TLKM, GOTO..."
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && analyzeAll()}
                className="font-mono text-lg"
              />
            </div>
            <Button
              onClick={analyzeAll}
              disabled={!ticker.trim() || analyzingAll}
              className="w-full sm:w-auto"
            >
              {analyzingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menganalisa...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Analisa Semua Timeframe
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{summary.results}/3</div>
              <div className="text-xs text-zinc-500">Timeframe selesai</div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{summary.avgScore.toFixed(0)}</div>
              <div className="text-xs text-zinc-500">Rata-rata Skor</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/10">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{summary.buyCount}</div>
              <div className="text-xs text-zinc-500">Sinyal Beli</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/10">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{summary.watchCount}</div>
              <div className="text-xs text-zinc-500">Pantauan</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeframe Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["1D", "1W", "1M"] as TimeFrame[]).map((tf) => {
          const tfData = data[tf];
          return (
            <Card key={tf} className="border-zinc-800">
              <CardContent className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    <span className="font-semibold">{timeframeLabels[tf]}</span>
                    <span className="text-xs text-zinc-500">({tf})</span>
                  </div>
                  {tfData.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>

                {tfData.error && (
                  <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">
                    {tfData.error}
                  </div>
                )}

                {tfData.analysis && !tfData.loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xl font-bold">
                        {tfData.analysis.ticker.replace(".JK", "")}
                      </span>
                      <Badge tone={
                        tfData.analysis.decision.finalDecision === "BUY_NOW" ? "emerald" :
                        tfData.analysis.decision.finalDecision === "WATCHLIST" ? "amber" : "red"
                      }>
                        {decisionLabels[tfData.analysis.decision.finalDecision] ?? tfData.analysis.decision.finalDecision}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-zinc-500">Harga</div>
                        <div className="font-mono">{formatCurrency(tfData.analysis.marketData.currentPrice)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500" title="Skor setup 0-100">Skor</div>
                        <div className="font-mono font-bold text-blue-400">{tfData.analysis.finalScore}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500" title="Risk/Reward ratio">RR</div>
                        <div className="font-mono text-emerald-400">1:{tfData.analysis.risk.rr1.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Tren</div>
                        <div className="flex items-center gap-1">
                          {tfData.analysis.indicators.trend === "bullish" ? (
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                          ) : tfData.analysis.indicators.trend === "bearish" ? (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          ) : null}
                          <span>{trendLabels[tfData.analysis.indicators.trend] ?? tfData.analysis.indicators.trend}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500">
                      Vol: {tfData.analysis.indicators.volumeRatio.toFixed(2)}x | RSI: {tfData.analysis.indicators.rsi.toFixed(1)}
                    </div>
                  </motion.div>
                )}

                {!tfData.analysis && !tfData.loading && !tfData.error && (
                  <div className="py-4 text-center text-zinc-500">
                    <AlertCircle className="mx-auto h-8 w-8 opacity-30" />
                    <div className="mt-2 text-sm">Jalankan analisa untuk melihat data {timeframeLabels[tf]}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Comparison */}
      {summary && summary.results === 3 && (
        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold">Rangkuman Multi-Timeframe</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(data).map(([tf, d]) => (
                <div key={tf} className="flex items-center justify-between">
                  <span className="font-mono">{timeframeLabels[tf as TimeFrame]} ({tf})</span>
                  <div className="flex items-center gap-4">
                    <span>Skor: {d.analysis?.finalScore}</span>
                    <Badge tone={d.analysis!.decision.finalDecision === "BUY_NOW" ? "emerald" : d.analysis!.decision.finalDecision === "WATCHLIST" ? "amber" : "red"}>
                      {decisionLabels[d.analysis!.decision.finalDecision] ?? d.analysis!.decision.finalDecision}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* AI synthesis (opsional) */}
            {synthesisEnabled && synthesis && (
              <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-100">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-wider text-blue-300">
                  <Sparkles className="h-3 w-3" />
                  Sintesis AI
                </div>
                <pre className="whitespace-pre-wrap font-sans">{synthesis}</pre>
              </div>
            )}
            {synthesisEnabled && synthesisLoading && !synthesis && (
              <div className="mt-4 flex items-center gap-2 text-xs italic text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI lagi menggabungkan hasil 3 timeframe...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
