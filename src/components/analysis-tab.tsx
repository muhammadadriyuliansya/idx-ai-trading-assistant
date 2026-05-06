"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  Sparkles,
  Copy,
  Download,
  Brain,
  ClipboardCheck,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PipelineViewer } from "@/components/pipeline-viewer";
import { useLocalStorage } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { exportAIReadyPrompt, exportFullBrief } from "@/lib/export";
import { runFullAnalysis, type AnalysisRunOptions } from "@/pipeline/orchestrator";
import type { AnalysisPipeline } from "@/pipeline/types";

interface AnalysisTabProps {
  initialTicker?: string;
}

const STORAGE_KEYS = {
  lastTicker: "idxai.last.ticker",
  lastCapital: "idxai.last.capital",
  lastRisk: "idxai.last.risk",
  aiOpinions: "idxai.ai.opinions",
};

export function AnalysisTab({ initialTicker }: AnalysisTabProps) {
  const [ticker, setTicker] = useLocalStorage(STORAGE_KEYS.lastTicker, initialTicker || "");
  const [capital, setCapital] = useLocalStorage(STORAGE_KEYS.lastCapital, "10000000");
  const [riskPerTrade, setRiskPerTrade] = useLocalStorage(STORAGE_KEYS.lastRisk, "1");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisPipeline | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [showModal, setShowModal] = useState(false);

  const runAnalysis = async () => {
    if (!ticker.trim()) {
      setError("Masukkan ticker terlebih dahulu");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const symbol = ticker.trim().toUpperCase().includes(".JK") 
        ? ticker.trim().toUpperCase() 
        : `${ticker.trim().toUpperCase()}.JK`;

      const options: AnalysisRunOptions = {
        capital: parseFloat(capital) || 10000000,
        riskPerTrade: parseFloat(riskPerTrade) || 1,
      };

      const result = await runFullAnalysis(symbol, options);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const openTextModal = (title: string, text: string) => {
    setModalTitle(title);
    setModalText(text);
    setShowModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(modalText);
  };

  const downloadExport = () => {
    if (!analysis) return;
    const text = exportFullBrief(analysis);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${analysis.ticker}-${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-zinc-400">Ticker</Label>
              <Input
                placeholder="BBRI, TLKM, GOTO..."
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                className="font-mono text-lg"
              />
            </div>
            <div>
              <Label className="text-zinc-400">Capital (IDR)</Label>
              <Input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-zinc-400">Risk per Trade (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={runAnalysis}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-400" />
              <div className="mt-4 text-lg font-semibold">Running v2 Institutional Pipeline</div>
              <div className="mt-2 text-sm text-zinc-500">
                Market data, indicators, analyst reports, thesis, portfolio decision
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysis && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Header */}
          <Card className={`border ${analysis.finalScore >= 70 ? "border-emerald-500/30 bg-emerald-500/10" : analysis.finalScore >= 50 ? "border-amber-500/30 bg-amber-500/10" : "border-red-500/30 bg-red-500/10"}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-mono text-3xl font-bold">{analysis.ticker.replace(".JK", "")}</span>
                    <span className="ml-3 text-xl text-zinc-400">
                      {formatCurrency(analysis.marketData.currentPrice)}
                    </span>
                  </div>
                  <Badge className="text-sm" tone={analysis.finalScore >= 70 ? "emerald" : analysis.finalScore >= 50 ? "amber" : "red"}>
                    Score: {analysis.finalScore}
                  </Badge>
                  <Badge tone={analysis.decision.finalDecision === "BUY_NOW" ? "emerald" : analysis.decision.finalDecision === "WATCHLIST" ? "amber" : "red"}>
                    {analysis.decision.finalDecision}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openTextModal("AI Prompt", exportAIReadyPrompt(analysis))}>
                    <Brain className="h-4 w-4" />
                    AI Prompt
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openTextModal("Full Brief", exportFullBrief(analysis))}>
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Viewer */}
          <PipelineViewer
            pipeline={analysis}
            onAnalyzeWithAI={(prompt) => openTextModal("AI-Ready Prompt", prompt)}
          />
        </motion.div>
      )}

      {/* Empty State */}
      {!analysis && !loading && (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-8">
            <div className="text-center text-zinc-500">
              <Search className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-4 font-medium">Masukkan ticker untuk analisis</div>
              <div className="mt-2 text-sm">
                Contoh: BBRI, TLKM, GOTO, BMRI
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[84vh] w-full max-w-3xl flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-zinc-100">{modalTitle}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                Close
              </Button>
            </div>
            <textarea
              value={modalText}
              readOnly
              className="min-h-[420px] flex-1 resize-none rounded-lg border border-zinc-800 bg-black/40 p-4 font-mono text-xs text-emerald-200 outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" onClick={downloadExport}>
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}