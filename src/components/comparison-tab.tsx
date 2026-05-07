"use client";

import { useState } from "react";
import {
  GitCompare,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runFullAnalysis } from "@/pipeline/orchestrator";
import type { AnalysisPipeline } from "@/pipeline/types";
import { formatCurrency } from "@/lib/utils";

interface StockData {
  ticker: string;
  analysis: AnalysisPipeline | null;
  loading: boolean;
  error: string | null;
}

export function ComparisonTab() {
  const [tickers, setTickers] = useState<string[]>(["", "", ""]);
  const [stocks, setStocks] = useState<Record<number, StockData>>({
    0: { ticker: "", analysis: null, loading: false, error: null },
    1: { ticker: "", analysis: null, loading: false, error: null },
    2: { ticker: "", analysis: null, loading: false, error: null },
  });

  const analyzeStock = async (index: number) => {
    const ticker = tickers[index].trim();
    if (!ticker) return;

    setStocks(prev => ({
      ...prev,
      [index]: { ...prev[index], loading: true, error: null }
    }));

    try {
      const symbol = ticker.toUpperCase().includes(".JK")
        ? ticker.toUpperCase()
        : `${ticker.toUpperCase()}.JK`;

      const result = await runFullAnalysis(symbol, {
        capital: 10000000,
        riskPerTrade: 1,
      });

      setStocks(prev => ({
        ...prev,
        [index]: { ticker, analysis: result, loading: false, error: null }
      }));
    } catch (err) {
setStocks(prev => ({
      ...prev,
      [index]: { 
        ticker, 
        analysis: null,
        loading: false, 
        error: err instanceof Error ? err.message : "Failed" 
      }
    }));
    }
  };

  const updateTicker = (index: number, value: string) => {
    const newTickers = [...tickers];
    newTickers[index] = value.toUpperCase();
    setTickers(newTickers);
  };

  const validStocks = Object.values(stocks).filter(s => s.analysis);
  const getWinner = (key: "currentPrice" | "score" | "rr"): number => {
    if (!validStocks.length) return -1;
    
    const values = validStocks
      .map(s => {
        if (key === "score") return s.analysis!.finalScore;
        if (key === "rr") return s.analysis!.risk.rr1;
        return s.analysis!.marketData.currentPrice;
      })
      .filter(v => typeof v === "number" && !isNaN(v));
    
    if (!values.length) return -1;
    return values.indexOf(Math.max(...values));
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-blue-400" />
            <h3 className="font-semibold">Compare Stocks</h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            {tickers.map((t, i) => (
              <div key={i}>
                <Label>Stock {i + 1}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="BBRI"
                    value={t}
                    onChange={(e) => updateTicker(i, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && analyzeStock(i)}
                    className="font-mono"
                  />
                  <Button
                    onClick={() => analyzeStock(i)}
                    disabled={!t.trim() || stocks[i].loading}
                    size="icon"
                  >
                    {stocks[i].loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BarChart3 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {validStocks.length > 0 && (
        <>
          {/* Comparison Table */}
          <Card className="border-zinc-800">
            <CardContent className="p-4">
              <h3 className="mb-4 font-semibold">Comparison Matrix</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="pb-2 text-left">Metric</th>
                      {validStocks.map((s, i) => (
                        <th key={i} className="pb-2 text-center">
                          <span className="font-mono text-blue-400">{s.analysis!.ticker.replace(".JK", "")}</span>
                          {getWinner("currentPrice") === i && (
                            <span className="ml-1 text-xs text-emerald-400">★</span>
                          )}
                        </th>
                      ))}
                      <th className="pb-2 text-center">Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-400">Price</td>
                      {validStocks.map((s, i) => (
                        <td key={i} className="py-2 text-center font-mono">
                          {formatCurrency(s.analysis!.marketData.currentPrice)}
                        </td>
                      ))}
                      <td className="py-2 text-center text-emerald-400">
                        {validStocks[getWinner("currentPrice")]?.analysis?.ticker.replace(".JK", "")}
                      </td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-400">Score</td>
                      {validStocks.map((s, i) => (
                        <td key={i} className={`py-2 text-center font-mono font-bold ${getWinner("score") === i ? "text-blue-400" : ""}`}>
                          {s.analysis!.finalScore}
                        </td>
                      ))}
                      <td className="py-2 text-center text-emerald-400">
                        {validStocks[getWinner("score")]?.analysis?.ticker.replace(".JK", "")}
                      </td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-400">Risk/Reward</td>
                      {validStocks.map((s, i) => (
                        <td key={i} className={`py-2 text-center font-mono ${getWinner("rr") === i ? "text-emerald-400" : ""}`}>
                          1:{s.analysis!.risk.rr1.toFixed(2)}
                        </td>
                      ))}
                      <td className="py-2 text-center text-emerald-400">
                        {validStocks[getWinner("rr")]?.analysis?.ticker.replace(".JK", "")}
                      </td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-400">Trend</td>
                      {validStocks.map((s) => (
                        <td key={s.analysis!.ticker} className="py-2 text-center">
                          <span className={`flex items-center justify-center gap-1 ${s.analysis!.indicators.trend === "bullish" ? "text-emerald-400" : s.analysis!.indicators.trend === "bearish" ? "text-red-400" : "text-zinc-400"}`}>
                            {s.analysis!.indicators.trend === "bullish" && <TrendingUp className="h-4 w-4" />}
                            {s.analysis!.indicators.trend === "bearish" && <TrendingDown className="h-4 w-4" />}
                            {s.analysis!.indicators.trend}
                          </span>
                        </td>
                      ))}
                      <td className="py-2 text-center">-</td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-400">Volume</td>
                      {validStocks.map((s) => (
                        <td key={s.analysis!.ticker} className="py-2 text-center font-mono">
                          {s.analysis!.indicators.volumeRatio.toFixed(2)}x
                        </td>
                      ))}
                      <td className="py-2 text-center">-</td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-400">RSI</td>
                      {validStocks.map((s) => (
                        <td key={s.analysis!.ticker} className="py-2 text-center font-mono">
                          {s.analysis!.indicators.rsi.toFixed(1)}
                        </td>
                      ))}
                      <td className="py-2 text-center">-</td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-400">Decision</td>
                      {validStocks.map((s) => (
                        <td key={s.analysis!.ticker} className="py-2 text-center">
                          <Badge tone={
                            s.analysis!.decision.finalDecision === "BUY_NOW" ? "emerald" :
                            s.analysis!.decision.finalDecision === "WATCHLIST" ? "amber" : "red"
                          }>
                            {s.analysis!.decision.finalDecision}
                          </Badge>
                        </td>
                      ))}
                      <td className="py-2 text-center">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            {validStocks.map((s) => (
              <Card 
                key={s.analysis!.ticker}
                className={`border ${s.analysis!.decision.finalDecision === "BUY_NOW" ? "border-emerald-500/30" : "border-zinc-800"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-bold">
                      {s.analysis!.ticker.replace(".JK", "")}
                    </span>
                    <Badge tone={
                      s.analysis!.decision.finalDecision === "BUY_NOW" ? "emerald" :
                      s.analysis!.decision.finalDecision === "WATCHLIST" ? "amber" : "red"
                    }>
                      {s.analysis!.decision.finalDecision}
                    </Badge>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-zinc-500">Setup Score</div>
                      <div className="font-mono font-bold text-blue-400">
                        {s.analysis!.finalScore}/100
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Risk/Reward</div>
                      <div className="font-mono font-bold text-emerald-400">
                        1:{s.analysis!.risk.rr1.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Volume</div>
                      <div className="font-mono">
                        {s.analysis!.indicators.volumeRatio.toFixed(2)}x
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Trend</div>
                      <div className="font-mono">
                        {s.analysis!.indicators.trend}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {validStocks.length === 0 && (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-8">
            <div className="text-center text-zinc-500">
              <GitCompare className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-4 font-medium">Masukkan ticker untuk dibandingkan</div>
              <div className="mt-2 text-sm">Bandingkan sampai 3 saham sekaligus</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
