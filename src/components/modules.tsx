"use client";

import {
  BookOpen,
  Calculator,
  Crosshair,
  Globe2,
  Loader2,
  Save,
  Sparkles,
  Telescope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AIOutputPanel,
  ConfidenceBadge,
  type FieldDef,
  InputGrid,
  Metric,
  ModuleHeader,
  PromptEditor,
  RRIndicator,
  SetupScoreBar,
  StatusBadge,
} from "@/components/shared";
import { generateAnalysis } from "@/lib/ai";
import {
  calculateRiskReward,
  calculateSetupScore,
  computeRisk,
  volumeRatio,
} from "@/lib/calc";
import {
  buildContextUserPrompt,
  buildDecisionUserPrompt,
  buildJournalUserPrompt,
  buildRiskUserPrompt,
  buildScannerUserPrompt,
  SYSTEM_PROMPTS,
} from "@/lib/prompts";
import { STORAGE_KEYS, useLocalStorage } from "@/lib/storage";
import type {
  AISettings,
  ContextInput,
  DecisionInput,
  JournalInput,
  ModuleKey,
  RiskInput,
  SavedSetup,
  ScannerInput,
} from "@/lib/types";
import { formatCurrency, formatNumber, toNumber } from "@/lib/utils";

const SCANNER_DEFAULTS: ScannerInput = {
  ticker: "",
  currentPrice: "",
  open: "",
  high: "",
  low: "",
  previousClose: "",
  todayVolume: "",
  avgVolume20d: "",
  ema20: "",
  ema50: "",
  ema200: "",
  vwap: "",
  rsi: "",
  macd: "",
  stochastic: "",
  foreignFlow: "",
  brokerAccumulation: "",
  ihsgTrend: "",
  sectorStrength: "",
  resistance: "",
  support: "",
};

const RISK_DEFAULTS: RiskInput = {
  ticker: "",
  currentPrice: "",
  support: "",
  resistance: "",
  atr: "",
  capital: "",
  riskPerTrade: "1",
};

const CONTEXT_DEFAULTS: ContextInput = {
  ihsgTrend: "",
  foreignFlow: "",
  usMarket: "",
  commodityTrend: "",
  interestRate: "",
  usdIdr: "",
  sector: "",
  sectorStrength: "",
};

const DECISION_DEFAULTS: DecisionInput = {
  ticker: "",
  setupScore: "",
  confidence: "",
  trend: "",
  volume: "",
  momentum: "",
  marketContext: "",
  riskReward: "",
  entry: "",
  stopLoss: "",
  target: "",
};

const JOURNAL_DEFAULTS: JournalInput = {
  ticker: "",
  entry: "",
  exit: "",
  stopLoss: "",
  target: "",
  result: "",
  holdingTime: "",
  entryReason: "",
  marketCondition: "",
  emotion: "",
};

const SCANNER_FIELDS: FieldDef<keyof ScannerInput>[] = [
  { key: "ticker", label: "Ticker", placeholder: "BBRI" },
  { key: "currentPrice", label: "Current Price", type: "number" },
  { key: "open", label: "Open", type: "number" },
  { key: "high", label: "High", type: "number" },
  { key: "low", label: "Low", type: "number" },
  { key: "previousClose", label: "Prev Close", type: "number" },
  { key: "todayVolume", label: "Today Volume", type: "number" },
  { key: "avgVolume20d", label: "Avg Volume 20D", type: "number" },
  { key: "ema20", label: "EMA20", type: "number" },
  { key: "ema50", label: "EMA50", type: "number" },
  { key: "ema200", label: "EMA200", type: "number" },
  { key: "vwap", label: "VWAP", type: "number" },
  { key: "rsi", label: "RSI", type: "number" },
  { key: "macd", label: "MACD", placeholder: "bullish cross / bearish / netral" },
  { key: "stochastic", label: "Stochastic", placeholder: "70/55, oversold, overbought" },
  { key: "foreignFlow", label: "Foreign Flow", placeholder: "inflow / outflow / netral" },
  { key: "brokerAccumulation", label: "Broker Accumulation", placeholder: "RG, MG, BR akumulasi" },
  { key: "ihsgTrend", label: "IHSG Trend", placeholder: "bullish / sideways / bearish" },
  { key: "sectorStrength", label: "Sector Strength", placeholder: "leading / netral / laggard" },
  { key: "support", label: "Support", type: "number" },
  { key: "resistance", label: "Resistance", type: "number" },
];

const RISK_FIELDS: FieldDef<keyof RiskInput>[] = [
  { key: "ticker", label: "Ticker", placeholder: "BBRI" },
  { key: "currentPrice", label: "Current Price", type: "number" },
  { key: "support", label: "Support", type: "number" },
  { key: "resistance", label: "Resistance", type: "number" },
  { key: "atr", label: "ATR", type: "number", hint: "Daily ATR (boleh kosong)" },
  { key: "capital", label: "Trading Capital (Rp)", type: "number", hint: "Modal trading aktif" },
  { key: "riskPerTrade", label: "Risk Per Trade (%)", type: "number", hint: "Biasanya 0.5–2%" },
];

const CONTEXT_FIELDS: FieldDef<keyof ContextInput>[] = [
  { key: "ihsgTrend", label: "IHSG Trend", placeholder: "bullish / sideways / bearish" },
  { key: "foreignFlow", label: "Foreign Flow IHSG", placeholder: "inflow Rp xx M / outflow" },
  { key: "usMarket", label: "US Market", placeholder: "S&P bullish / Nasdaq pullback" },
  { key: "commodityTrend", label: "Commodity Trend", placeholder: "CPO naik, batubara turun" },
  { key: "interestRate", label: "Interest Rate Trend", placeholder: "BI rate hold / cut" },
  { key: "usdIdr", label: "USD/IDR", type: "number" },
  { key: "sector", label: "Sector", placeholder: "Banking, Tech, Energy" },
  { key: "sectorStrength", label: "Sector Strength", placeholder: "leading / netral / laggard" },
];

const DECISION_FIELDS: FieldDef<keyof DecisionInput>[] = [
  { key: "ticker", label: "Ticker", placeholder: "BBRI" },
  { key: "setupScore", label: "Setup Score", type: "number" },
  { key: "confidence", label: "Confidence", placeholder: "LOW / MEDIUM / HIGH" },
  { key: "trend", label: "Trend Read", placeholder: "bullish above EMA20" },
  { key: "volume", label: "Volume Read", placeholder: "2.3x avg, akumulasi" },
  { key: "momentum", label: "Momentum", placeholder: "RSI 62, MACD bull cross" },
  { key: "marketContext", label: "Market Context", placeholder: "risk-on, banking lead" },
  { key: "riskReward", label: "Risk Reward", type: "number" },
  { key: "entry", label: "Entry", type: "number" },
  { key: "stopLoss", label: "Stop Loss", type: "number" },
  { key: "target", label: "Target", type: "number" },
];

const JOURNAL_FIELDS: FieldDef<keyof JournalInput>[] = [
  { key: "ticker", label: "Ticker", placeholder: "BBRI" },
  { key: "entry", label: "Entry", type: "number" },
  { key: "exit", label: "Exit", type: "number" },
  { key: "stopLoss", label: "Stop Loss", type: "number" },
  { key: "target", label: "Target", type: "number" },
  { key: "result", label: "Result (% / Rp)", placeholder: "+3.2% / -1.5%" },
  { key: "holdingTime", label: "Holding Time", placeholder: "2 hari / intraday" },
  { key: "entryReason", label: "Entry Reason", placeholder: "Breakout resistance + volume", span: 2 },
  { key: "marketCondition", label: "Market Condition", placeholder: "IHSG bullish, banking lead", span: 2 },
  { key: "emotion", label: "Emotion", placeholder: "calm / FOMO / greedy / fearful", span: 2 },
];

interface ModuleShellProps {
  module: ModuleKey;
  settings: AISettings;
  prompt: string;
  onPromptChange: (value: string) => void;
  onResetPrompt: () => void;
  buildUserPrompt: () => string;
  ticker: string;
  payload: unknown;
  leftTitle: string;
  leftDescription: string;
  leftIcon: React.ReactNode;
  inputs: React.ReactNode;
  rightPanel?: React.ReactNode;
  generateLabel?: string;
}

function ModuleShell({
  module,
  settings,
  prompt,
  onPromptChange,
  onResetPrompt,
  buildUserPrompt,
  ticker,
  payload,
  leftTitle,
  leftDescription,
  leftIcon,
  inputs,
  rightPanel,
  generateLabel = "Generate Analysis",
}: ModuleShellProps) {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSetups, setSavedSetups] = useLocalStorage<SavedSetup[]>(
    STORAGE_KEYS.setups,
    [],
  );
  const [justSaved, setJustSaved] = useState(false);
  const [modelLabel, setModelLabel] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setOutput("");
    try {
      const userPrompt = buildUserPrompt();
      const result = await generateAnalysis({
        module,
        system: prompt,
        user: userPrompt,
        settings,
      });
      setOutput(result.text);
      setModelLabel(`${result.provider} · ${result.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const setup: SavedSetup = {
      id: `${module}-${Date.now()}`,
      module,
      ticker: ticker || module.toUpperCase(),
      createdAt: Date.now(),
      payload,
      output,
    };
    setSavedSetups((prev) => [setup, ...prev].slice(0, 50));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      {/* LEFT: input form */}
      <Card className="xl:col-span-4">
        <CardContent className="p-5 space-y-4">
          <ModuleHeader
            eyebrow={module}
            title={leftTitle}
            description={leftDescription}
            icon={leftIcon}
          />
          {inputs}
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const userPrompt = buildUserPrompt();
                navigator.clipboard.writeText(`${prompt}\n\n${userPrompt}`).catch(() => {});
              }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Copy Full Prompt
            </Button>
            <Button onClick={handleGenerate} disabled={loading} variant="accent">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {generateLabel}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CENTER: AI output + prompt editor */}
      <div className="xl:col-span-5 space-y-4">
        <AIOutputPanel
          output={output}
          loading={loading}
          error={error}
          modelLabel={loading ? "thinking…" : modelLabel}
          emptyHint={`Klik ${generateLabel} untuk dapet analisis hedge-fund-grade.`}
          onSave={handleSave}
          saved={justSaved}
        />
        <PromptEditor
          value={prompt}
          onChange={onPromptChange}
          onReset={onResetPrompt}
        />
      </div>

      {/* RIGHT: contextual summary */}
      <div className="xl:col-span-3 space-y-4">
        {rightPanel}
        <SavedSetupsList
          setups={savedSetups.filter((s) => s.module === module).slice(0, 5)}
        />
      </div>
    </div>
  );
}

function SavedSetupsList({ setups }: { setups: SavedSetup[] }) {
  if (setups.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            Saved Setups
          </div>
          <div className="mt-3 rounded-xl border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500">
            Belum ada setup tersimpan.
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            Saved Setups
          </div>
          <Save className="h-3.5 w-3.5 text-zinc-500" />
        </div>
        <ul className="space-y-2">
          {setups.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">
                  {s.ticker.toUpperCase()}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {new Date(s.createdAt).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              {s.output && (
                <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                  {s.output.slice(0, 160)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

interface BaseModuleProps {
  settings: AISettings;
}

function usePrompt(key: ModuleKey) {
  const [prompts, setPrompts] = useLocalStorage<Partial<Record<ModuleKey, string>>>(
    STORAGE_KEYS.prompts,
    {},
  );
  const value = prompts[key] ?? SYSTEM_PROMPTS[key];
  const setValue = (next: string) =>
    setPrompts((prev) => ({ ...prev, [key]: next }));
  const reset = () =>
    setPrompts((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  return [value, setValue, reset] as const;
}

export function ScannerModule({ settings }: BaseModuleProps) {
  const [input, setInput] = useLocalStorage<ScannerInput>(
    STORAGE_KEYS.scanner,
    SCANNER_DEFAULTS,
  );
  const [prompt, setPrompt, resetPrompt] = usePrompt("scanner");

  const setField = (key: keyof ScannerInput, value: string) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const support = toNumber(input.support);
  const resistance = toNumber(input.resistance);
  const price = toNumber(input.currentPrice);
  const rr =
    Number.isFinite(price) && Number.isFinite(support) && Number.isFinite(resistance)
      ? calculateRiskReward(price, support, resistance)
      : 0;

  const score = useMemo(() => calculateSetupScore(input, rr), [input, rr]);
  const volRatio = volumeRatio(input);

  return (
    <ModuleShell
      module="scanner"
      settings={settings}
      prompt={prompt}
      onPromptChange={setPrompt}
      onResetPrompt={resetPrompt}
      buildUserPrompt={() => buildScannerUserPrompt(input, score)}
      ticker={input.ticker}
      payload={{ input, score }}
      leftTitle="Market Scanner"
      leftDescription="Input data teknikal — AI klasifikasi setup, volume read, dan warning."
      leftIcon={<Telescope className="h-4 w-4" />}
      inputs={
        <InputGrid
          fields={SCANNER_FIELDS}
          values={input as unknown as Record<string, string>}
          onChange={(k, v) => setField(k as keyof ScannerInput, v)}
        />
      }
      rightPanel={
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                Quick Read
              </div>
              <div className="flex items-center gap-1.5">
                <ConfidenceBadge level={score.confidence} />
                <StatusBadge status={score.status} />
              </div>
            </div>
            <SetupScoreBar score={score.total} />
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <ScoreChip label="Trend" value={score.trend} max={30} />
              <ScoreChip label="Momentum" value={score.momentum} max={20} />
              <ScoreChip label="Volume" value={score.volume} max={20} />
              <ScoreChip label="Context" value={score.context} max={20} />
              <ScoreChip label="RR" value={score.rrQuality} max={10} />
              <ScoreChip
                label="Vol vs Avg"
                value={volRatio ? Math.min(volRatio, 5) : 0}
                max={5}
                display={volRatio ? `${volRatio.toFixed(2)}x` : "—"}
              />
            </div>
            <Separator />
            <RRIndicator rr={rr} label="Price → Resistance vs Support" />
          </CardContent>
        </Card>
      }
    />
  );
}

function ScoreChip({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
}) {
  const pct = (value / max) * 100;
  const tone = pct >= 75 ? "emerald" : pct >= 50 ? "blue" : pct >= 25 ? "amber" : "red";
  const toneClass = {
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-300 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    red: "text-red-300 bg-red-500/10 border-red-500/20",
  }[tone];
  return (
    <div className={`rounded-xl border ${toneClass} px-2.5 py-1.5`}>
      <div className="text-[9px] uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold">
        {display ?? `${Math.round(value)}/${max}`}
      </div>
    </div>
  );
}

export function RiskModule({ settings }: BaseModuleProps) {
  const [input, setInput] = useLocalStorage<RiskInput>(
    STORAGE_KEYS.risk,
    RISK_DEFAULTS,
  );
  const [prompt, setPrompt, resetPrompt] = usePrompt("risk");

  const setField = (key: keyof RiskInput, value: string) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const calc = useMemo(() => computeRisk(input), [input]);

  return (
    <ModuleShell
      module="risk"
      settings={settings}
      prompt={prompt}
      onPromptChange={setPrompt}
      onResetPrompt={resetPrompt}
      buildUserPrompt={() => buildRiskUserPrompt(input, calc)}
      ticker={input.ticker}
      payload={{ input, calc }}
      leftTitle="Risk Management"
      leftDescription="Hitung entry, stop, target, lot, dan max loss. AI validasi & adjust kalau perlu."
      leftIcon={<Calculator className="h-4 w-4" />}
      inputs={
        <InputGrid
          fields={RISK_FIELDS}
          values={input as unknown as Record<string, string>}
          onChange={(k, v) => setField(k as keyof RiskInput, v)}
        />
      }
      rightPanel={
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Trade Plan
            </div>
            {!calc ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                Lengkapi modal, support, resistance untuk lihat plan.
              </div>
            ) : (
              <>
                <RRIndicator rr={calc.riskReward1} label="RR ke TP1" />
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label="Entry"
                    value={formatNumber(calc.entry, 0)}
                    tone="blue"
                  />
                  <Metric
                    label="Stop Loss"
                    value={formatNumber(calc.stopLoss, 0)}
                    tone="red"
                    hint={`${calc.downsidePct.toFixed(2)}%`}
                  />
                  <Metric
                    label="TP1"
                    value={formatNumber(calc.takeProfit1, 0)}
                    tone="emerald"
                    hint={`+${calc.upsidePct1.toFixed(2)}% · RR ${calc.riskReward1.toFixed(2)}`}
                  />
                  <Metric
                    label="TP2"
                    value={formatNumber(calc.takeProfit2, 0)}
                    tone="emerald"
                    hint={`+${calc.upsidePct2.toFixed(2)}% · RR ${calc.riskReward2.toFixed(2)}`}
                  />
                  <Metric
                    label="Position"
                    value={`${calc.lots} lot`}
                    hint={`${formatNumber(calc.shares)} shares`}
                  />
                  <Metric
                    label="Max Loss"
                    value={formatCurrency(calc.maxLoss)}
                    tone="red"
                  />
                </div>
                <Separator />
                <Metric
                  label="Position Value"
                  value={formatCurrency(calc.positionValue)}
                  tone="neutral"
                />
              </>
            )}
          </CardContent>
        </Card>
      }
      generateLabel="Validate Plan"
    />
  );
}

export function ContextModule({ settings }: BaseModuleProps) {
  const [input, setInput] = useLocalStorage<ContextInput>(
    STORAGE_KEYS.context,
    CONTEXT_DEFAULTS,
  );
  const [prompt, setPrompt, resetPrompt] = usePrompt("context");

  const setField = (key: keyof ContextInput, value: string) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const regimeHint = useMemo(() => {
    const ihsg = input.ihsgTrend.toLowerCase();
    const flow = input.foreignFlow.toLowerCase();
    if (ihsg.includes("bull") && (flow.includes("inflow") || flow.includes("masuk")))
      return { label: "AGGRESSIVE", tone: "emerald" as const };
    if (ihsg.includes("bear") || flow.includes("outflow"))
      return { label: "DEFENSIVE", tone: "red" as const };
    if (ihsg.includes("side") || ihsg) return { label: "NORMAL", tone: "blue" as const };
    return { label: "—", tone: "neutral" as const };
  }, [input]);

  return (
    <ModuleShell
      module="context"
      settings={settings}
      prompt={prompt}
      onPromptChange={setPrompt}
      onResetPrompt={resetPrompt}
      buildUserPrompt={() => buildContextUserPrompt(input)}
      ticker="IHSG"
      payload={input}
      leftTitle="Market Context"
      leftDescription="Macro & sector read. Apakah hari ini cocok aggressive trade atau wajib defensive."
      leftIcon={<Globe2 className="h-4 w-4" />}
      inputs={
        <InputGrid
          fields={CONTEXT_FIELDS}
          values={input as unknown as Record<string, string>}
          onChange={(k, v) => setField(k as keyof ContextInput, v)}
        />
      }
      rightPanel={
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Regime Hint
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Suggested Stance
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {regimeHint.label}
                </div>
              </div>
              <ConfidenceBadge level={regimeHint.label === "AGGRESSIVE" ? "HIGH" : regimeHint.label === "DEFENSIVE" ? "LOW" : "MEDIUM"} />
            </div>
            <Separator />
            <ContextSnapshot input={input} />
          </CardContent>
        </Card>
      }
      generateLabel="Read Market"
    />
  );
}

function ContextSnapshot({ input }: { input: ContextInput }) {
  const items = [
    { label: "IHSG", value: input.ihsgTrend || "—" },
    { label: "Flow", value: input.foreignFlow || "—" },
    { label: "US Mkt", value: input.usMarket || "—" },
    { label: "Komoditas", value: input.commodityTrend || "—" },
    { label: "Rate", value: input.interestRate || "—" },
    { label: "USD/IDR", value: input.usdIdr || "—" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-2 text-[11px]">
      {items.map((it) => (
        <li
          key={it.label}
          className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-2"
        >
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">
            {it.label}
          </div>
          <div className="mt-0.5 truncate font-medium text-zinc-200">
            {it.value}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DecisionModule({ settings }: BaseModuleProps) {
  const [input, setInput] = useLocalStorage<DecisionInput>(
    STORAGE_KEYS.decision,
    DECISION_DEFAULTS,
  );
  const [prompt, setPrompt, resetPrompt] = usePrompt("decision");

  const setField = (key: keyof DecisionInput, value: string) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const score = toNumber(input.setupScore);
  const rr = toNumber(input.riskReward);

  const verdictHint = useMemo(() => {
    if (Number.isFinite(score) && score >= 75 && Number.isFinite(rr) && rr >= 2)
      return "BUY NOW";
    if (Number.isFinite(score) && score >= 60) return "WATCHLIST";
    if (Number.isFinite(score) && score >= 45) return "WAIT";
    if (Number.isFinite(score)) return "REJECT";
    return "—";
  }, [score, rr]);

  return (
    <ModuleShell
      module="decision"
      settings={settings}
      prompt={prompt}
      onPromptChange={setPrompt}
      onResetPrompt={resetPrompt}
      buildUserPrompt={() => buildDecisionUserPrompt(input)}
      ticker={input.ticker}
      payload={input}
      leftTitle="Trade Decision Engine"
      leftDescription="Gabungkan setup, RR, market context. Output: BUY NOW / WAIT / WATCHLIST / REJECT."
      leftIcon={<Crosshair className="h-4 w-4" />}
      inputs={
        <InputGrid
          fields={DECISION_FIELDS}
          values={input as unknown as Record<string, string>}
          onChange={(k, v) => setField(k as keyof DecisionInput, v)}
        />
      }
      rightPanel={
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Quick Verdict
            </div>
            <motion.div
              key={verdictHint}
              initial={{ scale: 0.96, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 text-center"
            >
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Heuristic
              </div>
              <div className="mt-1 text-3xl font-bold tracking-tight">
                {verdictHint}
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">
                Berdasar Score & RR — final keputusan tetap dari AI panel.
              </div>
            </motion.div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <Metric
                label="Setup Score"
                value={Number.isFinite(score) ? `${score}` : "—"}
                tone="blue"
              />
              <Metric
                label="RR"
                value={Number.isFinite(rr) ? `1:${rr.toFixed(2)}` : "—"}
                tone={Number.isFinite(rr) && rr >= 2 ? "emerald" : "amber"}
              />
              <Metric label="Entry" value={input.entry || "—"} />
              <Metric label="Stop" value={input.stopLoss || "—"} tone="red" />
            </div>
          </CardContent>
        </Card>
      }
      generateLabel="Final Verdict"
    />
  );
}

export function JournalModule({ settings }: BaseModuleProps) {
  const [input, setInput] = useLocalStorage<JournalInput>(
    STORAGE_KEYS.journal,
    JOURNAL_DEFAULTS,
  );
  const [prompt, setPrompt, resetPrompt] = usePrompt("journal");
  const [trades, setTrades] = useLocalStorage<JournalInput[]>(STORAGE_KEYS.trades, []);

  const setField = (key: keyof JournalInput, value: string) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const entry = toNumber(input.entry);
  const exit = toNumber(input.exit);
  const stop = toNumber(input.stopLoss);
  const target = toNumber(input.target);
  const realized =
    Number.isFinite(entry) && Number.isFinite(exit) && entry > 0
      ? ((exit - entry) / entry) * 100
      : NaN;
  const plannedRR =
    Number.isFinite(entry) && Number.isFinite(stop) && Number.isFinite(target)
      ? calculateRiskReward(entry, stop, target)
      : NaN;

  const handleSaveTrade = () => {
    if (!input.ticker) return;
    setTrades((prev) => [input, ...prev].slice(0, 200));
  };

  return (
    <ModuleShell
      module="journal"
      settings={settings}
      prompt={prompt}
      onPromptChange={setPrompt}
      onResetPrompt={resetPrompt}
      buildUserPrompt={() => buildJournalUserPrompt(input)}
      ticker={input.ticker}
      payload={input}
      leftTitle="Trade Journal"
      leftDescription="Log trade selesai. AI evaluasi execution, FOMO, discipline, lessons."
      leftIcon={<BookOpen className="h-4 w-4" />}
      inputs={
        <div className="space-y-3">
          <InputGrid
            fields={JOURNAL_FIELDS}
            values={input as unknown as Record<string, string>}
            onChange={(k, v) => setField(k as keyof JournalInput, v)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveTrade}
          >
            <Save className="h-3.5 w-3.5" /> Save Trade ke History
          </Button>
        </div>
      }
      rightPanel={
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Trade Recap
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric
                label="Realized P/L"
                value={
                  Number.isFinite(realized)
                    ? `${realized.toFixed(2)}%`
                    : "—"
                }
                tone={
                  Number.isFinite(realized)
                    ? realized > 0
                      ? "emerald"
                      : realized < 0
                      ? "red"
                      : "neutral"
                    : "neutral"
                }
              />
              <Metric
                label="Planned RR"
                value={
                  Number.isFinite(plannedRR)
                    ? `1:${plannedRR.toFixed(2)}`
                    : "—"
                }
                tone="blue"
              />
              <Metric label="Entry" value={input.entry || "—"} />
              <Metric label="Exit" value={input.exit || "—"} />
            </div>
            <Separator />
            <RecentTrades trades={trades.slice(0, 5)} />
          </CardContent>
        </Card>
      }
      generateLabel="Coach Me"
    />
  );
}

function RecentTrades({ trades }: { trades: JournalInput[] }) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500">
        Belum ada trade tersimpan.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
        Recent Trades
      </div>
      <ul className="space-y-2">
        {trades.map((t, idx) => {
          const e = toNumber(t.entry);
          const x = toNumber(t.exit);
          const pnl =
            Number.isFinite(e) && Number.isFinite(x) && e > 0
              ? ((x - e) / e) * 100
              : NaN;
          return (
            <li
              key={`${t.ticker}-${idx}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2"
            >
              <span className="font-mono text-xs font-semibold">
                {t.ticker.toUpperCase() || "—"}
              </span>
              <span
                className={
                  Number.isFinite(pnl)
                    ? pnl > 0
                      ? "text-xs font-semibold text-emerald-300"
                      : pnl < 0
                      ? "text-xs font-semibold text-red-300"
                      : "text-xs text-zinc-300"
                    : "text-xs text-zinc-500"
                }
              >
                {Number.isFinite(pnl) ? `${pnl.toFixed(2)}%` : t.result || "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const MODULE_META: Record<
  ModuleKey,
  { label: string; description: string; icon: React.ReactNode; render: (props: { settings: AISettings }) => React.ReactNode }
> = {
  scanner: {
    label: "Market Scanner",
    description: "Setup classification & scoring",
    icon: <Telescope className="h-4 w-4" />,
    render: (props) => <ScannerModule {...props} />,
  },
  risk: {
    label: "Risk Management",
    description: "Entry, stop, lot, max loss",
    icon: <Calculator className="h-4 w-4" />,
    render: (props) => <RiskModule {...props} />,
  },
  context: {
    label: "Market Context",
    description: "Macro & sector regime read",
    icon: <Globe2 className="h-4 w-4" />,
    render: (props) => <ContextModule {...props} />,
  },
  decision: {
    label: "Decision Engine",
    description: "Final BUY / WAIT / REJECT",
    icon: <Crosshair className="h-4 w-4" />,
    render: (props) => <DecisionModule {...props} />,
  },
  journal: {
    label: "Trade Journal",
    description: "Post-trade evaluation",
    icon: <BookOpen className="h-4 w-4" />,
    render: (props) => <JournalModule {...props} />,
  },
};

export const MODULE_ORDER: ModuleKey[] = [
  "scanner",
  "risk",
  "context",
  "decision",
  "journal",
];


