@AGENTS.md

# IDX AI Trading Assistant - Project Guidelines

## Project Overview
Semi-manual AI trading assistant untuk swing trade & daytrade saham IDX (BEI). Bukan auto trading - tujuannya membantu trader ambil keputusan lebih konsisten melalui technical setup, risk management, market context, dan AI-assisted decision making.

## Core Modules
- **Market Scanner**: Klasifikasi setup (breakout/pullback/reversal/fake/no setup), setup score 0-100, confidence, status VALID/WATCHLIST/REJECT
- **Risk Management**: Hitung entry, stop loss, TP1/TP2, RR, lot ideal, max loss dengan AI validation
- **Market Context**: Macro & sector read untuk tentuin AGGRESSIVE/NORMAL/DEFENSIVE stance
- **Decision Engine**: Final verdict BUY NOW/WAIT/WATCHLIST/REJECT
- **Trade Journal**: Evaluasi post-trade untuk improvement

## Tech Stack
- **Next.js 16** (App Router) + **TypeScript** - Perhatikan breaking changes dari versi sebelumnya
- **TailwindCSS v4** - Latest version dengan syntax baru
- **shadcn/ui-style** primitives - Custom UI components
- **localStorage** - Persist settings, form data, prompts, setups, trade history
- **API routes** - Forward requests ke OpenAI/Anthropic (user bawa API key sendiri)

## Critical Trading Rules
- **IDX Lot Size**: 1 lot = 100 shares (hardcoded requirement)
- **Risk Management**: Default RR minimum 1.5, reject kalau kurang
- **Volume Analysis**: Always check volume vs average, reject illiquid stocks
- **Foreign Flow**: Manual input (Yahoo Finance tidak punya data ini)
- **Market Context**: IHSG trend (`^JKSE`) always considered dalam decision

## Data Sources & Limitations
- **Yahoo Finance**: Primary source untuk OHLC data, indicators, IHSG context
- **Rate Limiting**: Yahoo Finance rate-limit IP datacenter (Vercel, dll) - run lokal untuk production
- **Manual Fields**: Foreign Flow, Broker Accumulation, Sector Strength harus di-input manual
- **Endpoint**: `GET /api/quote?ticker=BBRI` untuk auto-fetch data

## Code Conventions
- **Type Safety**: Strict TypeScript, semua types di `src/lib/types.ts`
- **Prompt System**: Modular prompts di `src/lib/prompts.ts`, bisa di-override per session
- **Helper Functions**: Semua calculation logic di `src/lib/calc.ts`
- **Indicator Calculations**: Technical indicators di `src/lib/indicators.ts`
- **AI Integration**: OpenAI/Anthropic wrapper di `src/lib/ai.ts`

## Development Guidelines
- **Next.js 16**: Selalu cek `node_modules/next/dist/docs/` sebelum modify Next.js APIs
- **Deprecation Notices**: Heed semua deprecation warnings di Next.js 16
- **Error Handling**: Graceful degradation untuk API failures, rate limits, missing data
- **User Privacy**: API keys hanya di localStorage browser, never store di server
- **Floating Point**: Use proper precision untuk financial calculations (2-4 decimal places)

## Testing Priorities
- **Edge Cases**: Extreme volatility, illiquid stocks, gap up/down scenarios
- **Integration**: Scanner → Risk → Decision flow harus seamless
- **Data Quality**: Validate Yahoo Finance data, handle missing/invalid data
- **Calculation Accuracy**: Risk/reward, position sizing, indicator calculations

## AI Prompt Guidelines
- **Hedge Fund Voice**: Professional, tajam, tidak generik, tidak basa-basi
- **Bahasa Indonesia**: Trading floor style dengan istilah teknikal
- **Structured Output**: Selalu minta format yang jelas dan consistent
- **No Hallucinations**: Jangan kasih price prediction atau data yang tidak ada
- **Assumption Explicit**: Jika data kurang, sebutin assumption-nya

## Common Tasks
- **Add New Indicator**: Update `src/lib/indicators.ts` dan types
- **Modify Prompt**: Edit `src/lib/prompts.ts` atau gunakan Prompt Editor di UI
- **Add New Module**: Create component di `src/components/`, update types dan prompts
- **Fix Calculation**: Check `src/lib/calc.ts` untuk formula yang benar
- **Handle API Error**: Update `src/lib/ai.ts` untuk better error handling

## File Structure
```
src/
├── app/
│   ├── api/
│   │   ├── ai/route.ts          # OpenAI/Anthropic proxy
│   │   └── quote/route.ts       # Yahoo Finance data fetch
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── app-shell.tsx            # Main layout
│   ├── modules.tsx              # Module components
│   ├── settings-panel.tsx       # Settings UI
│   ├── shared.tsx               # Shared components
│   └── ui/                      # shadcn-style primitives
├── lib/
│   ├── ai.ts                    # AI integration
│   ├── calc.ts                  # Trading calculations
│   ├── indicators.ts            # Technical indicators
│   ├── prompts.ts               # AI prompts
│   ├── quote.ts                 # Yahoo Finance integration
│   ├── storage.ts               # localStorage helpers
│   ├── types.ts                 # TypeScript types
│   └── utils.ts                 # Utility functions
```

## Important Notes
- **Disclaimer**: Aplikasi ini bukan memberi sinyal beli/jual - semua output AI hanya alat bantu analisis
- **Decision**: Final decision tetap di tangan trader
- **Liability**: Author tidak bertanggung jawab atas loss yang terjadi
- **Production**: Run lokal untuk menghindari Yahoo Finance rate limits

## Getting Started
```bash
npm install
npm run dev
```
Buka http://localhost:3000 dan setup API key di Settings (OpenAI/Anthropic).