"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface FieldDef<K extends string = string> {
  key: K;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "number";
  span?: 1 | 2;
}

interface FieldRowProps {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
}

export function FieldRow({ field, value, onChange }: FieldRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        field.span === 2 ? "sm:col-span-2" : "",
      )}
    >
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        id={field.key}
        type={field.type === "number" ? "text" : "text"}
        inputMode={field.type === "number" ? "decimal" : "text"}
        placeholder={field.placeholder ?? field.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {field.hint && (
        <span className="text-[10px] text-zinc-500">{field.hint}</span>
      )}
    </div>
  );
}

export interface AutoFetchBarProps {
  ticker: string;
  onTickerChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  meta: string | null;
  onFetch: (ticker: string) => void;
  hint?: string;
}

export function AutoFetchBar({
  ticker,
  onTickerChange,
  loading,
  error,
  meta,
  onFetch,
  hint = "Yahoo Finance · IDX (.JK)",
}: AutoFetchBarProps) {
  const submit = () => {
    const trimmed = ticker.trim().toUpperCase();
    if (!trimmed) return;
    onFetch(trimmed);
  };
  return (
    <div className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
          <Zap className="h-3 w-3" /> Auto Fetch
        </div>
        <span className="text-[10px] text-zinc-500">{hint}</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={ticker}
          onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="BBRI"
          autoComplete="off"
          spellCheck={false}
          className="h-9 uppercase"
        />
        <Button
          type="button"
          size="sm"
          variant="accent"
          onClick={submit}
          disabled={loading || !ticker.trim()}
          className="shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" /> Fetch
            </>
          )}
        </Button>
      </div>
      {meta && !error && (
        <div className="mt-2 text-[10px] leading-snug text-zinc-400">{meta}</div>
      )}
      {error && (
        <div className="mt-2 text-[10px] leading-snug text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

interface ConfidenceBadgeProps {
  level: "LOW" | "MEDIUM" | "HIGH" | string;
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const upper = level.toUpperCase();
  const tone =
    upper === "HIGH"
      ? "emerald"
      : upper === "MEDIUM"
      ? "blue"
      : upper === "LOW"
      ? "amber"
      : "neutral";
  return (
    <Badge tone={tone as "emerald" | "blue" | "amber" | "neutral"}>
      <Sparkles className="h-3 w-3" />
      {upper || "—"}
    </Badge>
  );
}

interface StatusBadgeProps {
  status: "VALID" | "WATCHLIST" | "REJECT" | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const upper = status.toUpperCase();
  if (upper === "VALID")
    return (
      <Badge tone="emerald">
        <Check className="h-3 w-3" /> Valid
      </Badge>
    );
  if (upper === "WATCHLIST")
    return (
      <Badge tone="blue">
        <Activity className="h-3 w-3" /> Watchlist
      </Badge>
    );
  if (upper === "REJECT")
    return (
      <Badge tone="red">
        <TrendingDown className="h-3 w-3" /> Reject
      </Badge>
    );
  return <Badge tone="neutral">{upper || "—"}</Badge>;
}

interface SetupScoreProps {
  score: number;
  label?: string;
}

export function SetupScoreBar({ score, label = "Setup Score" }: SetupScoreProps) {
  const tone =
    score >= 75 ? "emerald" : score >= 55 ? "blue" : score >= 40 ? "amber" : "red";
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="font-mono text-zinc-100">{score}/100</span>
      </div>
      <Progress value={score} tone={tone} />
    </div>
  );
}

interface RRIndicatorProps {
  rr: number;
  label?: string;
}

export function RRIndicator({ rr, label = "Risk : Reward" }: RRIndicatorProps) {
  const safe = Number.isFinite(rr) ? rr : 0;
  const tone =
    safe >= 3 ? "emerald" : safe >= 2 ? "blue" : safe >= 1.5 ? "amber" : "red";
  const Icon = safe >= 1.5 ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">
          {label}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {Number.isFinite(rr) ? `1 : ${rr.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          tone === "emerald" && "bg-emerald-500/15 text-emerald-300",
          tone === "blue" && "bg-blue-500/15 text-blue-300",
          tone === "amber" && "bg-amber-500/15 text-amber-300",
          tone === "red" && "bg-red-500/15 text-red-300",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
}

export function PromptEditor({ value, onChange, onReset }: PromptEditorProps) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <Card className="bg-zinc-950/80">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            AI Prompt (system)
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onReset}
              className="text-[11px]"
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="subtle"
              onClick={handleCopy}
              className="text-[11px]"
            >
              <Copy className="h-3 w-3" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[180px]"
        />
      </CardContent>
    </Card>
  );
}

interface AIOutputPanelProps {
  output: string;
  loading: boolean;
  error: string | null;
  modelLabel?: string;
  emptyHint?: string;
  onSave?: () => void;
  saved?: boolean;
}

export function AIOutputPanel({
  output,
  loading,
  error,
  modelLabel,
  emptyHint = "Klik Generate Analysis untuk dapet output AI.",
  onSave,
  saved,
}: AIOutputPanelProps) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Analysis</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {modelLabel || "ready"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {output && (
              <Button
                size="sm"
                variant="subtle"
                onClick={handleCopy}
                className="text-[11px]"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
            {output && onSave && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSave}
                className="text-[11px]"
              >
                <Save className="h-3 w-3" />
                {saved ? "Saved" : "Save Setup"}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800/80 bg-black/60 p-4 min-h-[260px]">
          {loading && (
            <div className="space-y-2 pulse-soft">
              <div className="h-2.5 w-1/2 rounded-full bg-zinc-800" />
              <div className="h-2.5 w-3/4 rounded-full bg-zinc-800" />
              <div className="h-2.5 w-2/3 rounded-full bg-zinc-800" />
              <div className="h-2.5 w-4/5 rounded-full bg-zinc-800" />
              <div className="h-2.5 w-1/3 rounded-full bg-zinc-800" />
            </div>
          )}
          {!loading && !output && (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-sm text-zinc-400">{emptyHint}</p>
            </div>
          )}
          {!loading && output && (
            <motion.pre
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="whitespace-pre-wrap text-sm leading-7 text-zinc-200 font-mono"
            >
              {output}
            </motion.pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ModuleHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ModuleHeader({
  eyebrow,
  title,
  description,
  icon,
}: ModuleHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          {eyebrow}
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  tone?: "neutral" | "blue" | "emerald" | "amber" | "red";
  hint?: string;
}

export function Metric({ label, value, tone = "neutral", hint }: MetricProps) {
  const toneClass = {
    neutral: "text-zinc-100",
    blue: "text-blue-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    red: "text-red-300",
  }[tone];
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-500">{hint}</div>}
    </div>
  );
}

interface InputGridProps<K extends string> {
  fields: FieldDef<K>[];
  values: Record<K, string>;
  onChange: (key: K, value: string) => void;
}

export function InputGrid<K extends string>({
  fields,
  values,
  onChange,
}: InputGridProps<K>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f) => (
        <FieldRow
          key={f.key}
          field={f}
          value={values[f.key]}
          onChange={(v) => onChange(f.key, v)}
        />
      ))}
    </div>
  );
}
