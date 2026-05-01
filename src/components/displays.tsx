/**
 * Display-Only Modules
 *
 * These components ONLY render data. They do NOT:
 * - manage state
 * - fetch data
 * - calculate anything
 * - call AI independently
 *
 * All data comes from the orchestrator.
 */

"use client";

import {
  BookOpen,
  Calculator,
  Crosshair,
  Globe2,
  Telescope,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ConfidenceBadge,
  Metric,
  ModuleHeader,
  RRIndicator,
  SetupScoreBar,
  StatusBadge,
} from "@/components/shared";
import type { AnalysisResult } from "@/lib/orchestrator";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

/**
 * Scanner Display Component
 * Shows setup score, trend, volume, and key reads
 */
export function ScannerDisplay({ analysis }: { analysis: AnalysisResult }) {
  const { scanner } = analysis;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <ModuleHeader
          eyebrow="scanner"
          title="Market Scanner"
          description="Technical setup classification & scoring"
          icon={<Telescope className="h-4 w-4" />}
        />

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Quick Read
            </div>
            <div className="flex items-center gap-1.5">
              <ConfidenceBadge level={scanner.setupScore.confidence} />
              <StatusBadge status={scanner.setupScore.status} />
            </div>
          </div>

          <SetupScoreBar score={scanner.setupScore.total} />

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <ScoreChip label="Trend" value={scanner.setupScore.trend} max={30} />
            <ScoreChip
              label="Momentum"
              value={scanner.setupScore.momentum}
              max={20}
            />
            <ScoreChip label="Volume" value={scanner.setupScore.volume} max={20} />
            <ScoreChip
              label="Context"
              value={scanner.setupScore.context}
              max={20}
            />
            <ScoreChip label="RR" value={scanner.setupScore.rrQuality} max={10} />
            <ScoreChip
              label="Vol vs Avg"
              value={scanner.volumeRatio ? Math.min(scanner.volumeRatio, 5) : 0}
              max={5}
              display={scanner.volumeRatio ? `${scanner.volumeRatio.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : "—"}
            />
          </div>

          <Separator />

          <RRIndicator
            rr={analysis.risk.rr}
            label="Price → Resistance vs Support"
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Risk Display Component
 * Shows entry, stop, target, lot, and max loss
 */
export function RiskDisplay({ analysis }: { analysis: AnalysisResult }) {
  const { risk } = analysis;
  const calc = risk.calc;

  if (!calc) {
    return (
      <Card>
        <CardContent className="p-5">
          <ModuleHeader
            eyebrow="risk"
            title="Risk Management"
            description="Entry, stop, lot, and max loss"
            icon={<Calculator className="h-4 w-4" />}
          />
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
            Risk calculation not available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <ModuleHeader
          eyebrow="risk"
          title="Risk Management"
          description="Entry, stop, lot, and max loss"
          icon={<Calculator className="h-4 w-4" />}
        />

        <Separator />

        <div className="space-y-3">
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
              hint={formatPercent(calc.downsidePct)}
            />
            <Metric
              label="TP1"
              value={formatNumber(calc.takeProfit1, 0)}
              tone="emerald"
              hint={`+${formatPercent(calc.upsidePct1)} · RR ${calc.riskReward1.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Metric
              label="TP2"
              value={formatNumber(calc.takeProfit2, 0)}
              tone="emerald"
              hint={`+${formatPercent(calc.upsidePct2)} · RR ${calc.riskReward2.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Context Display Component
 * Shows market regime and macro context
 */
export function ContextDisplay({ analysis }: { analysis: AnalysisResult }) {
  const { context } = analysis;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <ModuleHeader
          eyebrow="context"
          title="Market Context"
          description="Macro & sector regime read"
          icon={<Globe2 className="h-4 w-4" />}
        />

        <Separator />

        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            Market Regime
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Suggested Stance
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {context.regime}
              </div>
            </div>
            <ConfidenceBadge
              level={
                context.regime === "AGGRESSIVE"
                  ? "HIGH"
                  : context.regime === "DEFENSIVE"
                  ? "LOW"
                  : "MEDIUM"
              }
            />
          </div>

          <Separator />

          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            IHSG Context
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <ContextItem label="Trend" value={context.ihsgTrend} />
            <ContextItem
              label="1D Change"
              value={
                context.ihsgChange1d !== undefined
                  ? (context.ihsgChange1d >= 0 ? "+" : "") + formatPercent(context.ihsgChange1d)
                  : "—"
              }
            />
            <ContextItem
              label="5D Change"
              value={
                context.ihsgChange5d !== undefined
                  ? (context.ihsgChange5d >= 0 ? "+" : "") + formatPercent(context.ihsgChange5d)
                  : "—"
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Decision Display Component
 * Shows final verdict and reasoning
 */
export function DecisionDisplay({ analysis }: { analysis: AnalysisResult }) {
  const { decision, risk, scanner } = analysis;

  const verdictColor = {
    BUY_NOW: "text-emerald-300",
    WAIT: "text-amber-300",
    WATCHLIST: "text-blue-300",
    REJECT: "text-red-300",
  }[decision.verdict];

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <ModuleHeader
          eyebrow="decision"
          title="Trade Decision"
          description="Final BUY / WAIT / REJECT verdict"
          icon={<Crosshair className="h-4 w-4" />}
        />

        <Separator />

        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            Final Verdict
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4 text-center">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Based on Score, RR, and Market Context
            </div>
            <div className={`mt-2 text-3xl font-bold tracking-tight ${verdictColor}`}>
              {decision.verdict.replace("_", " ")}
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              {decision.reasoning}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Setup Score"
              value={`${scanner.setupScore.total}`}
              tone="blue"
            />
            <Metric
              label="RR"
              value={`1:${risk.rr.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              tone={risk.rr >= 2 ? "emerald" : "amber"}
            />
            <Metric
              label="Confidence"
              value={decision.confidence}
              tone={
                decision.confidence === "HIGH"
                  ? "emerald"
                  : decision.confidence === "MEDIUM"
                  ? "blue"
                  : "amber"
              }
            />
            <Metric label="Regime" value={analysis.context.regime} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Journal Display Component
 * Shows trade evaluation (placeholder for now)
 */
export function JournalDisplay() {
  return (
    <Card>
      <CardContent className="p-5">
        <ModuleHeader
          eyebrow="journal"
          title="Trade Journal"
          description="Post-trade evaluation"
          icon={<BookOpen className="h-4 w-4" />}
        />
        <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
          Journal available after trade completion
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Helper components
 */
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
  const tone =
    pct >= 75 ? "emerald" : pct >= 50 ? "blue" : pct >= 25 ? "amber" : "red";
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

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-2">
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 truncate font-medium text-zinc-200">
        {value}
      </div>
    </div>
  );
}
