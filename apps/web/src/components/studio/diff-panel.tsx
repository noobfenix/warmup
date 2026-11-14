"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus, GitCompare, History, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
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
      <div className="rounded-lg border border-border bg-card/60 p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <History className="h-4 w-4 text-primary" />
          <span>Baseline Briefing Recorded: Saved to localStorage. Subsequent briefings will compute and narrate chronological diffs.</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Cycle #1 Baseline
        </span>
      </div>
    );
  }

  const getStatusBadge = (status: AirQualityDiff["status"]) => {
    switch (status) {
      case "worsened":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30">
            <TrendingUp className="h-3.5 w-3.5" /> Deteriorated (+{diff.avgAqiDelta} AQI)
          </span>
        );
      case "improved":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            <TrendingDown className="h-3.5 w-3.5" /> Improved ({diff.avgAqiDelta} AQI)
          </span>
        );
      case "stable":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-500 border border-sky-500/30">
            <Minus className="h-3.5 w-3.5" /> Stable Ambient State
          </span>
        );
    }
  };

  const finalNarrative = narrative || diff.ruleBasedNarrative;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-primary">
            <GitCompare className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              Chronological Diff vs. Previous Briefing
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Diff computed deterministically in code; narrated by Gemini
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(diff.status)}
          {onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-[11px] text-muted-foreground hover:text-destructive underline cursor-pointer"
            >
              Reset Comparison
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded bg-muted/50 p-2 border border-border/60">
          <span className="text-[11px] text-muted-foreground block">Network Average AQI</span>
          <div className="flex items-baseline gap-1 mt-0.5 font-bold">
            <span className="text-sm">{diff.currentAvgAqi}</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              (was {diff.previousAvgAqi})
            </span>
          </div>
          <span
            className={`text-[10px] font-mono ${
              (diff.avgAqiDelta || 0) > 0
                ? "text-rose-500"
                : (diff.avgAqiDelta || 0) < 0
                ? "text-emerald-500"
                : "text-muted-foreground"
            }`}
          >
            {(diff.avgAqiDelta || 0) > 0 ? `+${diff.avgAqiDelta}` : diff.avgAqiDelta} pts ({diff.avgAqiPctChange}%)
          </span>
        </div>

        <div className="rounded bg-muted/50 p-2 border border-border/60">
          <span className="text-[11px] text-muted-foreground block">CPCB Category Shift</span>
          <div className="flex items-baseline gap-1 mt-0.5 font-bold text-xs">
            <span>{diff.currentCategory || "N/A"}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Previously: {diff.previousCategory || "N/A"}
          </span>
        </div>

        <div className="rounded bg-muted/50 p-2 border border-border/60">
          <span className="text-[11px] text-muted-foreground block">Hotspot Zone</span>
          <div className="font-bold text-xs truncate mt-0.5">
            {diff.hotspotShift.currentStation || "N/A"} ({diff.hotspotShift.currentAqi} AQI)
          </div>
          <span className="text-[10px] text-muted-foreground truncate block">
            {diff.hotspotShift.changed ? `Shifted from ${diff.hotspotShift.previousStation}` : "Hotspot unchanged"}
          </span>
        </div>

        <div className="rounded bg-muted/50 p-2 border border-border/60">
          <span className="text-[11px] text-muted-foreground block">Sensor Flags Delta</span>
          <div className="font-bold text-xs mt-0.5">
            {diff.flagDelta.currentCount} Active Flags
          </div>
          <span
            className={`text-[10px] font-mono ${
              diff.flagDelta.difference > 0
                ? "text-amber-500"
                : diff.flagDelta.difference < 0
                ? "text-emerald-500"
                : "text-muted-foreground"
            }`}
          >
            {diff.flagDelta.difference > 0
              ? `+${diff.flagDelta.difference} new anomalies`
              : diff.flagDelta.difference < 0
              ? `${diff.flagDelta.difference} resolved anomalies`
              : "Anomaly count constant"}
          </span>
        </div>
      </div>

      {/* Narrative Box */}
      <div className="rounded bg-primary/5 border border-primary/20 p-2.5 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Comparative Shift Synthesis</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">{finalNarrative}</p>
      </div>
    </div>
  );
}
