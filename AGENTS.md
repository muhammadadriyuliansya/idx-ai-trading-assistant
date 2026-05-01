<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Smart Agents untuk IDX AI Trading Assistant

Berikut adalah daftar smart agents yang tersedia untuk proyek ini:

## Trading Analysis Agents

### `/scanner-analyze` - Agent Analisa Technical Setup
**Gunakan untuk:** Analisa mendalam setup teknikal saham IDX dengan pendekatan hedge fund.

**Prompt:**
```
Analisa setup teknikal untuk ticker [TICKER] dengan data berikut:
- Current Price: [HARGA]
- EMA20/50/200: [VALUES]
- RSI: [VALUE]
- Volume: [VALUE]
- Support/Resistance: [LEVELS]

Fokus ke: trend quality, volume confirmation, momentum, dan probabilitas setup.
```

### `/risk-validate` - Agent Validasi Risk Management
**Gunakan untuk:** Validasi dan optimasi plan risk management untuk trade.

**Prompt:**
```
Validasi plan risk management untuk trade [TICKER]:
- Entry: [HARGA]
- Stop Loss: [HARGA]
- Target: [HARGA]
- Position Size: [LOT]
- Risk Per Trade: [%]

Berikan verdict ACCEPT/ADJUST/REJECT dengan reasoning konkret.
```

### `/market-context` - Agent Analisa Market Context
**Gunakan untuk:** Analisa kondisi market dan sector untuk decision making.

**Prompt:**
```
Analisa market context untuk hari ini:
- IHSG Trend: [TREND]
- Foreign Flow: [FLOW]
- US Market: [CONDITION]
- Sector: [SECTOR]

Tentukan market regime (AGGRESSIVE/NORMAL/DEFENSIVE) dan strategy bias.
```

### `/decision-engine` - Agent Final Decision
**Gunakan untuk:** Gabungkan semua analisa jadi satu final decision.

**Prompt:**
```
Buat final decision untuk trade [TICKER]:
- Setup Score: [SCORE]
- Risk Reward: [RR]
- Market Context: [CONTEXT]
- Technical: [ANALISA]

Berikan verdict: BUY NOW / WAIT / WATCHLIST / REJECT
```

### `/trade-journal` - Agent Evaluasi Trade
**Gunakan untuk:** Evaluasi trade yang sudah selesai untuk improvement.

**Prompt:**
```
Evaluasi trade [TICKER] yang sudah selesai:
- Entry: [HARGA], Exit: [HARGA]
- Result: [P/L %]
- Holding Time: [DURATION]
- Emotion: [EMOSI]

Berikan trade quality score dan lessons learned.
```

## Development Agents

### `/code-review` - Agent Review Code Trading
**Gunakan untuk:** Review code dengan fokus pada accuracy perhitungan trading dan edge cases.

**Prompt:**
```
Review code ini untuk accuracy perhitungan trading:
- Pastikan rumus risk/reward benar
- Cek edge cases untuk extreme market conditions
- Validasi lot size calculation untuk IDX (100 shares)
- Pastikan tidak ada floating point errors
```

### `/indicator-test` - Agent Test Technical Indicators
**Gunakan untuk:** Test dan validasi perhitungan technical indicators.

**Prompt:**
```
Test perhitungan [INDICATOR] untuk data berikut:
- OHLC data: [DATA]
- Period: [PERIOD]
- Expected result: [EXPECTED]

Validasi accuracy dan edge cases.
```

### `/prompt-optimize` - Agent Optimize Prompts
**Gunakan untuk:** Optimize prompts untuk better AI responses.

**Prompt:**
```
Optimize prompt untuk module [MODULE]:
- Current prompt: [PROMPT]
- Issue: [ISSUE]
- Goal: [GOAL]

Buat prompt yang lebih effective dan consistent.
```

### `/data-fetch` - Agent Fetch Market Data
**Gunakan untuk:** Fetch dan validasi market data dari Yahoo Finance.

**Prompt:**
```
Fetch market data untuk ticker [TICKER]:
- Source: Yahoo Finance
- Period: [PERIOD]
- Indicators needed: [LIST]

Validasi data quality dan handle rate limits.
```

## Testing & Quality Agents

### `/edge-case-test` - Agent Test Edge Cases
**Gunakan untuk:** Test edge cases dalam trading logic.

**Prompt:**
```
Test edge cases untuk [MODULE]:
- Extreme volatility scenarios
- Illiquid stocks
- Gap up/down scenarios
- Rate limit scenarios

Pastikan code handle semua edge cases dengan graceful.
```

### `/integration-test` - Agent Test Integration
**Gunakan untuk:** Test integration antar modules.

**Prompt:**
```
Test integration flow:
1. Scanner → Risk → Decision
2. Context → Decision
3. Data fetch → semua modules

Pastikan data flow consistent dan error handling proper.
```

## Documentation Agents

### `/doc-update` - Agent Update Documentation
**Gunakan untuk:** Update documentation untuk fitur baru atau perubahan.

**Prompt:**
```
Update documentation untuk [FITUR]:
- Fitur description: [DESC]
- API changes: [CHANGES]
- User impact: [IMPACT]

Buat documentation yang clear dan actionable.
```

### `/changelog` - Agent Generate Changelog
**Gunakan untuk:** Generate changelog dari commits.

**Prompt:**
```
Generate changelog dari commits:
- From: [COMMIT]
- To: [COMMIT]
- Format: [FORMAT]

Highlight breaking changes, new features, dan fixes.
```

## Usage Examples

### Contoh Workflow Complete Analysis:
```
1. /scanner-analyze untuk BBRI
2. /risk-validate untuk BBRI
3. /market-context untuk hari ini
4. /decision-engine untuk BBRI
5. /trade-journal setelah trade selesai
```

### Contoh Workflow Development:
```
1. /code-review untuk file baru
2. /indicator-test untuk indicator baru
3. /edge-case-test untuk validasi
4. /integration-test untuk flow testing
5. /doc-update untuk dokumentasi
```

## Tips Penggunaan

- **Trading Agents**: Gunakan untuk analisa real-time dan decision making
- **Development Agents**: Gunakan saat coding atau review code
- **Testing Agents**: Gunakan untuk validasi dan quality assurance
- **Documentation Agents**: Gunakan untuk maintain documentation

Semua agents di-tune khusus untuk kebutuhan IDX trading dan Next.js 16 stack.