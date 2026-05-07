"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { runFullAnalysis } from "@/pipeline/orchestrator";
import type { AnalysisPipeline } from "@/pipeline/types";

type TimeFrame = "1D" | "1W" | "1M";

interface TimeframeData {
  timeframe: TimeFrame;
  analysis: AnalysisPipeline | null;
  loading: boolean;
  error: string | null;
}

export function MultiTimeframeTab() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<Record<TimeFrame, TimeframeData>>({
    "1D": { timeframe: "1D", analysis: null, loading: false, error: null },
    "1W": { timeframe: "1W", analysis: null, loading: false, error: null },
    "1M": { timeframe: "1M", analysis: null, loading: false, error: null },
  });
  const [analyzingAll, setAnalyzingAll] = useState(false);

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
          error: err instanceof Error ? err.message : "Failed" 
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
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Analyze All Timeframes
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
              <div className="text-xs text-zinc-500">Timeframes</div>
            </CardContent>
          </Card>
          <Card className="border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{summary.avgScore.toFixed(0)}</div>
              <div className="text-xs text-zinc-500">Avg Score</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/10">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{summary.buyCount}</div>
              <div className="text-xs text-zinc-500">BUY Signals</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/10">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{summary.watchCount}</div>
              <div className="text-xs text-zinc-500">WATCHLIST</div>
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
                    <span className="font-semibold">{tf}</span>
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
                        {tfData.analysis.decision.finalDecision}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-zinc-500">Price</div>
                        <div className="font-mono">{formatCurrency(tfData.analysis.marketData.currentPrice)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Score</div>
                        <div className="font-mono font-bold text-blue-400">{tfData.analysis.finalScore}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">RR</div>
                        <div className="font-mono text-emerald-400">1:{tfData.analysis.risk.rr1.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Trend</div>
                        <div className="flex items-center gap-1">
                          {tfData.analysis.indicators.trend === "bullish" ? (
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                          ) : tfData.analysis.indicators.trend === "bearish" ? (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          ) : null}
                          <span>{tfData.analysis.indicators.trend}</span>
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
                    <div className="mt-2 text-sm">Run analysis to see {tf} data</div>
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
            <h3 className="mb-3 font-semibold">Multi-Timeframe Analysis Summary</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(data).map(([tf, d]) => (
                <div key={tf} className="flex items-center justify-between">
                  <span className="font-mono">{tf}</span>
                  <div className="flex items-center gap-4">
                    <span>Score: {d.analysis?.finalScore}</span>
                    <Badge tone={d.analysis!.decision.finalDecision === "BUY_NOW" ? "emerald" : d.analysis!.decision.finalDecision === "WATCHLIST" ? "amber" : "red"}>
                      {d.analysis!.decision.finalDecision}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
