"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Loader2, Play, RefreshCw, Search, TrendingUp } from "lucide-react";
import { runMarketScan, getDefaultIDXTickers } from "@/pipeline/scanner";
import type { ScanCandidate } from "@/pipeline/types";
import { formatNumber } from "@/lib/utils";

export function MarketScanner() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ScanCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customTickers, setCustomTickers] = useState("");
  const [config, setConfig] = useState({
    minVolumeRatio: 1.5,
    minRR: 2.0,
    minSetupScore: 50,
    maxResults: 20,
  });

  const handleRunScan = async () => {
    setIsRunning(true);
    setError(null);
    setResults([]);

    try {
      const tickers = customTickers.trim()
        ? customTickers
            .split(",")
            .map((t) => t.trim().toUpperCase())
            .filter((t) => t)
        : getDefaultIDXTickers();

      const scanResults = await runMarketScan({
        tickers,
        minVolumeRatio: config.minVolumeRatio,
        minRR: config.minRR,
        minSetupScore: config.minSetupScore,
        maxResults: config.maxResults,
      });

      setResults(scanResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  };

  const handleLoadTicker = (ticker: string) => {
    // This would typically navigate to the pipeline module with the ticker pre-filled
    // For now, we'll just copy it to clipboard
    navigator.clipboard.writeText(ticker).catch(() => {});
  };

  const statusColor = {
    VALID: "emerald",
    WATCHLIST: "amber",
    REJECT: "red",
  } as const;

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 text-white">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Automated Market Scanner</div>
              <div className="text-[10px] text-zinc-500">
                Scan multiple tickers and rank by setup quality
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            {/* Ticker Input */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                Tickers (comma-separated, or leave empty for default IDX list)
              </label>
              <Input
                placeholder="BBRI, BBCA, TLKM, EXCL"
                value={customTickers}
                onChange={(e) => setCustomTickers(e.target.value)}
                disabled={isRunning}
              />
              <div className="text-[10px] text-zinc-500 mt-1">
                Default: {getDefaultIDXTickers().length} IDX blue-chip stocks
              </div>
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                  Min Volume Ratio
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.minVolumeRatio}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      minVolumeRatio: parseFloat(e.target.value) || 0,
                    }))
                  }
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                  Min RR
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.minRR}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      minRR: parseFloat(e.target.value) || 0,
                    }))
                  }
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                  Min Setup Score
                </label>
                <Input
                  type="number"
                  value={config.minSetupScore}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      minSetupScore: parseInt(e.target.value) || 0,
                    }))
                  }
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                  Max Results
                </label>
                <Input
                  type="number"
                  value={config.maxResults}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxResults: parseInt(e.target.value) || 10,
                    }))
                  }
                  disabled={isRunning}
                />
              </div>
            </div>

            <Button
              onClick={handleRunScan}
              disabled={isRunning}
              variant="accent"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Scanning Market...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Market Scan
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="text-xs text-red-300">{error}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                Scan Results
              </div>
              <div className="text-sm font-semibold mt-1">
                {results.length} candidates found
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunScan}
              disabled={isRunning}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="p-5">
              <div className="space-y-2">
                {results.map((candidate, index) => (
                  <div
                    key={candidate.ticker}
                    className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/60 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 font-mono text-sm font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="font-mono text-lg font-semibold">
                            {candidate.ticker}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {formatNumber(candidate.marketData.currentPrice)}
                          </div>
                        </div>
                      </div>
                      <Badge tone={statusColor[candidate.status]}>
                        {candidate.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                          Setup Score
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          {candidate.setupScore}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                          Volume Ratio
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          {candidate.volumeRatio.toFixed(2)}x
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                          Risk/Reward
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          1:{candidate.rr.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                          Trend
                        </div>
                        <div className="text-sm font-semibold mt-1 capitalize">
                          {candidate.trend}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLoadTicker(candidate.ticker)}
                      className="mt-3 w-full"
                    >
                      <TrendingUp className="h-3.5 w-3.5 mr-2" />
                      Analyze in Pipeline
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-blue-500/5 to-emerald-500/5 border-blue-500/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
              <Search className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">
                Automated Market Scanning
              </div>
              <p className="text-xs text-zinc-400">
                This scanner automatically analyzes multiple tickers, applies
                hard filters (volume, RR, trend), calculates setup scores, and
                ranks opportunities by quality. All calculations are done
                locally without requiring AI API keys.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
