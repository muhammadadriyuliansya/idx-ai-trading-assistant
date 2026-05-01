/**
 * Example display component for scanner results
 * Shows how to use the new pipeline architecture
 */

import type { ScannerResult, MarketData, IndicatorSet } from '@/pipeline/types'

interface ScannerDisplayProps {
  result: ScannerResult
  marketData: MarketData
  indicators: IndicatorSet
}

export function ScannerDisplay({ result, marketData, indicators }: ScannerDisplayProps) {
  const getStatusColor = (status: ScannerResult['status']) => {
    switch (status) {
      case 'VALID':
        return 'bg-green-500'
      case 'WATCHLIST':
        return 'bg-yellow-500'
      case 'REJECT':
        return 'bg-red-500'
    }
  }

  const getConfidenceColor = (confidence: ScannerResult['confidence']) => {
    switch (confidence) {
      case 'HIGH':
        return 'text-green-400'
      case 'MEDIUM':
        return 'text-yellow-400'
      case 'LOW':
        return 'text-red-400'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Scanner Analysis</h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.status)} text-white`}>
            {result.status}
          </span>
          <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
            {result.confidence}
          </span>
        </div>
      </div>

      {/* Setup Score */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Setup Score</span>
          <span className="font-semibold">{result.setupScore}/100</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${result.setupScore}%` }}
          />
        </div>
      </div>

      {/* Setup Type */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 text-sm">Setup Type:</span>
        <span className="px-2 py-1 bg-zinc-800 rounded text-sm font-medium capitalize">
          {result.setupType.replace('_', ' ')}
        </span>
      </div>

      {/* Key Reads */}
      {result.keyReads.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-300">Key Reads</h4>
          <ul className="space-y-1">
            {result.keyReads.map((read, index) => (
              <li key={index} className="text-sm text-zinc-400 flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>{read}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-400">Warnings</h4>
          <ul className="space-y-1">
            {result.warnings.map((warning, index) => (
              <li key={index} className="text-sm text-red-300 flex items-start gap-2">
                <span className="text-red-400 mt-1">⚠</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Plan */}
      <div className="p-3 bg-zinc-900 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-1">Action Plan</h4>
        <p className="text-sm text-zinc-400">{result.actionPlan}</p>
      </div>

      {/* Reasoning */}
      {result.reasoning && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">
            View Reasoning
          </summary>
          <p className="mt-2 text-zinc-500 whitespace-pre-wrap">{result.reasoning}</p>
        </details>
      )}
    </div>
  )
}