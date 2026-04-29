"use client";

import { Activity, Code2, Search, Settings, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MODULE_META, MODULE_ORDER } from "@/components/modules";
import { SettingsPanel } from "@/components/settings-panel";
import { DEFAULT_SETTINGS } from "@/lib/ai";
import { STORAGE_KEYS, useLocalStorage } from "@/lib/storage";
import type { AISettings, ModuleKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [settings, setSettings] = useLocalStorage<AISettings>(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS,
  );
  const [active, setActive] = useState<ModuleKey>("scanner");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const activeMeta = MODULE_META[active];
  const ActiveModule = activeMeta.render;

  const hasKey = useMemo(() => {
    if (settings.provider === "openai") return Boolean(settings.openaiKey?.trim());
    return Boolean(settings.anthropicKey?.trim());
  }, [settings]);

  return (
    <div className="relative min-h-screen">
      {/* Subtle grid backdrop */}
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-30" />

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-zinc-900/80 bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-2 border-b border-zinc-900/80 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 text-white shadow-[0_0_24px_-4px_rgba(59,130,246,0.6)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">
                IDX AI Trading
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Assistant Terminal
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Modules
            </div>
            {MODULE_ORDER.map((key) => {
              const meta = MODULE_META[key];
              const isActive = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={cn(
                    "group relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                    isActive
                      ? "bg-gradient-to-br from-blue-500/15 to-blue-500/5 ring-1 ring-blue-500/30"
                      : "hover:bg-zinc-900/60",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-pill"
                      className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-blue-400"
                    />
                  )}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      isActive
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-zinc-900/80 text-zinc-400 group-hover:text-zinc-200",
                    )}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        isActive ? "text-zinc-50" : "text-zinc-200",
                      )}
                    >
                      {meta.label}
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {meta.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-zinc-900/80 p-3">
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-3">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Provider:{" "}
                  <span className="text-zinc-200">
                    {settings.provider === "openai" ? "OpenAI" : "Anthropic"}
                  </span>
                </span>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500 truncate">
                {settings.provider === "openai"
                  ? settings.openaiModel
                  : settings.anthropicModel}
              </div>
              <Button
                size="sm"
                variant="subtle"
                onClick={() => setSettingsOpen(true)}
                className="mt-3 w-full text-[11px]"
              >
                <Settings className="h-3.5 w-3.5" /> AI Settings
              </Button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-900/80 bg-zinc-950/70 px-4 backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">IDX AI</div>
            </div>

            <div className="flex flex-1 items-center gap-3">
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-zinc-900 bg-zinc-950/70 px-3 py-1.5 w-72">
                <Search className="h-3.5 w-3.5 text-zinc-500" />
                <input
                  className="w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-600"
                  placeholder="Quick lookup ticker… (visual only)"
                />
                <Badge tone="neutral">⌘K</Badge>
              </div>
              <div className="hidden md:block">
                <Badge tone="emerald">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-soft" />
                  IDX SESSION OPEN
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!hasKey && mounted && (
                <Badge tone="amber">No API key</Badge>
              )}
              <a
                href="https://github.com/muhammadadriyuliansya/idx-ai-trading-assistant"
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-900 bg-zinc-950/60 px-3 text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/60"
              >
                <Code2 className="h-3.5 w-3.5" /> Source
              </a>
              <Button
                size="sm"
                variant="subtle"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-3.5 w-3.5" /> Settings
              </Button>
            </div>
          </header>

          {/* Mobile module tabs */}
          <div className="lg:hidden border-b border-zinc-900/80 bg-zinc-950/40 px-3 py-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {MODULE_ORDER.map((key) => {
                const meta = MODULE_META[key];
                const isActive = key === active;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActive(key)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs",
                      isActive
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-300",
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-[1600px] space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                    {activeMeta.label}
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {headline(active)}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                    {sublineText(active)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="blue">Semi-manual</Badge>
                  <Badge tone="emerald">IDX focused</Badge>
                  <Badge tone="violet">No price prediction</Badge>
                </div>
              </div>

              <Separator />

              <ActiveModule settings={settings} />
            </div>
          </div>

          <footer className="border-t border-zinc-900/80 px-4 py-4 text-center text-[11px] text-zinc-600 sm:px-6">
            IDX AI Trading Assistant · Bukan auto trading. Bukan prediksi harga.
            Decision tetap di tangan trader.
          </footer>
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}

function headline(key: ModuleKey): string {
  switch (key) {
    case "scanner":
      return "Scan setup, score probabilitas, screen warning.";
    case "risk":
      return "Plan risk dulu, baru klik buy.";
    case "context":
      return "Baca regime market sebelum entry.";
    case "decision":
      return "Verdict final: BUY NOW / WAIT / WATCHLIST / REJECT.";
    case "journal":
      return "Evaluasi trade. Belajar dari setiap entry.";
  }
}

function sublineText(key: ModuleKey): string {
  switch (key) {
    case "scanner":
      return "Input data pre-market / intraday lu, sistem hitung skor heuristik real-time, AI kasih klasifikasi setup hedge-fund-grade.";
    case "risk":
      return "Hitung entry, stop loss, dua TP, lot ideal, dan max loss otomatis. AI re-validate apakah setup layak di-take.";
    case "context":
      return "Macro & sector read. Tentuin apakah hari ini boleh aggressive trade atau wajib defensive.";
    case "decision":
      return "Cross-check setup score, RR, dan market context jadi satu verdict yang konkret dan beralasan.";
    case "journal":
      return "Catat trade selesai. AI coach evaluasi execution, FOMO, discipline, dan kasih lessons learned.";
  }
}
