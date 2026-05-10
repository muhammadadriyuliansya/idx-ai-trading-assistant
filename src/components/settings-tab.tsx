"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  Cloud,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ServerCrash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalStorage } from "@/lib/storage";
import { STORAGE_KEYS, DEFAULT_AI_SETTINGS } from "@/config/app";
import type { AIFeatureFlags, AISettings, Provider } from "@/lib/types";

interface HealthResponse {
  ok: boolean;
  provider: string;
  baseUrl?: string;
  models?: string[];
  error?: string;
  note?: string;
}

const providerOptions: {
  id: Provider;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "ollama",
    label: "Ollama (Lokal)",
    icon: <Cpu className="h-4 w-4" />,
    description: "AI jalan di laptop lo sendiri. Gratis, gak ada rate-limit, data gak keluar.",
  },
  {
    id: "openai",
    label: "OpenAI (Cloud)",
    icon: <Cloud className="h-4 w-4" />,
    description: "GPT-4/4o via API. Kualitas top, tapi butuh API key dan bayar per pakai.",
  },
  {
    id: "anthropic",
    label: "Anthropic (Cloud)",
    icon: <Cloud className="h-4 w-4" />,
    description: "Claude via API. Kualitas setara GPT, butuh API key.",
  },
];

const featureDescriptions: {
  key: keyof AIFeatureFlags;
  label: string;
  description: string;
}[] = [
  {
    key: "scannerCritique",
    label: "Kritik Kandidat Scanner",
    description: "Tiap scan selesai, AI kasih 1-2 kalimat kenapa kandidat menarik atau perlu dicurigai.",
  },
  {
    key: "newsSummary",
    label: "Rangkuman Berita",
    description: "AI bikin ringkasan 3 baris dari berita terkini per saham.",
  },
  {
    key: "multiTfSynthesis",
    label: "Sintesis Multi Timeframe",
    description: "Gabungin hasil 1D/1W/1M jadi satu verdict setelah tab Multi-TF analisa selesai.",
  },
  {
    key: "comparisonVerdict",
    label: "Verdict Perbandingan",
    description: "AI kasih pemenang + alasan saat bandingin 2+ saham di tab Bandingkan.",
  },
  {
    key: "structuredOutput",
    label: "Output Terstruktur (JSON)",
    description: "AI diminta output JSON ketat biar data bisa disimpan/diproses. Fallback ke teks kalau gagal.",
  },
];

export function SettingsTab() {
  const [settings, setSettings] = useLocalStorage<AISettings>(
    STORAGE_KEYS.aiSettings,
    DEFAULT_AI_SETTINGS,
  );
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  const updateSetting = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateFeature = (feature: keyof AIFeatureFlags, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      features: { ...prev.features, [feature]: value },
    }));
  };

  const testConnection = async () => {
    setHealthLoading(true);
    setHealth(null);
    try {
      const params = new URLSearchParams({ provider: settings.provider });
      if (settings.provider === "ollama" && settings.ollamaBaseUrl.trim()) {
        params.set("baseUrl", settings.ollamaBaseUrl.trim());
      }
      const res = await fetch(`/api/ai/health?${params.toString()}`);
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
    } catch (err) {
      setHealth({
        ok: false,
        provider: settings.provider,
        error: err instanceof Error ? err.message : "Gagal hubungi server",
      });
    } finally {
      setHealthLoading(false);
    }
  };

  // Auto-ping Ollama once on mount so user sees status without clicking.
  // Dispatched via microtask so the setState in testConnection happens outside
  // the effect body (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    if (settings.provider === "ollama" && settings.aiEnabled && !health) {
      const handle = setTimeout(() => {
        void testConnection();
      }, 0);
      return () => clearTimeout(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disableAll = () => {
    setSettings((prev) => ({
      ...prev,
      aiEnabled: false,
      features: {
        scannerCritique: false,
        newsSummary: false,
        multiTfSynthesis: false,
        comparisonVerdict: false,
        structuredOutput: false,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pengaturan AI</h2>
          <p className="text-sm text-zinc-400">
            Atur provider AI dan aktifkan fitur-fitur opsional. Pipeline inti tetap deterministik,
            AI cuma tambah narasi dan tidak pernah mengubah skor atau keputusan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={settings.aiEnabled ? "emerald" : "neutral"}>
            {settings.aiEnabled ? "AI Aktif" : "AI Mati"}
          </Badge>
          {settings.aiEnabled && (
            <Button variant="outline" size="sm" onClick={disableAll} title="Matikan semua AI sekaligus">
              Matikan Semua
            </Button>
          )}
        </div>
      </div>

      {/* Master switch */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={settings.aiEnabled}
              onChange={(e) => updateSetting("aiEnabled", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Bot className="h-4 w-4" />
                Aktifkan AI
              </div>
              <p className="text-sm text-zinc-400">
                Master switch. Walaupun provider sudah di-setup, AI tidak jalan kalau ini dimatikan.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Provider selection */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="mb-3">
            <h3 className="font-semibold">Provider AI</h3>
            <p className="text-xs text-zinc-500">Pilih satu. Lo bisa ganti kapan aja.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {providerOptions.map((opt) => {
              const active = settings.provider === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateSetting("provider", opt.id)}
                  className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      {opt.icon}
                      {opt.label}
                    </span>
                    {active && <Check className="h-4 w-4 text-blue-400" />}
                  </div>
                  <p className="text-xs text-zinc-500">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Provider config */}
      {settings.provider === "ollama" && (
        <Card className="border-zinc-800">
          <CardContent className="space-y-4 p-4">
            <h3 className="font-semibold">Konfigurasi Ollama</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nama Model</Label>
                <Input
                  value={settings.ollamaModel}
                  onChange={(e) => updateSetting("ollamaModel", e.target.value)}
                  placeholder="gemma4:e4b"
                  className="font-mono"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  Pakai nama tag persis dari <code>ollama list</code>.
                </p>
              </div>
              <div>
                <Label>Base URL (opsional)</Label>
                <Input
                  value={settings.ollamaBaseUrl}
                  onChange={(e) => updateSetting("ollamaBaseUrl", e.target.value)}
                  placeholder="http://localhost:11434"
                  className="font-mono"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  Kosongin kalau pakai default localhost.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {settings.provider === "openai" && (
        <Card className="border-zinc-800">
          <CardContent className="space-y-4 p-4">
            <h3 className="font-semibold">Konfigurasi OpenAI</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showOpenAIKey ? "text" : "password"}
                    value={settings.openaiKey}
                    onChange={(e) => updateSetting("openaiKey", e.target.value)}
                    placeholder="sk-..."
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenAIKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    title={showOpenAIKey ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={settings.openaiModel}
                  onChange={(e) => updateSetting("openaiModel", e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {settings.provider === "anthropic" && (
        <Card className="border-zinc-800">
          <CardContent className="space-y-4 p-4">
            <h3 className="font-semibold">Konfigurasi Anthropic</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showAnthropicKey ? "text" : "password"}
                    value={settings.anthropicKey}
                    onChange={(e) => updateSetting("anthropicKey", e.target.value)}
                    placeholder="sk-ant-..."
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnthropicKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    title={showAnthropicKey ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={settings.anthropicModel}
                  onChange={(e) => updateSetting("anthropicModel", e.target.value)}
                  placeholder="claude-3-5-haiku-latest"
                  className="font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection test */}
      <Card className="border-zinc-800">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Tes Koneksi</h3>
              <p className="text-xs text-zinc-500">
                {settings.provider === "ollama"
                  ? "Cek apakah Ollama running dan model terinstal."
                  : "Verifikasi nama provider. Key baru dicek saat request pertama."}
              </p>
            </div>
            <Button variant="outline" onClick={testConnection} disabled={healthLoading}>
              {healthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Tes
            </Button>
          </div>

          {health && (
            <div
              className={`rounded-lg border p-3 text-xs ${
                health.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/30 bg-red-500/10 text-red-200"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {health.ok ? <Check className="h-4 w-4" /> : <ServerCrash className="h-4 w-4" />}
                {health.ok ? "Koneksi OK" : "Koneksi Gagal"}
              </div>
              {health.note && <div className="mt-1 text-zinc-400">{health.note}</div>}
              {health.error && <div className="mt-1">{health.error}</div>}
              {health.models && health.models.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Model terinstal</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {health.models.map((m) => (
                      <span
                        key={m}
                        className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                          m === settings.ollamaModel
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  {!health.models.includes(settings.ollamaModel) && (
                    <div className="mt-2 text-amber-300">
                      Model <code>{settings.ollamaModel}</code> tidak ada di daftar. Jalankan{" "}
                      <code>ollama pull {settings.ollamaModel}</code> di terminal, atau pilih salah satu dari daftar di atas.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature toggles */}
      <Card className="border-zinc-800">
        <CardContent className="p-4">
          <div className="mb-3">
            <h3 className="font-semibold">Fitur AI</h3>
            <p className="text-xs text-zinc-500">
              Semua default mati. Aktifkan satu-satu setelah tes koneksi sukses.
            </p>
          </div>
          <div className="space-y-3">
            {featureDescriptions.map((f) => (
              <label
                key={f.key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  settings.features[f.key]
                    ? "border-blue-500/40 bg-blue-500/5"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={settings.features[f.key]}
                  onChange={(e) => updateFeature(f.key, e.target.checked)}
                  disabled={!settings.aiEnabled}
                  className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900"
                />
                <div className="flex-1">
                  <div className="font-medium">{f.label}</div>
                  <div className="text-xs text-zinc-500">{f.description}</div>
                </div>
              </label>
            ))}
          </div>
          {!settings.aiEnabled && (
            <p className="mt-3 text-xs text-amber-300">
              Aktifkan master switch di atas dulu sebelum toggle fitur.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
