"use client";

import React, { useState } from "react";
import { AlertTriangle, AlertOctagon, HelpCircle, Copy, Check, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import type { DataFlag, FlagType } from "@/lib/flags-and-facts";

interface FlagsPanelProps {
  flags: DataFlag[];
  onSelectRow?: (rowIndex: number) => void;
}

export function FlagsPanel({ flags, onSelectRow }: FlagsPanelProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (flags.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldAlert className="h-4 w-4" />
          <span>Telemetry Cleanliness Audit: 0 data anomalies detected. All sensor measurements pass validity gates.</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">100% Valid Telemetry</span>
      </div>
    );
  }

  const counts: Record<FlagType, number> = {
    missing: 0,
    impossible: 0,
    duplicate: 0,
    stuck_value: 0,
  };

  flags.forEach((f) => {
    if (counts[f.type] !== undefined) {
      counts[f.type]++;
    }
  });

  const filteredFlags =
    filterType === "all" ? flags : flags.filter((f) => f.type === filterType);

  const getBadgeColor = (type: FlagType) => {
    switch (type) {
      case "impossible":
        return "bg-rose-500/15 text-rose-500 border-rose-500/30";
      case "stuck_value":
        return "bg-amber-500/15 text-amber-500 border-amber-500/30";
      case "duplicate":
        return "bg-orange-500/15 text-orange-500 border-orange-500/30";
      case "missing":
        return "bg-sky-500/15 text-sky-500 border-sky-500/30";
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-card overflow-hidden shadow-xs">
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-xs text-foreground">
            Sensor Telemetry & Data Flags Audit ({flags.length} Anomalies Detected)
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300">
            Never Hidden (Rule 3)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? (
              <>
                <span>Collapse</span> <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <span>Expand</span> <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                filterType === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({flags.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("impossible")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                filterType === "impossible"
                  ? "bg-rose-600 text-white"
                  : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
              }`}
            >
              Impossible Readings ({counts.impossible})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("stuck_value")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                filterType === "stuck_value"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
              }`}
            >
              Stuck Values ({counts.stuck_value})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("missing")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                filterType === "missing"
                  ? "bg-sky-600 text-white"
                  : "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
              }`}
            >
              Missing Values ({counts.missing})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("duplicate")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                filterType === "duplicate"
                  ? "bg-orange-600 text-white"
                  : "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
              }`}
            >
              Duplicates ({counts.duplicate})
            </button>
          </div>

          {/* Flags Table / List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {filteredFlags.map((flag) => (
              <div
                key={flag.id}
                onClick={() => onSelectRow && onSelectRow(flag.sourceRowIndex)}
                className="group flex items-start justify-between gap-3 p-2.5 rounded border border-border/80 bg-background hover:border-amber-500/50 hover:bg-amber-500/5 transition cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${getBadgeColor(
                      flag.type
                    )}`}
                  >
                    {flag.type.replace("_", " ")}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <span>Station: {flag.station}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Source Row #{flag.sourceRowIndex}
                      </span>
                      {flag.column && (
                        <span className="text-[11px] font-mono px-1 rounded bg-muted text-muted-foreground">
                          {flag.column} = "{flag.rawValue}"
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {flag.description}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] text-muted-foreground group-hover:text-amber-500 shrink-0 font-medium">
                  Inspect Row #{flag.sourceRowIndex} &rarr;
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
