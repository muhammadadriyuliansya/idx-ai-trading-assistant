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
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runMarketScan, getDefaultIDXTickers } from "@/pipeline/scanner";
import type { ScanCandidate } from "@/pipeline/types";

interface SectorData {
  name: string;
  tickers: string[];
  results: Map<string, ScanCandidate>;
  validCount: number;
  watchCount: number;
  rejectCount: number;
}

const statusTone: Record<string, "emerald" | "amber" | "red"> = {
  VALID: "emerald",
  WATCHLIST: "amber",
  REJECT: "red",
};

const statusLabels: Record<string, string> = {
  VALID: "Beli",
  WATCHLIST: "Pantau",
  REJECT: "Lewati",
};

const trendLabels: Record<string, string> = {
  bullish: "Naik",
  bearish: "Turun",
  sideways: "Mendatar",
};

const IDX_SECTORS = [
  { name: "Keuangan", tickers: ["BBRI", "BMRI", "BBCA", "BBNI", "BTPS"] },
  { name: "Infrastruktur", tickers: ["TLKM", "EXCL", "ISAT", "FREN"] },
  { name: "Konsumer", tickers: ["UNVR", "ICBP", "INDF", "GGRM", "HMSP"] },
  { name: "Tambang", tickers: ["ANTM", "ADRO", "PTBA", "ITMG", "TINS"] },
  { name: "Properti", tickers: ["BSDE", "PWON", "CTRA", "LPKR", "ASRI"] },
];

export function MarketBreadthTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<SectorData[]>([]);

  const analyzeMarket = async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await runMarketScan({
        tickers: getDefaultIDXTickers(),
        mode: "swing",
        maxResults: 40,
      });

      const resultMap = new Map<string, ScanCandidate>();
      for (const r of results) {
        resultMap.set(r.ticker.replace(".JK", ""), r);
      }

      const sectorResults: SectorData[] = IDX_SECTORS.map((sector) => {
        let valid = 0;
        let watch = 0;
        let reject = 0;
        const sectorMap = new Map<string, ScanCandidate>();

        for (const t of sector.tickers) {
          const r = resultMap.get(t);
          if (!r) continue;
          sectorMap.set(t, r);
          if (r.status === "VALID") valid++;
          else if (r.status === "WATCHLIST") watch++;
          else reject++;
        }

        return {
          name: sector.name,
          tickers: sector.tickers,
          results: sectorMap,
          validCount: valid,
          watchCount: watch,
          rejectCount: reject,
        };
      });

      setSectors(sectorResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal scan pasar");
    } finally {
      setLoading(false);
    }
  };

  // Calculate market breadth
  const totalValid = sectors.reduce((sum, s) => sum + s.validCount, 0);
  const totalWatch = sectors.reduce((sum, s) => sum + s.watchCount, 0);
  const totalReject = sectors.reduce((sum, s) => sum + s.rejectCount, 0);
  const totalStocks = totalValid + totalWatch + totalReject;
  const validRatio = totalStocks > 0 ? totalValid / totalStocks : 0;
  const rejectRatio = totalStocks > 0 ? totalReject / totalStocks : 0;

  const getMarketBreadth = (): string => {
    if (validRatio >= 0.3) return "Kondisi Beli";
    if (validRatio >= 0.15) return "Selektif";
    if (rejectRatio >= 0.7) return "Hindari";
    return "Netral";
  };

  const getBreadthTone = (): "emerald" | "blue" | "amber" | "red" => {
    if (validRatio >= 0.3) return "emerald";
    if (validRatio >= 0.15) return "blue";
    if (rejectRatio >= 0.7) return "red";
    return "amber";
  };

  const breadthLabel = getMarketBreadth();
  const breadthTone = getBreadthTone();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Kondisi Pasar Keseluruhan</h2>
              <p className="text-sm text-zinc-500">
                Hasil scan {totalStocks || "semua"} saham IDX — lihat distribusi kandidat per sektor
              </p>
            </div>
            <div className="flex items-center gap-2">
              {sectors.length > 0 && (
                <Badge tone={breadthTone}>{breadthLabel}</Badge>
              )}
              <Button onClick={analyzeMarket} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    Scan Pasar
                  </>
                )}
              </Button>
            </div>
          </div>
          {error && (
            <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breadth Summary */}
      {sectors.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-zinc-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{totalStocks}</div>
                <div className="text-xs text-zinc-500">Terdeteksi</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/10">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                  {totalValid}
                </div>
                <div className="text-xs text-zinc-500">Siap Beli</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">{(validRatio * 100).toFixed(0)}% dari total</div>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/10">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-amber-400">
                  <Activity className="h-5 w-5" />
                  {totalWatch}
                </div>
                <div className="text-xs text-zinc-500">Pantauan</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">{totalStocks > 0 ? ((totalWatch / totalStocks) * 100).toFixed(0) : 0}% dari total</div>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-red-500/10">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-red-400">
                  <BarChart3 className="h-5 w-5" />
                  {totalReject}
                </div>
                <div className="text-xs text-zinc-500">Dilewati</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">{(rejectRatio * 100).toFixed(0)}% dari total</div>
              </CardContent>
            </Card>
          </div>

          {/* Sector Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold">Rincian per Sektor</h3>
            {sectors.map((sector) => {
              const sTotal = sector.validCount + sector.watchCount + sector.rejectCount;
              const sValidRatio = sTotal > 0 ? (sector.validCount / sTotal) * 100 : 0;

              return (
                <Card key={sector.name} className="border-zinc-800">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-blue-400" />
                        <span className="font-semibold">{sector.name}</span>
                        <span className="text-xs text-zinc-500">({sTotal})</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-400">{sector.validCount} beli</span>
                        <span className="text-amber-400">{sector.watchCount} pantau</span>
                        <span className="text-red-400">{sector.rejectCount} lewat</span>
                        <Badge tone={sValidRatio >= 20 ? "emerald" : sValidRatio >= 10 ? "amber" : "red"}>
                          {sValidRatio.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {sector.tickers.map((ticker) => {
                        const result = sector.results.get(ticker);

                        return (
                          <motion.div
                            key={ticker}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="rounded bg-zinc-900/50 p-2 text-center"
                          >
                            <div className="font-mono text-sm font-bold">{ticker}</div>
                            {result ? (
                              <>
                                <Badge tone={statusTone[result.status] ?? "red"} className="mt-1 text-xs">
                                  {statusLabels[result.status] ?? result.status}
                                </Badge>
                                <div className="mt-1 text-xs text-zinc-500">{result.setupScore}</div>
                              </>
                            ) : (
                              <div className="mt-1 text-[10px] text-zinc-600">N/A</div>
                            )}
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
              <div className="mt-4 font-medium">Belum ada data kondisi pasar</div>
              <div className="mt-2 text-sm">Klik &quot;Scan Pasar&quot; untuk melihat distribusi kandidat</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
