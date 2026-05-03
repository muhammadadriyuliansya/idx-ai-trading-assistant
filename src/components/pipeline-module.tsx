"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportToBrief } from "@/lib/export";
import type { AnalysisPipeline } from "@/pipeline/types";
import { usePipeline } from "@/hooks/use-pipeline";
import type { AISettings } from "@/lib/types";
import { PipelineViewer } from "@/components/pipeline-viewer";

export function PipelineModule({ settings }: { settings?: AISettings }) {
  const { currentPipeline, isRunning, lastTicker, runAnalysis } = usePipeline();
  const [tickerInput, setTickerInput] = useState(lastTicker ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const [exportText, setExportText] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleAnalyze = async () => {
    setLocalError(null);
    const t = (tickerInput || lastTicker || "").trim();
    if (!t) {
      setLocalError("Masukkan ticker terlebih dahulu.");
      return;
    }
    try {
      await runAnalysis(t.toUpperCase(), settings);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFloatingExport = async () => {
    if (!currentPipeline) {
      alert("Belum ada analisis. Jalankan Analyze terlebih dahulu.");
      return;
    }
    setIsExporting(true);
    try {
      const newsRes = await fetch(`/api/news?ticker=${encodeURIComponent(currentPipeline.ticker)}`);
      const newsData = await newsRes.json();

      const text = exportToBrief({
        ticker: currentPipeline.ticker,
        pipeline: currentPipeline as unknown as any,
        fundamental: undefined,
        news: newsData?.news ?? [],
      });

      setExportText(text);
      setShowExport(true);
    } catch (err) {
      alert("Gagal mengunduh brief. Pastikan endpoint /api/news tersedia.");
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const placeholder = (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-semibold">Run Pipeline</div>
          <p className="text-xs text-zinc-500 mb-3">Masukkan ticker lalu klik Analyze untuk menjalankan pipeline.</p>
          <div className="flex gap-2">
            <Input
              placeholder="BBRI"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              disabled={isRunning}
            />
            <Button onClick={handleAnalyze} disabled={isRunning} variant="accent">
              {isRunning ? "Analyzing…" : "Analyze"}
            </Button>
          </div>
          {localError && <div className="mt-3 text-xs text-red-400">{localError}</div>}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4 text-sm text-zinc-400">
        No analysis loaded. After you analyze a ticker, the pipeline view will appear with the export button.
      </div>
    </div>
  );

  const content = currentPipeline ? (
    <PipelineViewer pipeline={currentPipeline as AnalysisPipeline} ticker={currentPipeline.ticker} />
  ) : (
    placeholder
  );

  return (
    <div className="relative">
      {content}

      {/* Floating export button bottom-right */}
      <button
        onClick={handleFloatingExport}
        disabled={isExporting}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-sm font-medium transition-colors ${
          isExporting ? "bg-emerald-400/80 text-white opacity-80" : "bg-emerald-600 hover:bg-emerald-500 text-white"
        }`}
        aria-label="Export Brief"
      >
        📋 {isExporting ? "Exporting…" : "Export Brief"}
      </button>

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-semibold">Export Brief — {currentPipeline?.ticker}</h3>
              <button onClick={() => setShowExport(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <textarea
              value={exportText}
              readOnly
              className="flex-1 bg-black/40 text-green-300 font-mono text-xs p-4 rounded-lg resize-none min-h-[400px] border border-white/10"
            />

            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(exportText)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
              >
                📋 Copy ke Clipboard
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([exportText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${currentPipeline?.ticker}-brief-${Date.now()}.txt`;
                  a.click();
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
              >
                💾 Download .txt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
