"use client";

import { Eye, EyeOff, KeyRound, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { AISettings, Provider } from "@/lib/types";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: AISettings;
  onChange: (settings: AISettings) => void;
}

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];
const ANTHROPIC_MODELS = [
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
  "claude-3-opus-latest",
];

export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
}: SettingsPanelProps) {
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const update = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            key="settings-panel"
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">AI Settings</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Bring your own key
                  </div>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Provider</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Active Provider</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["openai", "anthropic"] as Provider[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => update("provider", p)}
                        className={
                          settings.provider === p
                            ? "rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-200"
                            : "rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
                        }
                      >
                        {p === "openai" ? "OpenAI" : "Anthropic"}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label>OpenAI API Key</Label>
                    <div className="relative mt-1.5">
                      <Input
                        type={showOpenAI ? "text" : "password"}
                        placeholder="sk-..."
                        value={settings.openaiKey}
                        onChange={(e) => update("openaiKey", e.target.value)}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        onClick={() => setShowOpenAI((v) => !v)}
                      >
                        {showOpenAI ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>OpenAI Model</Label>
                    <Select
                      className="mt-1.5"
                      value={settings.openaiModel}
                      onChange={(e) => update("openaiModel", e.target.value)}
                    >
                      {OPENAI_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label>Anthropic API Key</Label>
                    <div className="relative mt-1.5">
                      <Input
                        type={showAnthropic ? "text" : "password"}
                        placeholder="sk-ant-..."
                        value={settings.anthropicKey}
                        onChange={(e) => update("anthropicKey", e.target.value)}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        onClick={() => setShowAnthropic((v) => !v)}
                      >
                        {showAnthropic ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Anthropic Model</Label>
                    <Select
                      className="mt-1.5"
                      value={settings.anthropicModel}
                      onChange={(e) => update("anthropicModel", e.target.value)}
                    >
                      {ANTHROPIC_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="mt-4 text-[11px] leading-5 text-zinc-500">
              API key kamu disimpan hanya di <span className="text-zinc-300">localStorage</span> di browser ini.
              Setiap request AI dikirim lewat API route Next.js milik aplikasi ini, lalu diteruskan ke OpenAI / Anthropic.
              Tidak ada data yang dikirim ke pihak ketiga selain provider AI yang kamu pilih.
            </p>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
