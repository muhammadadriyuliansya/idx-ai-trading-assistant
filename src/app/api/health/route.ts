import { NextResponse } from 'next/server';
import { resetCircuits, resetClientCache } from '@/lib/resilient-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime?.() ?? 0,
    services: {
      yahooFinance: 'unknown',
      newsFeed: 'unknown',
    },
    cache: {
      circuits: 'active',
      clientCache: 'active',
    },
  };

  try {
    const testTicker = 'BBRI.JK';
    
    const response = await fetch(
      `http://localhost:3000/api/quote?ticker=${testTicker}`,
      { signal: AbortSignal.timeout(5000) }
    ).catch(() => null);

    if (response?.ok) {
      health.services.yahooFinance = 'healthy';
    } else {
      health.services.yahooFinance = 'degraded';
    }
  } catch {
    health.services.yahooFinance = 'unhealthy';
  }

  const allHealthy = Object.values(health.services).every(s => s === 'healthy');
  const allDegraded = Object.values(health.services).every(s => s !== 'unhealthy');
  
  if (!allDegraded) {
    health.status = 'unhealthy';
  } else if (!allHealthy) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

export async function POST() {
  try {
    resetCircuits();
    resetClientCache();
    
    return NextResponse.json({ 
      message: 'Caches and circuits reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reset', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}