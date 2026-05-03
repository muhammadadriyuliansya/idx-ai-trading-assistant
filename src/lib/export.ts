// src/lib/export.ts

export interface PipelineState {
  scanner?: any;
  decision?: any;
  context?: any;
  risk?: any;
  debate?: any;
}

export interface ExportData {
  ticker: string;
  pipeline?: PipelineState;
  fundamental?: FundamentalData;
  news?: NewsItem[];
  generatedAt?: string;
}

export interface FundamentalData {
  per: number | null;
  pbv: number | null;
  roe: number | null;
  der: number | null;
  dividendYield: number | null;
  earningsGrowth: number | null;
  eps: number | null;
}

export interface NewsItem {
  date: string;
  title: string;
  source: string;
}

export function exportToBrief(data: ExportData): string {
  const { ticker, pipeline, fundamental, news } = data;
  const now = new Date().toLocaleDateString('id-ID');
  
  const lines: string[] = [];

  lines.push(`${'='.repeat(50)}`);
  lines.push(`IDX TRADING BRIEF: ${ticker}`);
  lines.push(`Generated: ${now}`);
  lines.push(`${'='.repeat(50)}`);
  lines.push('');

  // --- TECHNICAL ---
  if (pipeline) {
    lines.push('--- TECHNICAL ANALYSIS ---');
    lines.push(`Setup Score  : ${pipeline.scanner?.setupScore ?? '-'}/100`);
    lines.push(`Verdict      : ${pipeline.decision?.verdict ?? '-'}`);
    lines.push(`Confidence   : ${pipeline.scanner?.confidence ?? '-'}`);
    lines.push(`Market Regime: ${pipeline.context?.regime ?? '-'}`);
    lines.push('');
    lines.push(`Trend Score    : ${pipeline.scanner?.scores?.trend ?? '-'}/30`);
    lines.push(`Momentum Score : ${pipeline.scanner?.scores?.momentum ?? '-'}/20`);
    lines.push(`Volume Score   : ${pipeline.scanner?.scores?.volume ?? '-'}/20`);
    lines.push(`Context Score  : ${pipeline.scanner?.scores?.context ?? '-'}/20`);
    lines.push('');
    lines.push(`Entry : ${pipeline.risk?.entry ?? '-'}`);
    lines.push(`SL    : ${pipeline.risk?.stopLoss ?? '-'}`);
    lines.push(`TP1   : ${pipeline.risk?.tp1 ?? '-'}`);
    lines.push(`TP2   : ${pipeline.risk?.tp2 ?? '-'}`);
    lines.push(`RR    : ${pipeline.risk?.rr ?? '-'}`);
    lines.push('');

    if (pipeline.context) {
      lines.push('--- MARKET CONTEXT ---');
      lines.push(`IHSG Trend  : ${pipeline.context.ihsgTrend ?? '-'}`);
      lines.push(`IHSG 5D     : ${pipeline.context.ihsg5dChange ?? '-'}%`);
      lines.push(`Regime      : ${pipeline.context.regime ?? '-'}`);
      lines.push('');
    }

    if (pipeline.debate) {
      lines.push('--- INTERNAL DEBATE ---');
      lines.push(`Bullish: ${pipeline.debate.bullish ?? '-'}`);
      lines.push(`Bearish: ${pipeline.debate.bearish ?? '-'}`);
      lines.push(`Consensus: ${pipeline.debate.consensus ?? '-'}`);
      lines.push('');
    }
  }

  // --- FUNDAMENTAL ---
  if (fundamental) {
    lines.push('--- FUNDAMENTAL ---');
    if (fundamental.per)           lines.push(`PER           : ${fundamental.per.toFixed(2)}x`);
    if (fundamental.pbv)           lines.push(`PBV           : ${fundamental.pbv.toFixed(2)}x`);
    if (fundamental.roe)           lines.push(`ROE           : ${(fundamental.roe * 100).toFixed(1)}%`);
    if (fundamental.der)           lines.push(`DER           : ${fundamental.der.toFixed(2)}`);
    if (fundamental.earningsGrowth) lines.push(`EPS Growth YoY: ${(fundamental.earningsGrowth * 100).toFixed(1)}%`);
    if (fundamental.dividendYield) lines.push(`Div Yield     : ${(fundamental.dividendYield * 100).toFixed(2)}%`);
    lines.push('');
  }

  // --- NEWS ---
  if (news && news.length > 0) {
    lines.push('--- BERITA TERBARU ---');
    news.forEach(n => {
      lines.push(`[${n.date}] ${n.source}: "${n.title}"`);
    });
    lines.push('');
  }

  // --- PROMPT SUGGESTION ---
  lines.push('--- PROMPT UNTUK AI ---');
  lines.push(`Analisis saham ${ticker} berikut berdasarkan data di atas.`);
  lines.push(`Berikan pendapat: apakah setup ini layak BUY / WAIT / REJECT?`);
  lines.push(`Pertimbangkan kondisi teknikal, fundamental, dan sentimen berita.`);
  lines.push(`${'='.repeat(50)}`);

  return lines.join('\n');
}