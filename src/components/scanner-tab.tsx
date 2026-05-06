"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Target,
  Zap,
  ChevronRight,
  Clock,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDefaultIDXTickers, runMarketScan } from "@/pipeline/scanner";
import type { ScanCandidate } from "@/pipeline/types";

type ScanMode = 'conservative' | 'swing' | 'day';
import { formatCurrency } from "@/lib/utils";

type BadgeTone = "neutral" | "blue" | "emerald" | "amber" | "red" | "violet";

interface ScannerTabProps {
  onAnalyze: (ticker: string) => void;
  isAnalyzing: boolean;
  defaultTickerCount: number;
  scanMode: ScanMode;
  onScanModeChange: (mode: ScanMode) => void;
  scanLoading: boolean;
  scanResults: ScanCandidate[];
  scanError: string | null;
  scanCompletedAt: number | null;
  showAppliedOnly: boolean;
  onShowAppliedOnlyChange: (show: boolean) => void;
  appliedCount: number;
}

const candidateTone: Record<ScanCandidate["status"], BadgeTone> = {
  VALID: "emerald",
  WATCHLIST: "amber",
  REJECT: "red",
};

const modeLabels: Record<ScanMode, string> = {
  swing: "Swing",
  day: "Day",
  conservative: "Conservative",
};

export function ScannerTab({
  onAnalyze,
  isAnalyzing,
  defaultTickerCount,
  scanMode,
  onScanModeChange,
  scanLoading,
  scanResults,
  scanError,
  scanCompletedAt,
  showAppliedOnly,
  onShowAppliedOnlyChange,
  appliedCount,
}: ScannerTabProps) {
  const [customTickers, setCustomTickers] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const handleScan = useCallback(async () => {
    // Scan akan di-trigger dari parent
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Market Scanner</h2>
          <p className="text-zinc-400">
            Scan {useCustom ? "custom tickers" : `${defaultTickerCount} IDX stocks`} untuk find best setups
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Selector */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
            {(["swing", "day", "conservative"] as ScanMode[]).map((mode) => (
              <Button
                key={mode}
                variant={scanMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => onScanModeChange(mode)}
                disabled={scanLoading}
              >
                {modeLabels[mode]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Ticker Input */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useCustom"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              />
              <Label htmlFor="useCustom" className="text-sm text-zinc-300">
                Use custom tickers
              </Label>
            </div>
            {useCustom && (
              <Input
                placeholder="BBRI, TLKM, GOTO, BMRI (comma separated)"
                value={customTickers}
                onChange={(e) => setCustomTickers(e.target.value.toUpperCase())}
                className="flex-1 font-mono text-sm"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scan Error */}
      {scanError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {scanError}
        </div>
      )}

      {/* Loading State */}
      {scanLoading && scanResults.length === 0 && (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-400" />
              <div className="mt-4 text-lg font-semibold">Scanning IDX Market</div>
              <div className="mt-2 text-sm text-zinc-500">
                Fetching data from Yahoo Finance dan analyzing setups...
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!scanLoading && scanResults.length > 0 && (
        <>
          {/* Scan Info */}
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <div className="flex items-center gap-4">
              <span>
                {showAppliedOnly ? (
                  <span className="text-emerald-400">{appliedCount} applied</span>
                ) : (
                  <span>{scanResults.length} candidates</span>
                )}
              </span>
              {scanCompletedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(scanCompletedAt).toLocaleTimeString("id-ID")}
                </span>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showAppliedOnly}
                onChange={(e) => onShowAppliedOnlyChange(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              />
              <span className="text-zinc-400">Applied Only</span>
              <span className="text-zinc-600">(1-10JT, 1-2%)</span>
            </label>
          </div>

          {/* Results Grid */}
          <div className="grid gap-3">
            {scanResults.slice(0, 20).map((candidate) => (
              <motion.div
                key={candidate.ticker}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="group"
              >
                <Card className="cursor-pointer border-zinc-800 transition-all hover:border-zinc-700 hover:bg-zinc-900/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      {/* Ticker Info */}
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-lg font-bold">
                            {candidate.ticker.replace(".JK", "")}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatCurrency(candidate.marketData.currentPrice)}
                          </span>
                        </div>
                        <Badge tone={candidateTone[candidate.status]}>
                          {candidate.status}
                        </Badge>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-xs text-zinc-500">Score</div>
                          <div className="font-mono text-lg font-bold text-blue-400">
                            {candidate.setupScore}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-zinc-500">RR</div>
                          <div className="font-mono text-lg font-bold text-emerald-400">
                            1:{candidate.rr.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-zinc-500">Vol</div>
                          <div className="font-mono text-lg font-bold text-violet-400">
                            {candidate.volumeRatio.toFixed(2)}x
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-zinc-500">Trend</div>
                          <div className="text-sm font-medium">{candidate.trend}</div>
                        </div>

                        {/* Analyze Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnalyze(candidate.ticker.replace(".JK", ""));
                          }}
                          disabled={isAnalyzing}
                        >
                          <Zap className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Analyze</span>
                        </Button>
                      </div>
                    </div>

                    {/* Quick Stats Row */}
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {candidate.trend}
                      </span>
                      <span className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3" />
                        {candidate.volumeRatio.toFixed(2)}x avg
                      </span>
                      <span className="text-zinc-300">
                        {candidate.reason.slice(0, 50)}...
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!scanLoading && scanResults.length === 0 && (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-8">
            <div className="text-center text-zinc-500">
              <Search className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-4 font-medium">Belum ada scan results</div>
              <div className="mt-2 text-sm">
                Klik tombol scan di sidebar untuk memulai
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}