"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FormattedNumberInput } from "@/components/formatted-input";
import { PipelineViewer } from "@/components/pipeline-viewer";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLocalStorage } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { exportAIReadyPrompt, exportFullBrief } from "@/lib/export";
import { getDefaultIDXTickers, runMarketScan } from "@/pipeline/scanner";
import { runFullAnalysis } from "@/pipeline/orchestrator";
import {
  buildDailyGuardSnapshot,
  type TradeJournalRecord,
} from "@/lib/risk-governor";
import type { AnalysisPipeline, ScanCandidate } from "@/pipeline/types";
import { TabNavigation, type TabId } from "@/components/tabs";
import { ScannerTab } from "@/components/scanner-tab";
import { AnalysisTab } from "@/components/analysis-tab";
import { TextPreviewModal } from "@/components/text-preview-modal";
import { MultiTimeframeTab } from "@/components/timeframe-tab";
import { ComparisonTab } from "@/components/comparison-tab";
import { MarketBreadthTab } from "@/components/market-breadth-tab";
import { SettingsTab } from "@/components/settings-tab";
import { ThemeToggle } from "@/components/theme-toggle";
import { STORAGE_KEYS, SCAN_CONFIG, AUTO_SCAN_THROTTLE_MS, DEFAULT_AI_SETTINGS } from "@/config/app";
import { actionTone, candidateTone, healthTone } from "@/features/trading/display";
import {
  buildImprovementText,
  getPipelineOptions,
  normalizeAnalysisMode,
  parsePositiveNumber,
} from "@/features/trading/analysis";
import {
  buildTradingConfig,
  filterAppliedScanResults,
} from "@/features/trading/applied-filter";
import {
  DashboardCard,
  ExplainRow,
  MetricChip,
  StatusRow,
  TinyScore,
} from "@/features/trading/dashboard-components";
import { evaluateAlerts, getAlertLabel, mergeWatchlist } from "@/features/trading/watchlist";
import type { AiOpinion, AlertCondition, LocalAlert, ScanMode, WatchlistItem } from "@/features/trading/types";
import type { AISettings } from "@/lib/types";
import { callAIIfEnabled } from "@/lib/ai-client";

// Label Bahasa Indonesia untuk value bawaan (pipeline tetap pakai kode Inggris).
const regimeLabels: Record<string, string> = {
  AGGRESSIVE: "AGRESIF",
  NORMAL: "NORMAL",
  DEFENSIVE: "DEFENSIF",
};

const scanModeLabels: Record<ScanMode, string> = {
  swing: "Swing",
  day: "Day Trade",
  conservative: "Konservatif",
};

const candidateStatusLabels: Record<string, string> = {
  VALID: "VALID",
  WATCHLIST: "PANTAUAN",
  REJECT: "DILEWATI",
  NO_TRADE: "TIDAK TRADE",
};

const actionLabels: Record<string, string> = {
  APPROVED: "DISETUJUI",
  WATCHLIST: "PANTAUAN",
  REDUCE_SIZE: "KURANGI POSISI",
  REJECTED: "DITOLAK",
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("scanner");
  const [ticker, setTicker] = useLocalStorage(STORAGE_KEYS.lastTicker, "");
  const [capital, setCapital] = useLocalStorage(
    STORAGE_KEYS.lastCapital,
    "10000000",
  );
  const [riskPerTrade, setRiskPerTrade] = useLocalStorage(
    STORAGE_KEYS.lastRisk,
    "0.5",
  );

  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanCandidate[]>([]);
  const [scanCompletedAt, setScanCompletedAt] = useState<number | null>(null);
  const [showAppliedOnly, setShowAppliedOnly] = useState(true);

  const tradingConfig = useMemo(
    () => buildTradingConfig(capital, riskPerTrade),
    [capital, riskPerTrade],
  );

  const filteredResults = useMemo(() => {
    return filterAppliedScanResults(
      scanResults,
      showAppliedOnly,
      capital,
      riskPerTrade,
      tradingConfig,
    );
  }, [scanResults, showAppliedOnly, capital, riskPerTrade, tradingConfig]);

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisPipeline | null>(null);

  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");
  const [modalDownloadName, setModalDownloadName] = useState("");
  const [aiDraft, setAiDraft] = useState("");

  const [watchlist, setWatchlist] = useLocalStorage<WatchlistItem[]>(
    STORAGE_KEYS.watchlist,
    [],
  );
  const [alerts, setAlerts] = useLocalStorage<LocalAlert[]>(
    STORAGE_KEYS.alerts,
    [],
  );
  const [aiOpinions, setAiOpinions] = useLocalStorage<AiOpinion[]>(
    STORAGE_KEYS.aiOpinions,
    [],
  );
  const [scanMode, setScanMode] = useLocalStorage<ScanMode>(
    STORAGE_KEYS.scanMode,
    "swing",
  );
  const [tradeHistory] = useLocalStorage<TradeJournalRecord[]>(
    STORAGE_KEYS.tradeHistory,
    [],
  );
  const [lastScanAt, setLastScanAt] = useLocalStorage<number>(
    STORAGE_KEYS.lastScanAt,
    0,
  );
  const [aiSettings] = useLocalStorage<AISettings>(
    STORAGE_KEYS.aiSettings,
    DEFAULT_AI_SETTINGS,
  );

  const [aiRunLoading, setAiRunLoading] = useState(false);
  const [aiRunError, setAiRunError] = useState<string | null>(null);

  const defaultTickerCount = useMemo(() => getDefaultIDXTickers().length, []);
  const currentAiOpinion = analysis
    ? aiOpinions.find((item) => item.ticker === analysis.ticker)
    : undefined;

  const marketDashboard = useMemo(() => {
    const bullish = scanResults.filter((item) => item.trend === "bullish").length;
    const bearish = scanResults.filter((item) => item.trend === "bearish").length;
    const valid = scanResults.filter((item) => item.status === "VALID").length;
    const watch = scanResults.filter((item) => item.status === "WATCHLIST").length;
    const rejected = scanResults.filter((item) => item.status === "REJECT").length;
    const bestVolume = [...scanResults].sort((a, b) => b.volumeRatio - a.volumeRatio)[0];
    const bestRR = [...scanResults].sort((a, b) => b.rr - a.rr)[0];
    const bestScore = scanResults[0];
    const regime =
      bearish > bullish && bearish >= scanResults.length * 0.4
        ? "DEFENSIVE"
        : bullish > bearish && valid + watch >= 3
        ? "AGGRESSIVE"
        : "NORMAL";

    return { bullish, bearish, valid, watch, rejected, bestVolume, bestRR, bestScore, regime };
  }, [scanResults]);

  const portfolioSnapshot = useMemo(() => {
    const openRisk = watchlist.reduce((sum, item) => {
      if (item.status === "REJECT") return sum;
      return sum + 1;
    }, 0);
    const capitalNum = parsePositiveNumber(capital) ?? 0;
    const riskPct = parsePositiveNumber(riskPerTrade) ?? 0;
    const plannedRisk = (capitalNum * riskPct * openRisk) / 100;
    const maxRisk = capitalNum * 0.06;

    return {
      activeSetups: openRisk,
      plannedRisk,
      maxRisk,
      riskUsage: maxRisk > 0 ? Math.min(100, (plannedRisk / maxRisk) * 100) : 0,
      capacity: Math.max(0, Math.floor((maxRisk - plannedRisk) / Math.max((capitalNum * riskPct) / 100, 1))),
    };
  }, [capital, riskPerTrade, watchlist]);

  const runScan = useCallback(async () => {
    setScanLoading(true);
    setScanError(null);

    try {
      const results = await runMarketScan({
        tickers: getDefaultIDXTickers(),
        mode: scanMode,
        ...SCAN_CONFIG,
      });

      setScanResults(results);
      setWatchlist((prev) => mergeWatchlist(prev, results));
      setAlerts((prev) => evaluateAlerts(prev, results));
      const now = Date.now();
      setScanCompletedAt(now);
      setLastScanAt(now);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan pasar gagal dijalankan");
    } finally {
      setScanLoading(false);
    }
  }, [scanMode, setAlerts, setLastScanAt, setWatchlist]);

  // Auto-scan on mount — throttled so reloading the tab every few seconds
  // doesn't hammer Yahoo Finance. If the last scan is still within the TTL
  // window, skip. Manual refresh button always runs regardless.
  useEffect(() => {
    if (scanResults.length > 0) return;
    const elapsed = Date.now() - (lastScanAt ?? 0);
    if (elapsed < AUTO_SCAN_THROTTLE_MS) return;

    const timer = window.setTimeout(() => {
      void runScan();
    }, 0);

    return () => window.clearTimeout(timer);
    // runScan changes when scanMode changes; lastScanAt only gates the initial
    // trigger. We intentionally leave lastScanAt out of deps to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runScan, scanResults.length]);

  const analyzeTicker = async (selectedTicker?: string) => {
    const nextTicker = (selectedTicker ?? ticker).trim().toUpperCase();
    if (!nextTicker) {
      setAnalysisError("Masukkan kode saham dulu.");
      return;
    }

    const options = getPipelineOptions(capital, riskPerTrade);
    if (!options) {
      setAnalysisError("Modal harus angka valid dan risk per trade antara 0.1% sampai 10%.");
      return;
    }

    setTicker(nextTicker);
    setAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const result = await runFullAnalysis(nextTicker, {
        ...options,
        mode: normalizeAnalysisMode(scanMode),
        dailyGuardSnapshot: buildDailyGuardSnapshot(tradeHistory),
      });
      setAnalysis(result);
      setAiDraft("");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analisa gagal dijalankan");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      void analyzeTicker();
    }
  };

  const openTextModal = (title: string, text: string) => {
    setModalTitle(title);
    setModalText(text);
    setModalDownloadName(
      `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.txt`,
    );
  };

  const addAlert = (candidate: ScanCandidate, condition: AlertCondition) => {
    const id = `${candidate.ticker}-${condition}`;
    setAlerts((prev) => {
      if (prev.some((item) => item.id === id)) return prev;
      return [
        {
          id,
          ticker: candidate.ticker,
          condition,
          targetLabel: getAlertLabel(candidate, condition),
          createdAt: Date.now(),
        },
        ...prev,
      ].slice(0, 40);
    });
  };

  const saveAiOpinion = () => {
    if (!analysis || !aiDraft.trim()) return;
    const opinion: AiOpinion = {
      ticker: analysis.ticker,
      text: aiDraft.trim(),
      savedAt: Date.now(),
    };
    setAiOpinions((prev) => [opinion, ...prev.filter((item) => item.ticker !== analysis.ticker)].slice(0, 25));
    setAiDraft("");
  };

  /**
   * Langsung call AI provider (Ollama/OpenAI/Anthropic) pakai prompt yang udah
   * di-generate. Output langsung masuk ke textarea `aiDraft` biar user bisa
   * review sebelum simpan.
   */
  const runAIDirectly = async () => {
    if (!analysis) return;
    setAiRunLoading(true);
    setAiRunError(null);
    try {
      const prompt = exportAIReadyPrompt(analysis);
      const result = await callAIIfEnabled({
        system:
          "Kamu adalah asisten trading saham IDX. Berikan second opinion dalam Bahasa Indonesia yang ringkas, langsung ke inti, dan fokus pada risiko + eksekusi.",
        user: prompt,
        settings: aiSettings,
      });
      if (!result) {
        setAiRunError("AI belum diaktifkan. Buka tab Pengaturan dan nyalakan master switch.");
        return;
      }
      setAiDraft(result.text);
    } catch (err) {
      setAiRunError(err instanceof Error ? err.message : "AI gagal dihubungi");
    } finally {
      setAiRunLoading(false);
    }
  };

  const topCandidate = scanResults[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/70 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Asisten Trading Saham IDX
              </h1>
              <p className="text-[11px] text-zinc-500">
                Scanner otomatis, pipeline analisa deterministik, plus second opinion AI manual
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Badge tone="blue">Mesin V2</Badge>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="mx-auto max-w-7xl px-4 pt-2">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* Tab Content */}
        {activeTab === "scanner" && (
          <ScannerTab
            onAnalyze={(t) => analyzeTicker(t)}
            isAnalyzing={analysisLoading}
            defaultTickerCount={defaultTickerCount}
            scanMode={scanMode}
            onScanModeChange={setScanMode}
            scanLoading={scanLoading}
            scanResults={filteredResults}
            scanError={scanError}
            scanCompletedAt={scanCompletedAt}
            showAppliedOnly={showAppliedOnly}
            onShowAppliedOnlyChange={setShowAppliedOnly}
            appliedCount={showAppliedOnly ? filteredResults.length : scanResults.length}
          />
        )}

        {activeTab === "analysis" && (
          <AnalysisTab initialTicker={ticker} />
        )}

        {activeTab === "comparison" && (
          <ComparisonTab />
        )}

        {activeTab === "timeframe" && (
          <MultiTimeframeTab />
        )}

        {activeTab === "breadth" && (
          <MarketBreadthTab />
        )}

        {activeTab === "settings" && (
          <SettingsTab />
        )}

        {activeTab !== "settings" && (
        <>
        <Card className="border-blue-500/15 bg-blue-500/5">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ticker">Kode Saham</Label>
                  <Input
                    id="ticker"
                    value={ticker}
                    onChange={(event) => setTicker(event.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="BBRI"
                    autoComplete="off"
                    spellCheck={false}
                    className="uppercase"
                  />
                </div>

                <FormattedNumberInput
                  id="capital"
                  label="Modal Trading (Rp)"
                  value={capital}
                  onChange={setCapital}
                  onKeyDown={handleKeyDown}
                  placeholder="10000000"
                />

                <div className="space-y-1.5">
                  <Label htmlFor="risk">Risiko per Trade (%)</Label>
                  <Input
                    id="risk"
                    type="number"
                    value={riskPerTrade}
                    onChange={(event) => setRiskPerTrade(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="1"
                    inputMode="decimal"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void analyzeTicker()}
                  disabled={analysisLoading || !ticker.trim()}
                  size="lg"
                >
                  {analysisLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menganalisa
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analisa
                    </>
                  )}
                </Button>
                {analysis && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => openTextModal("Laporan Lengkap", exportFullBrief(analysis))}
                  >
                    <Download className="h-4 w-4" />
                    Export Laporan
                  </Button>
                )}
              </div>
            </div>

            {analysisError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {analysisError}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <DashboardCard
            icon={<Activity className="h-4 w-4" />}
            label="Kondisi Pasar"
            value={regimeLabels[marketDashboard.regime] ?? marketDashboard.regime}
            tone={marketDashboard.regime === "AGGRESSIVE" ? "emerald" : marketDashboard.regime === "DEFENSIVE" ? "amber" : "blue"}
            hint={`${marketDashboard.bullish} naik / ${marketDashboard.bearish} turun`}
          />
          <DashboardCard
            icon={<ClipboardCheck className="h-4 w-4" />}
            label="Kandidat"
            value={`${marketDashboard.valid + marketDashboard.watch}`}
            tone="blue"
            hint={`${marketDashboard.valid} valid, ${marketDashboard.watch} pantauan, ${marketDashboard.rejected} lewati`}
          />
          <DashboardCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Lonjakan Volume"
            value={marketDashboard.bestVolume?.ticker ?? "-"}
            tone="violet"
            hint={marketDashboard.bestVolume ? `${marketDashboard.bestVolume.volumeRatio.toFixed(2)}x dari rata-rata` : "Menunggu scan"}
          />
          <DashboardCard
            icon={<Shield className="h-4 w-4" />}
            label="Risiko Portfolio"
            value={`${portfolioSnapshot.riskUsage.toFixed(0)}%`}
            tone={portfolioSnapshot.riskUsage >= 80 ? "red" : portfolioSnapshot.riskUsage >= 50 ? "amber" : "emerald"}
            hint={`${portfolioSnapshot.activeSetups} setup aktif / sisa ${portfolioSnapshot.capacity} slot`}
          />
        </section>

        {/* Hide old Market Scanner when using Scanner Tab */}
        {activeTab !== "scanner" && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <ErrorBoundary sectionName="Market Scanner">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                  <Search className="h-3.5 w-3.5" />
                  Scanner Pasar
                </div>
                <h2 className="mt-1 text-xl font-semibold">
                  Saham yang paling menarik hari ini
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Scan otomatis {defaultTickerCount} saham IDX default dengan mode {scanModeLabels[scanMode]}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["swing", "day", "conservative"] as ScanMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={scanMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScanMode(mode)}
                    disabled={scanLoading}
                  >
                    {scanModeLabels[mode]}
                  </Button>
                ))}
                <Button variant="outline" onClick={() => void runScan()} disabled={scanLoading}>
                  {scanLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            {scanError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {scanError}
              </div>
            )}

            {scanLoading && scanResults.length === 0 ? (
              <Card>
                <CardContent className="flex min-h-[280px] items-center justify-center p-8">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-300" />
                    <div className="mt-3 text-sm font-semibold">Sedang scan pasar IDX</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Mengambil data Yahoo Finance dan meranking kandidat.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : scanResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {scanResults.map((candidate, index) => (
                  <motion.div
                    key={candidate.ticker}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.2) }}
                  >
                    <Card
                      className={
                        analysis?.ticker.replace(".JK", "") === candidate.ticker.replace(".JK", "")
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "bg-zinc-950/60"
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 font-mono text-sm font-bold text-zinc-300 ring-1 ring-zinc-800">
                              #{index + 1}
                            </div>
                            <div>
                              <div className="font-mono text-lg font-semibold">
                                {candidate.ticker}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {formatCurrency(candidate.marketData.currentPrice)}
                              </div>
                            </div>
                          </div>
                          <Badge tone={candidateTone[candidate.status]}>
                            {candidateStatusLabels[candidate.status] ?? candidate.status}
                          </Badge>
                        </div>

                        <Separator className="my-3" />

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge tone={healthTone[candidate.dataHealth.status]}>
                            Data {candidate.dataHealth.status}
                          </Badge>
                          <span className="text-[10px] text-zinc-500">
                            {candidate.reason}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <MetricChip label="Skor" value={`${candidate.setupScore}/100`} />
                          <MetricChip label="Mode" value={scanModeLabels[candidate.mode] ?? candidate.mode} />
                          <MetricChip label="Volume" value={`${candidate.volumeRatio.toFixed(2)}x`} />
                          <MetricChip label="RR" value={`1:${candidate.rr.toFixed(2)}`} />
                        </div>

                        <div className="mt-3 grid grid-cols-5 gap-1.5">
                          <TinyScore label="T" value={candidate.scoreBreakdown.trend} max={30} />
                          <TinyScore label="M" value={candidate.scoreBreakdown.momentum} max={20} />
                          <TinyScore label="V" value={candidate.scoreBreakdown.volume} max={20} />
                          <TinyScore label="C" value={candidate.scoreBreakdown.context} max={20} />
                          <TinyScore label="RR" value={candidate.scoreBreakdown.rrQuality} max={10} />
                        </div>

                        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 text-[10px] text-zinc-400">
                          <div><span className="text-zinc-500">Pemicu:</span> {candidate.nextTrigger}</div>
                          <div><span className="text-zinc-500">Batal jika:</span> {candidate.invalidation}</div>
                          <div>
                            <span className="text-zinc-500">Simulasi cepat:</span>{" "}
                            {candidate.miniBacktest.outcome} / {candidate.miniBacktest.horizonDays} hari / estimasi {candidate.miniBacktest.estimatedReturnPct}%
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                          <Button
                            className="w-full"
                            variant={index === 0 ? "default" : "outline"}
                            onClick={() => void analyzeTicker(candidate.ticker)}
                            disabled={analysisLoading}
                          >
                            {analysisLoading && ticker === candidate.ticker ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrendingUp className="h-4 w-4" />
                            )}
                            Analisa
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            title="Pasang alarm lonjakan volume"
                            onClick={() => addAlert(candidate, "VOLUME_ABOVE_1_5")}
                          >
                            <Bell className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" />
                  <div className="mt-3 text-sm font-semibold">Belum ada kandidat lolos filter</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Coba refresh setelah data pasar berubah.
                  </div>
                </CardContent>
              </Card>
            )}
            </ErrorBoundary>
          </div>

          <aside className="space-y-4">
            <Card className="border-emerald-500/15 bg-emerald-500/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                  <Target className="h-3.5 w-3.5" />
                  Kandidat Terbaik
                </div>
                {topCandidate ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-3xl font-bold">
                          {topCandidate.ticker}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatCurrency(topCandidate.marketData.currentPrice)}
                        </div>
                      </div>
                      <Badge tone={candidateTone[topCandidate.status]}>
                        {candidateStatusLabels[topCandidate.status] ?? topCandidate.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MetricChip label="Skor Setup" value={`${topCandidate.setupScore}/100`} />
                      <MetricChip label="Risk Reward" value={`1:${topCandidate.rr.toFixed(2)}`} />
                      <MetricChip label="Volume" value={`${topCandidate.volumeRatio.toFixed(2)}x`} />
                      <MetricChip label="Tren" value={topCandidate.trend} />
                    </div>
                    <Button
                      className="w-full"
                      variant="accent"
                      onClick={() => void analyzeTicker(topCandidate.ticker)}
                      disabled={analysisLoading}
                    >
                      <Sparkles className="h-4 w-4" />
                      Analisa Kandidat Terbaik
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">
                    Kandidat terbaik akan muncul setelah scanner selesai.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Status Scan
                </div>
                <div className="mt-4 space-y-3 text-xs">
                  <StatusRow label="Universe" value={`${defaultTickerCount} saham`} />
                  <StatusRow label="Kandidat" value={`${scanResults.length}`} />
                  <StatusRow label="Mode" value={scanModeLabels[scanMode]} />
                  <StatusRow label="Aturan" value={scanMode === "day" ? "VWAP/volume/RR 1.2" : scanMode === "swing" ? "EMA20/RR 1.5" : "RR ketat 2.0"} />
                  <StatusRow
                    label="Scan Terakhir"
                    value={
                      scanCompletedAt
                        ? new Date(scanCompletedAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Eye className="h-3.5 w-3.5" />
                  Pantauan Otomatis
                </div>
                <div className="mt-4 space-y-2">
                  {watchlist.length > 0 ? (
                    watchlist.slice(0, 5).map((item) => (
                      <div key={item.ticker} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{item.ticker}</span>
                          <Badge tone={candidateTone[item.status]}>{candidateStatusLabels[item.status] ?? item.status}</Badge>
                        </div>
                        <div className="mt-2 text-zinc-500">{item.trigger}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">
                      Saham PANTAUAN dari scanner akan otomatis muncul di sini.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Bell className="h-3.5 w-3.5" />
                  Alarm Lokal
                </div>
                <div className="mt-4 space-y-2">
                  {alerts.length > 0 ? (
                    alerts.slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{item.ticker}</span>
                          <Badge tone={item.triggeredAt ? "emerald" : "blue"}>
                            {item.triggeredAt ? "BERBUNYI" : "AKTIF"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-zinc-500">{item.targetLabel}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">
                      Klik ikon bel di kartu kandidat untuk memasang alarm.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {analysis && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <Brain className="h-3.5 w-3.5" />
                    AI Manual
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {aiSettings.aiEnabled
                      ? `Provider aktif: ${aiSettings.provider.toUpperCase()}. Keputusan inti tetap deterministic, AI cuma kasih second opinion.`
                      : "AI tidak ikut ke pipeline inti. Pakai prompt ini kalau mau minta second opinion dari ChatGPT/Claude secara manual."}
                  </p>
                  {aiSettings.aiEnabled ? (
                    <Button
                      className="mt-4 w-full"
                      onClick={() => void runAIDirectly()}
                      disabled={aiRunLoading}
                    >
                      {aiRunLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          AI sedang berpikir...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Jalankan AI Sekarang
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="mt-4 w-full"
                      variant="outline"
                      onClick={() => openTextModal("Prompt AI Siap Pakai", exportAIReadyPrompt(analysis))}
                    >
                      <Copy className="h-4 w-4" />
                      Buka Prompt AI
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </aside>
        </section>
        )}

        {analysisLoading && (
          <Card>
            <CardContent className="flex min-h-[180px] items-center justify-center p-8">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-300" />
                <div className="mt-3 text-sm font-semibold">
                  Sedang jalanin pipeline institusi v2
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Data pasar, analis, thesis, keputusan portfolio, sampai layer export.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {analysis && !analysisLoading && (
          <ErrorBoundary sectionName="Hasil Analisa">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Analisa Lengkap
                </div>
                <h2 className="mt-1 text-xl font-semibold">
                  Laporan institusi {analysis.ticker}
                </h2>
              </div>
              <Badge tone={actionTone[analysis.portfolioDecision.action] ?? "neutral"}>
                {actionLabels[analysis.portfolioDecision.action] ?? analysis.portfolioDecision.action}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      <Shield className="h-3.5 w-3.5" />
                      Kualitas Data
                    </div>
                    <Badge tone={healthTone[analysis.dataHealth.status]}>
                      {analysis.dataHealth.score}/100
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MetricChip label="Bar Terakhir" value={analysis.dataHealth.lastUpdate} />
                    <MetricChip label="Jumlah Bar" value={`${analysis.dataHealth.barsCount}`} />
                    <MetricChip label="Sumber" value={analysis.dataHealth.source === "cache" ? "Cache" : "Langsung"} />
                    <MetricChip label="Fundamental" value={analysis.dataHealth.hasFundamental ? "Ada" : "Tidak"} />
                  </div>
                  <div className="mt-3 space-y-1 text-[10px] text-zinc-500">
                    {(analysis.dataHealth.issues.length > 0 ? analysis.dataHealth.issues : ["Tidak ada masalah data yang kritikal."]).slice(0, 4).map((issue) => (
                      <div key={issue}>- {issue}</div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <Target className="h-3.5 w-3.5" />
                    Alasan Keputusan
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-zinc-400">
                    <ExplainRow label="Kenapa belum BUY" value={analysis.decision.finalDecision === "BUY_NOW" ? "Pipeline sudah kasih sinyal BUY_NOW, tapi eksekusi stop harus tetap disiplin." : analysis.decision.keyRisk} />
                    <ExplainRow label="Yang harus membaik" value={buildImprovementText(analysis)} />
                    <ExplainRow label="Setup batal kalau" value={`Turun di bawah stop ${analysis.risk.stopLoss} atau support ${analysis.marketData.support.toFixed(0)}.`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <Shield className="h-3.5 w-3.5" />
                    Sizing Portfolio
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MetricChip label="Saham" value={analysis.risk.ticker.replace(".JK", "")} />
                    <MetricChip label="Budget Risk" value={formatCurrency(analysis.risk.riskBudget)} />
                    <MetricChip label="Lot" value={`${analysis.risk.positionSize.lots}`} />
                    <MetricChip label="Max Loss" value={formatCurrency(analysis.risk.positionSize.maxLoss)} />
                    <MetricChip label="Nilai Posisi" value={formatCurrency(analysis.risk.positionSize.positionValue)} />
                    <MetricChip label="Pemakaian Risk" value={`${portfolioSnapshot.riskUsage.toFixed(0)}%`} />
                  </div>
                  <div className="mt-3 text-[10px] text-zinc-500">
                    {portfolioSnapshot.riskUsage > 80
                      ? "Risiko portfolio sudah padat. Kurangi jumlah setup aktif sebelum tambah posisi baru."
                      : "Risiko portfolio masih ada ruang. Tetap patuhi budget max loss tiap posisi baru."}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      <Brain className="h-3.5 w-3.5" />
                      Second Opinion AI Manual
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Generate prompt, paste jawaban AI balik ke sini, app bakal simpan sebagai perbandingan manual. Keputusan inti tetap deterministic.
                    </p>
                    {currentAiOpinion && (
                      <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                        Opini tersimpan: {currentAiOpinion.text.slice(0, 220)}{currentAiOpinion.text.length > 220 ? "..." : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <textarea
                      value={aiDraft}
                      onChange={(event) => setAiDraft(event.target.value)}
                      placeholder="Paste second opinion AI di sini..."
                      className="min-h-[110px] resize-none rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs text-zinc-200 outline-none"
                    />
                    {aiRunError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                        {aiRunError}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {aiSettings.aiEnabled && (
                        <Button onClick={() => void runAIDirectly()} disabled={aiRunLoading}>
                          {aiRunLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              AI sedang berpikir...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Jalankan AI Sekarang
                            </>
                          )}
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => openTextModal("Prompt AI Siap Pakai", exportAIReadyPrompt(analysis))}>
                        <Copy className="h-4 w-4" />
                        Salin Prompt
                      </Button>
                      <Button onClick={saveAiOpinion} disabled={!aiDraft.trim()}>
                        <ClipboardCheck className="h-4 w-4" />
                        Simpan Opini
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <PipelineViewer
              pipeline={analysis}
              onAnalyzeWithAI={(prompt) => openTextModal("Prompt AI Siap Pakai", prompt)}
            />
          </motion.section>
          </ErrorBoundary>
        )}
        </>
        )}
      </main>

      <TextPreviewModal
        open={Boolean(modalText)}
        title={modalTitle}
        text={modalText}
        onClose={() => setModalText("")}
        downloadName={modalDownloadName}
      />
    </div>
  );
}

