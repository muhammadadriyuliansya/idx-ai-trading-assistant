# IDX AI Trading Assistant

Semi-manual AI trading assistant untuk **swing trade & daytrade saham IDX**.

> ⚠️ Bukan auto trading. Bukan AI prediksi harga.
> Tujuan: bantu trader ambil keputusan lebih konsisten lewat technical setup, risk management, market context, trade journal, dan AI-assisted decision making.

## Modules

| Module               | Tugas                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Market Scanner**   | Klasifikasi setup (breakout / pullback / reversal / fake / no setup), setup score 0–100, confidence, status VALID/WATCHLIST/REJECT. |
| **Risk Management**  | Hitung entry, stop loss, TP1/TP2, RR, lot ideal, max loss. AI validasi & adjust. |
| **Market Context**   | Macro & sector read. Tentuin AGGRESSIVE / NORMAL / DEFENSIVE.        |
| **Decision Engine**  | Final verdict: BUY NOW / WAIT / WATCHLIST / REJECT.                   |
| **Trade Journal**    | Evaluasi post-trade: execution, FOMO, discipline, lessons learned.   |

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **TailwindCSS v4**
- **shadcn/ui-style** primitives (button, card, input, label, textarea, badge, progress, separator, select)
- **lucide-react** icons
- **framer-motion** animations
- **localStorage** untuk save settings, form data, prompts, setups, dan trade history
- API route Next.js untuk forward request ke **OpenAI** atau **Anthropic** (user bawa API key sendiri)

## Getting Started

```bash
npm install
npm run dev
```

Lalu buka [http://localhost:3000](http://localhost:3000).

### Set up API key

1. Klik **Settings** di topbar atau sidebar.
2. Pilih provider (OpenAI / Anthropic) dan masukin API key kamu.
3. Pilih model (default: `gpt-4o-mini` / `claude-3-5-sonnet-latest`).
4. Key disimpan **hanya di localStorage browser kamu**, dan dikirim ke endpoint internal `/api/ai` untuk diteruskan ke provider.

## Helper Functions

Di `src/lib`:

- `buildPrompt(module, payload)` — generate `{ system, user }` prompt per modul
- `generateAnalysis(req)` — client helper yang panggil `/api/ai`
- `calculateRiskReward(entry, stop, target)`
- `calculatePositionSize(capital, riskPct, entry, stop)` — IDX lot size 100
- `computeRisk(input)` — full risk plan: entry, SL, TP1/TP2, lot, max loss
- `calculateSetupScore(input, rr)` — heuristic 0–100 + confidence + status

## Prompt System

Modular per modul (`src/lib/prompts.ts`):

- `SYSTEM_PROMPTS.scanner`
- `SYSTEM_PROMPTS.risk`
- `SYSTEM_PROMPTS.context`
- `SYSTEM_PROMPTS.decision`
- `SYSTEM_PROMPTS.journal`

Setiap prompt bisa di-override per session lewat **Prompt Editor** di setiap modul (otomatis ke-save di localStorage).

## Production Build

```bash
npm run build
npm start
```

## Disclaimer

Aplikasi ini **bukan** memberi sinyal beli/jual.
Semua output AI hanya alat bantu analisis. Decision tetap di tangan trader.
Author tidak bertanggung jawab atas loss yang terjadi.
