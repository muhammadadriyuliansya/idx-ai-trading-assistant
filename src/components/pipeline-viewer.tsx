"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Metric } from "@/components/shared";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { AnalysisPipeline } from "@/pipeline/types";

interface PipelineViewerProps {
  pipeline: AnalysisPipeline;
  ticker: string;                       // 🔹 Tambahan: simbol saham
  fundamental?: {                       // 🔹 Tambahan: data fundamental dari API quote
    per: number | null;
    pbv: number | null;
    dividendYield: number | null;
    marketCap: number | null;
    roe: number | null;
    der: number | null;
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    eps: number | null;
  } | null;
}

export function PipelineViewer({ pipeline, ticker, fundamental }: PipelineViewerProps) {
  const { scanner, risk, context, debate, decision, finalScore } = pipeline;


  const verdictColor = {
    BUY_NOW: "emerald",
    WAIT: "blue",
    WATCHLIST: "amber",
    REJECT: "red",
  } as const;

  const confidenceColor = {
    HIGH: "emerald",
    MEDIUM: "blue",
    LOW: "red",
  } as const;


  return (
    <div className="space-y-4">
      {/* Export handled by module-level floating button */}

      {/* Final Decision Card */}
      <Card className="border-2 border-zinc-800/80 bg-zinc-950/50">
        {/* ... isi Final Decision tidak berubah ... */}
      </Card>

      {/* Scanner Results */}
      <Card>
        {/* ... tidak berubah ... */}
      </Card>

      {/* Risk Management */}
      <Card>
        {/* ... tidak berubah ... */}
      </Card>

      {/* Market Context */}
      <Card>
        {/* ... tidak berubah ... */}
      </Card>

      {/* Debate Results */}
      <Card>
        {/* ... tidak berubah ... */}
      </Card>

      {/* Final Score */}
      <Card className="bg-gradient-to-br from-zinc-950 to-zinc-900">
        {/* ... tidak berubah ... */}
      </Card>

      {/* Export handled by module-level floating button */}
    </div>
  );
}