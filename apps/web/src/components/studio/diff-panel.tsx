"use client";

import React from "react";
import { GitCompare, History, TrendingUp, TrendingDown, Minus, RotateCcw } from "lucide-react";
import type { AirQualityDiff } from "@/lib/diff-engine";

interface DiffPanelProps {
  diff: AirQualityDiff | null;
  narrative?: string;
  onClearHistory?: () => void;
}

export function DiffPanel({ diff, narrative, onClearHistory }: DiffPanelProps) {
  if (!diff) return null;

  if (!diff.hasPrevious) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between text-xs transition-colors">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-primary">
            <History className="h-4 w-4" />
          </div>
          <span className="text-xs leading-relaxed">
            <strong className="text-foreground font-semibold">Telemetry Baseline Established:</strong> Subsequent briefings will automatically compute and narrate chronological ambient shifts.
          </span>
        </div>
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
          Cycle #1 Baseline
        </span>
      </div>
    );
  }

  const getStatusBadge = (status: AirQualityDiff["status"]) => {
    switch (status) {
      case "worsened":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Deteriorated (+{diff.avgAqiDelta} AQI)</span>
          </span>
        );
      case "improved":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <TrendingDown className="h-3.5 w-3.5" />
            <span>Improved ({diff.avgAqiDelta} AQI)</span>
          </span>
        );
      case "stable":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            <Minus className="h-3.5 w-3.5" />
            <span>Stable Ambient State</span>
          </span>
        );
    }
  };

  const finalNarrative = narrative || diff.ruleBasedNarrative;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <GitCompare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Chronological Telemetry Delta
            </h3>
            <span className="text-xs text-muted-foreground">
              {narrative ? "Code-computed deltas, narrated by Gemini" : "Code-computed deltas (rule-based summary)"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {getStatusBadge(diff.status)}
          {onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted cursor-pointer transition"
              title="Reset baseline history"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-background border border-border space-y-2">
        <p className="text-sm text-foreground leading-relaxed text-pretty">
          {finalNarrative}
        </p>

        {diff.hotspotShift && diff.hotspotShift.changed && (
          <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-md bg-muted border border-border text-muted-foreground">
              Hotspot Shift: <strong className="text-foreground">{diff.hotspotShift.previousStation}</strong> ({diff.hotspotShift.previousAqi} AQI) &rarr; <strong className="text-foreground">{diff.hotspotShift.currentStation}</strong> ({diff.hotspotShift.currentAqi} AQI)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
