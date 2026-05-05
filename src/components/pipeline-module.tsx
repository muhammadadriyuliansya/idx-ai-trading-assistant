"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnalysisPipeline } from "@/pipeline/types";
import { usePipeline } from "@/hooks/use-pipeline";
import type { AISettings } from "@/lib/types";
import { PipelineViewer } from "@/components/pipeline-viewer";
import {
  exportFullBrief,
  exportMarkdownReport,
  exportJsonReport,
  exportAIReadyPrompt,
} from "@/lib/export";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

export function PipelineModule({ settings }: { settings?: AISettings }) {
  const { currentPipeline, isRunning, lastTicker, runAnalysis } = usePipeline();
  const [tickerInput, setTickerInput] = useState(lastTicker ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportText, setExportText] = useState("");
  const [exportTitle, setExportTitle] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Section toggle
  const [showInput, setShowInput] = useState(true);

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

  const handleExport = (type: "brief" | "markdown" | "json" | "ai-prompt") => {
    if (!currentPipeline) return;
    setIsExporting(true);
    try {
      let text = "";
      let title = "";
      switch (type) {
        case "brief":
          text = exportFullBrief(currentPipeline);
          title = "Trading Brief";
          break;
        case "markdown":
          text = exportMarkdownReport(currentPipeline);
          title = "Markdown Report";
          break;
        case "json":
          text = exportJsonReport(currentPipeline);
          title = "JSON Report";
          break;
        case "ai-prompt":
          text = exportAIReadyPrompt(currentPipeline);
          title = "AI-Ready Prompt";
          break;
      }
      setExportText(text);
      setExportTitle(title);
      setShowExportModal(true);
    } catch (err) {
      alert("Gagal generate export.");
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
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAnalyze();
              }}
              disabled={isRunning}
            />
            <Button onClick={handleAnalyze} disabled={isRunning || !tickerInput.trim()} variant="accent">
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Analyze
                </>
              )}
            </Button>
          </div>
          {localError && <div className="mt-3 text-xs text-red-400">{localError}</div>}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4 text-sm text-zinc-400">
        No analysis loaded. After you analyze a ticker, the pipeline view will appear.
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Input section — collapsible */}
      {currentPipeline && (
        <Card className="border-zinc-800/60 bg-zinc-950/60">
          <button
            onClick={() => setShowInput(!showInput)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-200">
                {currentPipeline.ticker} — Pipeline
              </span>
              <span className="text-xs text-zinc-500">
                Score: {currentPipeline.finalScore}/100
              </span>
            </div>
            {showInput ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </button>
          {showInput && (
            <div className="px-4 pb-4">
              <div className="flex gap-2">
                <Input
                  placeholder="BBRI"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAnalyze();
                  }}
                  disabled={isRunning}
                />
                <Button onClick={handleAnalyze} disabled={isRunning || !tickerInput.trim()} variant="accent">
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                    </>
                  ) : (
                    "Analyze"
                  )}
                </Button>
              </div>
              {localError && <div className="mt-2 text-xs text-red-400">{localError}</div>}
            </div>
          )}
        </Card>
      )}

      {/* Pipeline Viewer or Placeholder */}
      {currentPipeline ? (
        <PipelineViewer
          pipeline={currentPipeline as AnalysisPipeline}
          onExport={handleExport}
        />
      ) : (
        placeholder
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col gap-4 border border-zinc-800">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-semibold">{exportTitle} — {currentPipeline?.ticker}</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-white text-lg"
              >
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
                Copy
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([exportText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${currentPipeline?.ticker}-${exportTitle.toLowerCase().replace(/\s/g, "-")}-${Date.now()}.txt`;
                  a.click();
                }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
