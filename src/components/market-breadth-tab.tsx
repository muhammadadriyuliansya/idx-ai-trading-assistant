"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Loader2,
  ArrowUp,
  ArrowDown,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runFullAnalysis } from "@/pipeline/orchestrator";
import type { AnalysisPipeline } from "@/pipeline/types";
import { mapWithConcurrency } from "@/lib/concurrency";

interface SectorData {
  name: string;
  tickers: string[];
  analysis: Map<string, AnalysisPipeline>;
  advanceCount: number;
  declineCount: number;
}

// Label Bahasa Indonesia
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

const IDX_SECTORS = [
  { name: "Keuangan", tickers: ["BBRI", "BMRI", "BDMN", "BNGA", "BTN"] },
  { name: "Infrastruktur", tickers: ["TLKM", "EXCL", "ISAT", "FREN"] },
  { name: "Konsumer", tickers: ["UNVR", "ICBP", "INDF", "KLBF", "WIIM"] },
  { name: "Tambang", tickers: ["ANTM", "INCO", "PTBA", "TINS"] },
  { name: "Properti", tickers: ["BSDE", "PWON", "CTRA", "LAND"] },
];

export function MarketBreadthTab() {
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [ihsgAnalysis, setIhsgAnalysis] = useState<AnalysisPipeline | null>(null);

  const analyzeMarket = async () => {
    setLoading(true);

    try {
      // Analyze IHSG first (its data will also warm the server cache)
      const ihsg = await runFullAnalysis("^JKSE", { capital: 10000000, riskPerTrade: 1 });
      setIhsgAnalysis(ihsg);

      // Analyze each sector's tickers with bounded concurrency — previously
      // this ran purely sequentially (5 tickers x 5 sectors = 25 sync calls).
      const sectorResults: SectorData[] = await Promise.all(
        IDX_SECTORS.map(async (sector) => {
          const analysisMap = new Map<string, AnalysisPipeline>();
          let advance = 0;
          let decline = 0;

          const settled = await mapWithConcurrency(
            sector.tickers,
            4,
            (ticker) =>
              runFullAnalysis(ticker, { capital: 10000000, riskPerTrade: 1 }),
          );

          sector.tickers.forEach((ticker, i) => {
            const result = settled[i];
            if (result.status === "fulfilled") {
              const analysis = result.value;
              analysisMap.set(ticker, analysis);
              if (analysis.decision.finalDecision === "BUY_NOW") advance++;
              else if (analysis.decision.finalDecision === "REJECT") decline++;
            }
          });

          return {
            name: sector.name,
            tickers: sector.tickers,
            analysis: analysisMap,
            advanceCount: advance,
            declineCount: decline,
          };
        }),
      );

      setSectors(sectorResults);
    } catch (err) {
      console.error("Market breadth analysis failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate market breadth
  const totalStocks = sectors.reduce((sum, s) => sum + s.analysis.size, 0);
  const totalAdvance = sectors.reduce((sum, s) => sum + s.advanceCount, 0);
  const totalDecline = sectors.reduce((sum, s) => sum + s.declineCount, 0);
  const advanceDeclineRatio = totalDecline > 0 ? totalAdvance / totalDecline : totalAdvance;

  const getMarketBreadth = (): string => {
    if (totalAdvance > totalDecline * 1.5) return "Sangat Bullish";
    if (totalAdvance > totalDecline) return "Bullish";
    if (totalDecline > totalAdvance * 1.5) return "Sangat Bearish";
    if (totalDecline > totalAdvance) return "Bearish";
    return "Netral";
  };

  const getBreadthTone = (): "emerald" | "blue" | "amber" | "red" => {
    const ratio = advanceDeclineRatio;
    if (ratio >= 1.5) return "emerald";
    if (ratio >= 1) return "blue";
    if (ratio >= 0.5) return "amber";
    return "red";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Kondisi Pasar Keseluruhan</h2>
              <p className="text-sm text-zinc-500">
                Analisa performa per sektor dan rasio saham naik vs turun
              </p>
            </div>
            <Button onClick={analyzeMarket} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menganalisa...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  Mulai Analisa
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* IHSG Overview */}
      {ihsgAnalysis && (
        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-bold">IHSG (^JKSE)</span>
                  <Badge tone={ihsgAnalysis.indicators.trend === "bullish" ? "emerald" : ihsgAnalysis.indicators.trend === "bearish" ? "red" : "amber"}>
                    {trendLabels[ihsgAnalysis.indicators.trend] ?? ihsgAnalysis.indicators.trend}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  Skor: {ihsgAnalysis.finalScore} | RSI: {ihsgAnalysis.indicators.rsi.toFixed(1)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-500">Volume</div>
                <div className="font-mono text-lg">
                  {ihsgAnalysis.indicators.volumeRatio.toFixed(2)}x
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breadth Summary */}
      {sectors.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{totalStocks}</div>
                <div className="text-xs text-zinc-500">Total Saham</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/10">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-emerald-400">
                  <ArrowUp className="h-5 w-5" />
                  {totalAdvance}
                </div>
                <div className="text-xs text-zinc-500">Sinyal Beli</div>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-red-500/10">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-red-400">
                  <ArrowDown className="h-5 w-5" />
                  {totalDecline}
                </div>
                <div className="text-xs text-zinc-500">Dilewati</div>
              </CardContent>
            </Card>
            <Card className={`border-${getBreadthTone()}-500/20`}>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold text-${getBreadthTone()}-400`} title="Rasio saham naik dibanding saham turun">
                  {advanceDeclineRatio.toFixed(2)}
                </div>
                <div className="text-xs text-zinc-500">Rasio Naik/Turun</div>
                <Badge tone={getBreadthTone()} className="mt-1">
                  {getMarketBreadth()}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Sector Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold">Rincian per Sektor</h3>
            {sectors.map((sector) => {
              const sectorAdvance = sector.advanceCount;
              const sectorDecline = sector.declineCount;
              const sectorRatio = sectorDecline > 0 ? sectorAdvance / sectorDecline : sectorAdvance;

              return (
                <Card key={sector.name} className="border-zinc-800">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-blue-400" />
                        <span className="font-semibold">{sector.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-400" title="Saham dengan sinyal beli">↑ {sectorAdvance}</span>
                        <span className="text-red-400" title="Saham yang dilewati">↓ {sectorDecline}</span>
                        <Badge tone={sectorRatio >= 1 ? "emerald" : sectorRatio >= 0.5 ? "amber" : "red"}>
                          {sectorRatio.toFixed(2)}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {sector.tickers.map((ticker) => {
                        const analysis = sector.analysis.get(ticker);
                        if (!analysis) return null;

                        return (
                          <motion.div
                            key={ticker}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="rounded bg-zinc-900/50 p-2 text-center"
                          >
                            <div className="font-mono text-sm font-bold">{ticker}</div>
                            <Badge 
                              tone={
                                analysis.decision.finalDecision === "BUY_NOW" ? "emerald" :
                                analysis.decision.finalDecision === "WATCHLIST" ? "amber" : "red"
                              }
                              className="mt-1 text-xs"
                            >
                              {decisionLabels[analysis.decision.finalDecision] ?? analysis.decision.finalDecision}
                            </Badge>
                            <div className="mt-1 text-xs text-zinc-500">
                              {analysis.finalScore}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && sectors.length === 0 && (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-8">
            <div className="text-center text-zinc-500">
              <BarChart3 className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-4 font-medium">Belum ada analisa kondisi pasar</div>
              <div className="mt-2 text-sm">Klik &quot;Mulai Analisa&quot; untuk memulai</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
