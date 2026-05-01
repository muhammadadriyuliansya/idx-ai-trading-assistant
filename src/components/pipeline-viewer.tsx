"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Metric } from "@/components/shared";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { AnalysisPipeline } from "@/pipeline/types";

interface PipelineViewerProps {
  pipeline: AnalysisPipeline;
}

export function PipelineViewer({ pipeline }: PipelineViewerProps) {
  const { scanner, risk, context, debate, decision, finalScore } = pipeline;

  const verdictColor = {
    "BUY_NOW": "emerald",
    "WAIT": "blue",
    "WATCHLIST": "amber",
    "REJECT": "red",
  } as const;

  const confidenceColor = {
    HIGH: "emerald",
    MEDIUM: "blue",
    LOW: "red",
  } as const;

  return (
    <div className="space-y-4">
      {/* Final Decision Card */}
      <Card className="border-2 border-zinc-800/80 bg-zinc-950/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                Final Decision
              </div>
              <div className="text-3xl font-bold mt-1">
                {decision.finalDecision}
              </div>
            </div>
            <div className="text-right">
              <Badge tone={verdictColor[decision.finalDecision]}>
                {decision.confidenceScore}/100
              </Badge>
              <div className="text-[10px] text-zinc-500 mt-1">
                Success: {decision.successProbability}%
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Key Edge"
              value={decision.keyEdge}
              tone="emerald"
            />
            <Metric label="Key Risk" value={decision.keyRisk} tone="red" />
          </div>

          <div className="mt-4 p-3 rounded-xl bg-zinc-900/50">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Reasoning
            </div>
            <p className="text-sm text-zinc-300">{decision.reasoning}</p>
          </div>
        </CardContent>
      </Card>

      {/* Scanner Results */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Scanner Analysis
            </div>
            <Badge tone={confidenceColor[scanner.confidence]}>
              {scanner.confidence}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Metric
              label="Setup Score"
              value={`${scanner.setupScore}/100`}
              tone={scanner.setupScore >= 70 ? "emerald" : scanner.setupScore >= 50 ? "blue" : "red"}
            />
            <Metric
              label="Setup Type"
              value={scanner.setupType}
              tone="neutral"
            />
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Key Reads
            </div>
            <ul className="space-y-1">
              {scanner.keyReads.map((read, i) => (
                <li
                  key={i}
                  className="text-xs text-zinc-300 flex items-start gap-2"
                >
                  <span className="text-zinc-500">•</span>
                  {read}
                </li>
              ))}
            </ul>
          </div>

          {scanner.warnings.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-red-500">
                Warnings
              </div>
              <ul className="space-y-1">
                {scanner.warnings.map((warning, i) => (
                  <li
                    key={i}
                    className="text-xs text-red-300 flex items-start gap-2"
                  >
                    <span className="text-red-500">⚠</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Risk Management
            </div>
            <Badge
              tone={
                risk.verdict === "ACCEPT"
                  ? "emerald"
                  : risk.verdict === "ADJUST"
                  ? "amber"
                  : "red"
              }
            >
              {risk.verdict}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Metric label="Entry Zone" value={risk.entryZone} tone="blue" />
            <Metric label="Stop Loss" value={risk.stopLoss} tone="red" />
            <Metric label="TP1" value={risk.tp1} tone="emerald" />
            <Metric label="TP2" value={risk.tp2} tone="emerald" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Metric
              label="RR to TP1"
              value={`1:${risk.rr1.toFixed(2)}`}
              tone={risk.rr1 >= 2 ? "emerald" : "amber"}
            />
            <Metric
              label="RR to TP2"
              value={`1:${risk.rr2.toFixed(2)}`}
              tone="emerald"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Position Size"
              value={`${risk.positionSize.lots} lot`}
              hint={`${formatNumber(risk.positionSize.shares)} shares`}
            />
            <Metric
              label="Max Loss"
              value={formatCurrency(risk.positionSize.maxLoss)}
              tone="red"
            />
          </div>
        </CardContent>
      </Card>

      {/* Market Context */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Market Context
            </div>
            <Badge
              tone={
                context.marketRegime === "AGGRESSIVE"
                  ? "emerald"
                  : context.marketRegime === "NORMAL"
                  ? "blue"
                  : "red"
              }
            >
              {context.marketRegime}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Metric
              label="Risk Stance"
              value={context.riskStance}
              tone="neutral"
            />
            <Metric
              label="Strategy Bias"
              value={context.strategyBias}
              tone="neutral"
            />
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Key Risks
            </div>
            <ul className="space-y-1">
              {context.keyRisks.map((risk, i) => (
                <li
                  key={i}
                  className="text-xs text-zinc-300 flex items-start gap-2"
                >
                  <span className="text-zinc-500">•</span>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Debate Results */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Internal Debate
            </div>
            <Badge
              tone={
                debate.consensus === "BULLISH"
                  ? "emerald"
                  : debate.consensus === "BEARISH"
                  ? "red"
                  : "blue"
              }
            >
              {debate.consensus}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-500 mb-2">
                Bullish Arguments ({debate.bullishArguments.length})
              </div>
              <ul className="space-y-1">
                {debate.bullishArguments.map((arg, i) => (
                  <li
                    key={i}
                    className="text-xs text-emerald-300 flex items-start gap-2"
                  >
                    <span className="text-emerald-500">↑</span>
                    {arg}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-500 mb-2">
                Bearish Arguments ({debate.bearishArguments.length})
              </div>
              <ul className="space-y-1">
                {debate.bearishArguments.map((arg, i) => (
                  <li
                    key={i}
                    className="text-xs text-red-300 flex items-start gap-2"
                  >
                    <span className="text-red-500">↓</span>
                    {arg}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Key Factors
            </div>
            <ul className="space-y-1">
              {debate.keyFactors.map((factor, i) => (
                <li
                  key={i}
                  className="text-xs text-zinc-300 flex items-start gap-2"
                >
                  <span className="text-zinc-500">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Final Score */}
      <Card className="bg-gradient-to-br from-zinc-950 to-zinc-900">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                Final Score
              </div>
              <div className="text-4xl font-bold mt-1">{finalScore}/100</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-500">Overall Quality</div>
              <div className="text-sm font-semibold mt-1">
                {finalScore >= 75
                  ? "Excellent"
                  : finalScore >= 60
                  ? "Good"
                  : finalScore >= 45
                  ? "Fair"
                  : "Poor"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
