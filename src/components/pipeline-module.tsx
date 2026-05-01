"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, Sparkles, TrendingUp } from "lucide-react";
import { usePipeline } from "@/hooks/use-pipeline";
import { PipelineViewer } from "@/components/pipeline-viewer";
import { useLocalStorage } from "@/lib/storage";
import { DEFAULT_SETTINGS } from "@/lib/ai";
import { STORAGE_KEYS } from "@/lib/storage";
import type { AISettings } from "@/lib/types";

const STORAGE_KEY = "pipeline_config" as const;

interface PipelineConfig {
  capital: string;
  riskPerTrade: string;
  minRR: string;
  minVolumeRatio: string;
}

const DEFAULT_CONFIG: PipelineConfig = {
  capital: "100000000",
  riskPerTrade: "1",
  minRR: "2.0",
  minVolumeRatio: "1.5",
};

export function PipelineModule() {
  const [ticker, setTicker] = useState("");
  const [config, setConfig] = useLocalStorage<PipelineConfig>(
    STORAGE_KEY,
    DEFAULT_CONFIG
  );
  const [settings] = useLocalStorage<AISettings>(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS
  );

  const {
    currentPipeline,
    isRunning,
    error,
    lastTicker,
    history,
    runAnalysis,
    clearError,
    clearPipeline,
  } = usePipeline();

  const handleRunAnalysis = async () => {
    if (!ticker.trim()) return;

    try {
      await runAnalysis(ticker.trim(), settings);
    } catch (err) {
      console.error("Analysis failed:", err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRunAnalysis();
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 text-white">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Full Analysis Pipeline</div>
              <div className="text-[10px] text-zinc-500">
                One-click analysis from scanner to decision
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            {/* Ticker Input */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                Ticker
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="BBRI"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isRunning}
                  className="flex-1"
                />
                <Button
                  onClick={handleRunAnalysis}
                  disabled={isRunning || !ticker.trim()}
                  variant="accent"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analyzing
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Analysis
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                  Capital (Rp)
                </label>
                <Input
                  type="number"
                  value={config.capital}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, capital: e.target.value }))
                  }
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 block">
                  Risk Per Trade (%)
                </label>
                <Input
                  type="number"
                  value={config.riskPerTrade}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      riskPerTrade: e.target.value,
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
                    setConfig((prev) => ({ ...prev, minRR: e.target.value }))
                  }
                  disabled={isRunning}
                />
              </div>
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
                      minVolumeRatio: e.target.value,
                    }))
                  }
                  disabled={isRunning}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="text-xs text-red-300">{error}</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearError}
                className="mt-2 text-xs"
              >
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {currentPipeline && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                Analysis Results
              </div>
              <div className="text-sm font-semibold mt-1">
                {currentPipeline.ticker} ·{" "}
                {new Date(currentPipeline.timestamp).toLocaleString("id-ID", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={clearPipeline}
              disabled={isRunning}
            >
              Clear
            </Button>
          </div>

          <PipelineViewer pipeline={currentPipeline} />
        </>
      )}

      {/* History */}
      {history.length > 0 && !currentPipeline && (
        <Card>
          <CardContent className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
              Recent Analyses
            </div>
            <div className="space-y-2">
              {history.slice(0, 5).map((pipeline) => (
                <button
                  key={pipeline.ticker}
                  onClick={() => {
                    setTicker(pipeline.ticker);
                    // Load from history would be handled by parent
                  }}
                  className="w-full text-left p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">
                      {pipeline.ticker}
                    </span>
                    <Badge
                      tone={
                        pipeline.decision.finalDecision === "BUY_NOW"
                          ? "emerald"
                          : pipeline.decision.finalDecision === "WAIT"
                          ? "blue"
                          : pipeline.decision.finalDecision === "WATCHLIST"
                          ? "amber"
                          : "red"
                      }
                    >
                      {pipeline.decision.finalDecision}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    Score: {pipeline.finalScore}/100 ·{" "}
                    {new Date(pipeline.timestamp).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-blue-500/5 to-emerald-500/5 border-blue-500/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">
                AI-Optional Analysis
              </div>
              <p className="text-xs text-zinc-400">
                This pipeline runs completely deterministic analysis without
                requiring AI API keys. All calculations are done locally using
                technical indicators and risk management formulas. AI is only
                used for optional explanations when configured.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
