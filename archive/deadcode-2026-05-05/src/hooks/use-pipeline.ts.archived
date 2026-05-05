"use client";

import { useState, useCallback } from "react";
import type { AnalysisPipeline } from "@/pipeline/types";
import { runFullAnalysis } from "@/pipeline/orchestrator";
import { useLocalStorage } from "@/lib/storage";
import type { AISettings } from "@/lib/types";

const STORAGE_KEY = "pipeline_history" as const;

export interface PipelineState {
  currentPipeline: AnalysisPipeline | null;
  isRunning: boolean;
  error: string | null;
  lastTicker: string | null;
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    currentPipeline: null,
    isRunning: false,
    error: null,
    lastTicker: null,
  });

  const [history, setHistory] = useLocalStorage<AnalysisPipeline[]>(
    STORAGE_KEY,
    []
  );

  const runAnalysis = useCallback(
    async (ticker: string, settings?: AISettings) => {
      setState((prev) => ({
        ...prev,
        isRunning: true,
        error: null,
        lastTicker: ticker,
      }));

      try {
        const pipeline = await runFullAnalysis(ticker, settings)

        setState((prev) => ({
          ...prev,
          currentPipeline: pipeline,
          isRunning: false,
          error: null,
        }));

        // Save to history
        setHistory((prev) => {
          const updated = [pipeline, ...prev].filter(
            (p, i, arr) => arr.findIndex((x) => x.ticker === p.ticker) === i
          );
          return updated.slice(0, 50); // Keep last 50 analyses
        });

        return pipeline;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isRunning: false,
          error: errorMessage,
        }));
        throw err;
      }
    },
    [setHistory]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearPipeline = useCallback(() => {
    setState({
      currentPipeline: null,
      isRunning: false,
      error: null,
      lastTicker: null,
    });
  }, []);

  const loadFromHistory = useCallback(
    (ticker: string) => {
      const pipeline = history.find((p) => p.ticker === ticker);
      if (pipeline) {
        setState((prev) => ({
          ...prev,
          currentPipeline: pipeline,
          lastTicker: ticker,
        }));
        return pipeline;
      }
      return null;
    },
    [history]
  );

  return {
    ...state,
    history,
    runAnalysis,
    clearError,
    clearPipeline,
    loadFromHistory,
  };
}
