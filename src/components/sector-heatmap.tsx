"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ScanCandidate } from "@/pipeline/types";

const SECTOR_MAP: Record<string, string[]> = {
  Perbankan: ["BBRI", "BBCA", "BMRI", "BBNI", "BTPS"],
  Consumer: ["INDF", "ICBP", "UNVR", "GGRM", "HMSP"],
  Teknologi: ["TLKM", "EXCL", "ISAT", "FREN", "BRIS"],
  Energi: ["ADRO", "PGAS", "PGEO", "MEDC", "TPIA"],
  Infrastruktur: ["JSMR", "WIKA", "WSKT", "ADHI", "PTPP"],
  Tambang: ["ANTM", "ITMG", "PTBA", "TINS", "MDKA"],
  Properti: ["BSDE", "LPKR", "ASRI", "PWON", "CTRA"],
  Industrial: ["UNTR", "INTP", "AUTO", "GJTL", "SMMT"],
};

interface SectorHeatmapProps {
  scanResults: ScanCandidate[];
}

export function SectorHeatmap({ scanResults }: SectorHeatmapProps) {
  const sectors = useMemo(() => {
    return Object.entries(SECTOR_MAP).map(([name, tickers]) => {
      const hits = tickers.map((t) => {
        const found = scanResults.find(
          (s) => s.ticker.replace(".JK", "") === t
        );
        if (!found) return null;
        const change =
          ((found.marketData.currentPrice - found.marketData.previousClose) /
            found.marketData.previousClose) *
          100;
        return {
          ticker: t,
          change: Number(change.toFixed(2)),
          score: found.setupScore,
          status: found.status,
        };
      }).filter(Boolean) as { ticker: string; change: number; score: number; status: string }[];

      const avgChange =
        hits.length > 0
          ? hits.reduce((s, h) => s + h.change, 0) / hits.length
          : 0;
      const validCount = hits.filter((h) => h.status === "VALID").length;

      return { name, hits, avgChange: Number(avgChange.toFixed(2)), validCount };
    });
  }, [scanResults]);

  const toneForChange = (change: number): string => {
    if (change >= 2) return "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30";
    if (change >= 0.5) return "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20";
    if (change >= -0.5) return "bg-zinc-900 text-zinc-400 ring-zinc-800";
    if (change >= -2) return "bg-red-500/10 text-red-400 ring-red-500/20";
    return "bg-red-500/20 text-red-300 ring-red-500/30";
  };

  const cellTone = (change: number): string => {
    if (change >= 2) return "text-emerald-400";
    if (change >= 0.5) return "text-emerald-500";
    if (change >= -0.5) return "text-zinc-500";
    if (change >= -2) return "text-red-500";
    return "text-red-400";
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sectors.map((sector) => (
        <Card key={sector.name} className="bg-zinc-950/60">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {sector.name}
              </span>
              <span
                className={`text-xs font-bold tabular-nums ${cellTone(sector.avgChange)}`}
              >
                {sector.avgChange > 0 ? "+" : ""}
                {sector.avgChange}%
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {sector.hits.map((h) => (
                <span
                  key={h.ticker}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium ring-1 ${toneForChange(h.change)}`}
                >
                  {h.ticker}
                  <span className="opacity-70">
                    {h.change > 0 ? "+" : ""}
                    {h.change}%
                  </span>
                </span>
              ))}
            </div>
            {sector.validCount > 0 && (
              <div className="mt-1.5 text-[9px] text-emerald-500/70">
                {sector.validCount} kandidat
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
