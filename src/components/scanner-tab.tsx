"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  TrendingUp,
  Zap,
  Clock,
  Volume2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScanCandidate } from "@/pipeline/types";
import { BacktestBadge } from "@/components/backtest-badge";

type ScanMode = 'conservative' | 'swing' | 'day' | 'premarket';
import { formatCurrency } from "@/lib/utils";
import { useLocalStorage } from "@/lib/storage";
import { STORAGE_KEYS, DEFAULT_AI_SETTINGS } from "@/config/app";
import type { AISettings } from "@/lib/types";

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

const statusLabels: Record<ScanCandidate["status"], string> = {
  VALID: "Valid",
  WATCHLIST: "Pantauan",
  REJECT: "Ditolak",
};

const modeLabels: Record<ScanMode, string> = {
  swing: "Swing (harian)",
  day: "Day Trade",
  premarket: "Pre-market",
  conservative: "Konservatif",
};

const trendLabels: Record<string, string> = {
  bullish: "Naik",
  bearish: "Turun",
  sideways: "Mendatar",
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

  const [aiSettings] = useLocalStorage<AISettings>(
    STORAGE_KEYS.aiSettings,
    DEFAULT_AI_SETTINGS,
  );

  const [critiques, setCritiques] = useState<Record<string, string>>({});
  const [critiqueLoading, setCritiqueLoading] = useState(false);

  const critiqueEnabled =
    aiSettings.aiEnabled && aiSettings.features.scannerCritique && scanResults.length > 0;

  // Fetch critiques setelah scan selesai, kalau fitur aktif. Cached server-side 10m
  // jadi scan ulang dalam window yang sama gak call AI lagi.
  useEffect(() => {
    if (!critiqueEnabled) {
      // Clear dispatched via timer biar gak trigger cascading render warning
      const clearHandle = setTimeout(() => setCritiques({}), 0);
      return () => clearTimeout(clearHandle);
    }
    const topN = scanResults.slice(0, 8);
    if (topN.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setCritiqueLoading(true);
      try {
        const payload = {
          candidates: topN.map((c) => ({
            ticker: c.ticker.replace(".JK", ""),
            setupScore: c.setupScore,
            status: c.status,
            trend: c.trend,
            volumeRatio: c.volumeRatio,
            rr: c.rr,
            mode: c.mode,
            reason: c.reason,
          })),
          provider: aiSettings.provider,
          model:
            aiSettings.provider === "ollama"
              ? aiSettings.ollamaModel
              : aiSettings.provider === "openai"
                ? aiSettings.openaiModel
                : aiSettings.anthropicModel,
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
          format: aiSettings.features.structuredOutput ? ("json" as const) : undefined,
        };
        const res = await fetch("/api/ai/scanner-critique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { critiques?: Record<string, string> };
        if (!cancelled && data.critiques) {
          setCritiques(data.critiques);
        }
      } catch {
        // silent fail — fitur opsional
      } finally {
        if (!cancelled) setCritiqueLoading(false);
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
    critiqueEnabled,
    scanCompletedAt,
    scanResults,
    aiSettings.provider,
    aiSettings.ollamaModel,
    aiSettings.openaiModel,
    aiSettings.anthropicModel,
    aiSettings.ollamaBaseUrl,
    aiSettings.openaiKey,
    aiSettings.anthropicKey,
    aiSettings.features.structuredOutput,
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pemindai Saham</h2>
          <p className="text-zinc-400">
            Scan {useCustom ? "ticker pilihan kamu" : `${defaultTickerCount} saham IDX default`} untuk cari setup terbaik hari ini
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Selector */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
            {(["swing", "day", "premarket", "conservative"] as ScanMode[]).map((mode) => (
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
                Pakai ticker sendiri
              </Label>
            </div>
            {useCustom && (
              <Input
                placeholder="BBRI, TLKM, GOTO, BMRI (pisahkan dengan koma)"
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
              <div className="mt-4 text-lg font-semibold">Sedang scan pasar IDX</div>
              <div className="mt-2 text-sm text-zinc-500">
                Mengambil data dari Yahoo Finance dan menganalisa setup setiap saham...
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
                  <span className="text-emerald-400">{appliedCount} kandidat sesuai modalmu</span>
                ) : (
                  <span>{scanResults.length} kandidat ditemukan</span>
                )}
              </span>
              {scanCompletedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Scan terakhir {new Date(scanCompletedAt).toLocaleTimeString("id-ID")}
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
              <span className="text-zinc-400">Hanya yang sesuai modal</span>
              <span className="text-zinc-600">(modal 1-10 juta, risk 1-2%)</span>
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
                          {statusLabels[candidate.status]}
                        </Badge>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-xs text-zinc-500" title="Skor setup 0-100. Makin tinggi makin bagus.">Skor</div>
                          <div className="font-mono text-lg font-bold text-blue-400">
                            {candidate.setupScore}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-zinc-500" title="Rasio Risk/Reward. Target 1:2 atau lebih.">RR</div>
                          <div className="font-mono text-lg font-bold text-emerald-400">
                            1:{candidate.rr.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-zinc-500" title="Volume hari ini dibanding rata-rata 20 hari">Volume</div>
                          <div className="font-mono text-lg font-bold text-violet-400">
                            {candidate.volumeRatio.toFixed(2)}x
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-zinc-500">Tren</div>
                          <div className="text-sm font-medium">{trendLabels[candidate.trend] ?? candidate.trend}</div>
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
                          <span className="ml-1 hidden sm:inline">Analisa</span>
                        </Button>
                      </div>
                    </div>

                    {/* Quick Stats Row */}
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {trendLabels[candidate.trend] ?? candidate.trend}
                      </span>
                      <span className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3" />
                        {candidate.volumeRatio.toFixed(2)}x rata-rata
                      </span>
                      <span className="text-zinc-300">
                        {candidate.reason.slice(0, 50)}...
                      </span>
                    </div>

                    {/* Inline backtest — history pattern yang sama di ticker ini */}
                    <div className="mt-2">
                      <BacktestBadge ticker={candidate.ticker} variant="compact" />
                    </div>

                    {/* AI Critique (opsional) */}
                    {critiqueEnabled && critiques[candidate.ticker.replace(".JK", "")] && (
                      <div className="mt-3 flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs italic text-blue-100">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                        <span>{critiques[candidate.ticker.replace(".JK", "")]}</span>
                      </div>
                    )}
                    {critiqueEnabled && critiqueLoading && !critiques[candidate.ticker.replace(".JK", "")] && (
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500 italic">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI lagi nulis komentar untuk saham ini...
                      </div>
                    )}
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
              <div className="mt-4 font-medium">Belum ada hasil scan</div>
              <div className="mt-2 text-sm">
                Tekan tombol refresh di sidebar untuk mulai scan pasar
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
