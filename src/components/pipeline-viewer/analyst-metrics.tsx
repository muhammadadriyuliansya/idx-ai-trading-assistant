import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { AnalysisPipeline } from "@/pipeline/types";

export function ConfidenceHeatmap({
  reports,
}: {
  reports: AnalysisPipeline["analystReports"];
}) {
  return (
    <div className="space-y-2">
      {reports.map((report) => {
        const pct = Math.min(100, Math.max(0, report.score));
        const tone = pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "red";
        const biasLabel =
          report.bias === "bullish"
            ? "Cenderung Naik"
            : report.bias === "bearish"
              ? "Cenderung Turun"
              : "Netral";
        return (
          <div key={report.agent} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{report.agent}</span>
              <span
                className={`font-mono font-semibold ${
                  tone === "emerald"
                    ? "text-emerald-400"
                    : tone === "amber"
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {report.score}/100
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  tone === "emerald"
                    ? "bg-emerald-500"
                    : tone === "amber"
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span className="capitalize">{biasLabel}</span>
              <span>Keyakinan: {report.confidence}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AnalystAgreementMeter({
  reports,
}: {
  reports: AnalysisPipeline["analystReports"];
}) {
  if (reports.length < 2) return null;

  const bullishCount = reports.filter((report) => report.bias === "bullish").length;
  const bearishCount = reports.filter((report) => report.bias === "bearish").length;
  const neutralCount = reports.filter((report) => report.bias === "neutral").length;
  const total = reports.length;
  const agreementPct =
    total > 1 ? Math.round((Math.max(bullishCount, bearishCount) / total) * 100) : 100;
  const tone = agreementPct >= 70 ? "emerald" : agreementPct >= 50 ? "amber" : "red";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">Kesepakatan Analis</span>
        <span
          className={`font-mono font-semibold ${
            tone === "emerald"
              ? "text-emerald-400"
              : tone === "amber"
                ? "text-amber-400"
                : "text-red-400"
          }`}
        >
          {agreementPct}%
        </span>
      </div>
      <Progress value={agreementPct} tone={tone} className="h-2" />
      <div className="flex gap-3 text-[10px] text-zinc-500">
        <span className="text-emerald-400">{bullishCount} Menyarankan Naik</span>
        <span className="text-red-400">{bearishCount} Menyarankan Turun</span>
        <span>{neutralCount} Netral</span>
      </div>
    </div>
  );
}

export function ConflictIndicator({ conflictScore }: { conflictScore: number }) {
  const tone = conflictScore > 60 ? "red" : conflictScore > 30 ? "amber" : "emerald";
  const label =
    conflictScore > 60
      ? "Konflik Tinggi"
      : conflictScore > 30
        ? "Konflik Sedang"
        : "Konflik Rendah";

  return (
    <div className="flex items-center gap-2">
      {tone === "red" && <AlertTriangle className="h-4 w-4 text-red-400" />}
      {tone === "emerald" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
      <span className="text-xs text-zinc-400">{label}</span>
      <span
        className={`font-mono text-xs font-semibold ${
          tone === "red" ? "text-red-400" : tone === "amber" ? "text-amber-400" : "text-emerald-400"
        }`}
      >
        {conflictScore}%
      </span>
    </div>
  );
}
