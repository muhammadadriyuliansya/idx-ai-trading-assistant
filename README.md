# IDX AI Trading Assistant

Semi-manual AI trading assistant untuk **swing trade & daytrade saham IDX (BEI)**.

> ⚠️ Bukan auto trading. Bukan AI prediksi harga.
> Tujuan: bantu trader ambil keputusan lebih konsisten lewat technical setup, risk management, market context, trade journal, dan AI-assisted decision making.

## 🎯 Fitur Utama

### 🚀 Full Pipeline Analysis (NEW!)
- **One-click analysis** - Input ticker sekali, jalankan complete analysis pipeline
- **Automated flow** - Data fetch → Indicators → Scanner → Risk → Context → Debate → Decision
- **Shared state** - Semua modul baca dari state yang sama, tidak ada input ulang
- **AI-optional** - Jalan 100% tanpa API key, AI hanya untuk explanation tambahan

### 📊 Market Scanner (NEW!)
- **Multi-ticker scan** - Scan 40+ IDX blue-chip stocks sekaligus
- **Hard filters** - Volume ratio, RR, trend, price range
- **Auto ranking** - Sort by setup quality
- **Quick analyze** - One-click ke full pipeline

### 🔧 Individual Modules

| Module               | Tugas                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Market Scanner**   | Klasifikasi setup (breakout / pullback / reversal / fake / no setup), setup score 0–100, confidence, status VALID/WATCHLIST/REJECT. |
| **Risk Management**  | Hitung entry, stop loss, TP1/TP2, RR, lot ideal, max loss. AI validasi & adjust. |
| **Market Context**   | Macro & sector read. Tentuin AGGRESSIVE / NORMAL / DEFENSIVE.        |
| **Decision Engine**  | Final verdict: BUY NOW / WAIT / WATCHLIST / REJECT.                   |
| **Trade Journal**    | Evaluasi post-trade: execution, FOMO, discipline, lessons learned.   |

## 🏗️ Architecture

### Pipeline System
```
src/pipeline/
├── orchestrator.ts    # Central orchestrator untuk full analysis
├── types.ts           # Unified types untuk semua pipeline components
├── scanner.ts         # Automated market scanner
└── filters.ts         # Hard filters sebelum AI analysis
```

### Core Logic
```
src/lib/
├── indicators.ts      # Technical indicators (EMA, RSI, MACD, ATR, VWAP)
├── calc.ts            # Trading calculations (RR, position sizing, setup score)
├── ai.ts              # AI integration (OpenAI/Anthropic wrapper)
├── prompts.ts         # AI prompts (modular, customizable)
├── quote.ts           # Yahoo Finance integration
├── storage.ts         # localStorage helpers
├── types.ts           # TypeScript types
└── utils.ts           # Utility functions
```

### UI Components
```
src/components/
├── pipeline-module.tsx    # Full pipeline UI
├── pipeline-viewer.tsx    # Results viewer
├── market-scanner.tsx     # Multi-ticker scanner
├── modules.tsx            # Individual module components
├── app-shell.tsx          # Main layout
├── settings-panel.tsx     # Settings UI
└── shared.tsx             # Shared UI components
```

## 📖 Cara Pakai

### 1. Full Pipeline (Recommended)

1. Buka menu **Full Pipeline**
2. Input ticker (contoh: `BBRI`)
3. Configure settings:
   - **Capital** - Modal trading aktif (default: 100M)
   - **Risk Per Trade** - % risk per trade (default: 1%)
   - **Min RR** - Minimum risk/reward ratio (default: 2.0)
   - **Min Volume Ratio** - Minimum volume vs average (default: 1.5x)
4. Klik **Run Analysis**
5. Tunggu hasil lengkap:
   - **Scanner Analysis** - Setup score, type, warnings, key reads
   - **Risk Management** - Entry zone, stop loss, TP1/TP2, position size
   - **Market Context** - Regime, risk stance, key risks
   - **Internal Debate** - Bullish vs bearish arguments, consensus
   - **Final Decision** - BUY NOW / WAIT / WATCHLIST / REJECT dengan confidence

### 2. Market Scanner

1. Buka menu **Market Scanner**
2. Biarkan tickers kosong untuk default IDX list (40+ blue-chip stocks), atau input custom tickers (comma-separated)
3. Configure filters:
   - **Min Volume Ratio** - Default 1.5x
   - **Min RR** - Default 2.0
   - **Min Setup Score** - Default 50
   - **Max Results** - Default 20
4. Klik **Run Market Scan**
5. Lihat ranking candidates dengan:
   - Setup score
   - Volume ratio
   - Risk/reward
   - Trend
   - Status (VALID/WATCHLIST/REJECT)
6. Klik **Analyze in Pipeline** untuk detailed analysis

### 3. Individual Modules

Untuk detailed analysis per modul:

- **Scanner** - Input data teknikal, dapat setup score & classification
- **Risk** - Input support/resistance, dapat risk plan & position sizing
- **Context** - Input market data, dapat regime analysis
- **Decision** - Gabungkan semua hasil, dapat final verdict
- **Journal** - Log trade selesai, dapat AI coaching

## 🎨 Auto Fetch (Market Scanner & Risk)

Tinggal ketik ticker IDX (mis. `BBRI`, `TLKM`, `GOTO`) lalu klik **Fetch** —
aplikasi tarik ~250 bar harian dari Yahoo Finance untuk `<TICKER>.JK`,
hitung indikator lokal, lalu auto-isi form Scanner + Risk:

- OHLC, current price, prev close, today volume
- Avg volume 20D & vol-vs-avg ratio
- EMA20 / EMA50 / EMA200, VWAP rolling 5D
- RSI(14), MACD label (cross / above / below signal), Stochastic K/D
- Swing-pivot Support & Resistance (lookback 80, window 3)
- ATR(14) untuk Risk module
- IHSG context (`^JKSE`) → trend label + 5D % change

Field yang **tetap manual** karena Yahoo nggak punya datanya:
**Foreign Flow**, **Broker Accumulation**, **Sector Strength**.

Endpoint: `GET /api/quote?ticker=BBRI` (bisa dipanggil terpisah juga).
Catatan: Yahoo Finance kadang rate-limit IP datacenter (Vercel, dll).
Untuk pemakaian harian, run lokal di mesin sendiri.

## 🔧 Configuration

### AI Settings (Optional)

AI tidak wajib - aplikasi jalan 100% tanpa API key. Untuk AI explanation:

1. Buka **Settings**
2. Pilih provider (**OpenAI** atau **Anthropic**)
3. Masukkan API key
4. Pilih model:
   - OpenAI: `gpt-4o-mini` (default), `gpt-4o`, dll
   - Anthropic: `claude-3-5-sonnet-latest` (default), dll

Key disimpan **hanya di localStorage browser kamu**, dan dikirim ke endpoint internal `/api/ai` untuk diteruskan ke provider.

## 📊 Trading Rules

### IDX Specific
- **Lot Size**: 1 lot = 100 shares (hardcoded)
- **Risk Management**: Default RR minimum 1.5, reject kalau kurang
- **Volume Analysis**: Always check volume vs average, reject illiquid stocks
- **Foreign Flow**: Manual input (Yahoo Finance tidak punya data ini)
- **Market Context**: IHSG trend (`^JKSE`) always considered dalam decision

### Setup Scoring
- **Trend** (max 30): Price vs EMA20/50/200, VWAP
- **Momentum** (max 20): RSI, MACD
- **Volume** (max 20): Volume ratio vs average
- **Context** (max 20): IHSG trend, sector strength, foreign flow
- **RR Quality** (max 10): Risk/reward ratio

### Decision Logic
- **BUY NOW**: Setup VALID + Risk ACCEPT + Debate BULLISH
- **WATCHLIST**: Setup WATCHLIST atau Risk ADJUST
- **WAIT**: Debate NEUTRAL
- **REJECT**: Setup REJECT atau Risk REJECT

## 🛠️ Tech Stack

- **Next.js 16** (App Router) + **TypeScript** - Modern React framework
- **TailwindCSS v4** - Latest styling dengan syntax baru
- **shadcn/ui-style** primitives - Custom UI components
- **lucide-react** icons
- **framer-motion** animations
- **localStorage** - Persist settings, form data, prompts, setups, trade history
- **Yahoo Finance API** - Primary data source untuk OHLC, indicators, IHSG context
- **API route Next.js** - Forward request ke OpenAI/Anthropic (user bawa API key sendiri)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm atau yarn

### Installation

```bash
# Clone repository
git clone https://github.com/muhammadadriyuliansya/idx-ai-trading-assistant.git
cd idx-ai-trading-assistant

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Set up API key (Optional)

AI tidak wajib - aplikasi jalan 100% tanpa API key. Untuk AI explanation:

1. Klik **Settings** di topbar atau sidebar.
2. Pilih provider (OpenAI / Anthropic) dan masukin API key kamu.
3. Pilih model (default: `gpt-4o-mini` / `claude-3-5-sonnet-latest`).
4. Key disimpan **hanya di localStorage browser kamu**, dan dikirim ke endpoint internal `/api/ai` untuk diteruskan ke provider.

## 🧩 Helper Functions

Di `src/lib`:

- `buildPrompt(module, payload)` — generate `{ system, user }` prompt per modul
- `generateAnalysis(req)` — client helper yang panggil `/api/ai`
- `calculateRiskReward(entry, stop, target)`
- `calculatePositionSize(capital, riskPct, entry, stop)` — IDX lot size 100
- `computeRisk(input)` — full risk plan: entry, SL, TP1/TP2, lot, max loss
- `calculateSetupScore(input, rr)` — heuristic 0–100 + confidence + status

## 📝 Prompt System

Modular per modul (`src/lib/prompts.ts`):

- `SYSTEM_PROMPTS.scanner`
- `SYSTEM_PROMPTS.risk`
- `SYSTEM_PROMPTS.context`
- `SYSTEM_PROMPTS.decision`
- `SYSTEM_PROMPTS.journal`

Setiap prompt bisa di-override per session lewat **Prompt Editor** di setiap modul (otomatis ke-save di localStorage).

## 🏗️ Development

### Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── ai/route.ts          # OpenAI/Anthropic proxy
│   │   └── quote/route.ts       # Yahoo Finance data fetch
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── pipeline-module.tsx      # Full pipeline UI
│   ├── pipeline-viewer.tsx      # Results viewer
│   ├── market-scanner.tsx       # Multi-ticker scanner
│   ├── modules.tsx              # Individual modules
│   ├── app-shell.tsx            # Main layout
│   ├── settings-panel.tsx       # Settings UI
│   └── shared.tsx               # Shared UI components
├── pipeline/
│   ├── orchestrator.ts          # Central orchestrator
│   ├── types.ts                 # Pipeline types
│   ├── scanner.ts               # Market scanner
│   └── filters.ts               # Hard filters
├── hooks/
│   └── use-pipeline.ts          # Pipeline state hook
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

### Common Tasks

**Add New Indicator:**
1. Update `src/lib/indicators.ts`
2. Update types di `src/lib/types.ts`
3. Add ke pipeline calculation di `src/pipeline/orchestrator.ts`

**Modify Prompt:**
1. Edit `src/lib/prompts.ts`
2. Atau gunakan Prompt Editor di UI

**Add New Module:**
1. Create component di `src/components/`
2. Update types dan prompts
3. Add ke `MODULE_META` di `src/components/modules.tsx`

**Fix Calculation:**
1. Check `src/lib/calc.ts` untuk formula yang benar
2. Validate dengan edge cases

## ⚠️ Important Notes

### Disclaimer
- Aplikasi ini **bukan** memberi sinyal beli/jual
- Semua output AI hanya alat bantu analisis
- **Final decision tetap di tangan trader**
- Author tidak bertanggung jawab atas loss yang terjadi

### Data Limitations
- **Yahoo Finance**: Primary source, rate-limit IP datacenter
- **Manual Fields**: Foreign Flow, Broker Accumulation, Sector Strength harus di-input manual
- **Production**: Run lokal untuk menghindari Yahoo Finance rate limits

### Best Practices
- Selalu gunakan risk management (stop loss, position sizing)
- Check volume sebelum entry
- Perhatikan market context (IHSG trend, sector rotation)
- Jangan FOMO, tunggu confirmation
- Review trade journal untuk improvement

## 📝 License

MIT License - Lihat [LICENSE](LICENSE) untuk details.

## 🤝 Contributing

Contributions are welcome! Silakan:

1. Fork repository
2. Create branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📧 Contact

Muhammad Adriyuliansya - [@adriyuliansya](https://github.com/muhammadadriyuliansya)

Project Link: [https://github.com/muhammadadriyuliansya/idx-ai-trading-assistant](https://github.com/muhammadadriyuliansya/idx-ai-trading-assistant)

---

**IDX AI Trading Assistant** - Bukan auto trading. Bukan prediksi harga. Decision tetap di tangan trader.
