import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BadgeTone } from "./types";

export function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-2">
      <div className="truncate text-[9px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-zinc-200">
        {value}
      </div>
    </div>
  );
}

export function DashboardCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: BadgeTone;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-zinc-400">{icon}</div>
          <Badge tone={tone}>{label}</Badge>
        </div>
        <div className="mt-4 text-2xl font-semibold">{value}</div>
        <div className="mt-1 text-xs text-zinc-500">{hint}</div>
      </CardContent>
    </Card>
  );
}

export function TinyScore({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-1.5">
      <div className="flex items-center justify-between text-[9px] text-zinc-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ExplainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-zinc-300">{value}</div>
    </div>
  );
}

export function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-900 pb-2 last:border-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}
