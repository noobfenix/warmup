"use client";

import React, { useState } from "react";
import { AlertOctagon, ChevronDown, ChevronUp, ShieldCheck, ArrowRight } from "lucide-react";
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
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex items-center justify-between text-xs transition-colors">
        <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span>Telemetry Cleanliness Audit: 0 data anomalies detected. All sensor measurements pass validity gates.</span>
        </div>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          100% Valid
        </span>
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
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "stuck_value":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "duplicate":
        return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
      case "missing":
        return "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30";
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-card overflow-hidden shadow-xs">
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AlertOctagon className="h-4 w-4 text-amber-500" />
          <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
            Sensor Telemetry Flags &amp; Anomalies ({flags.length} Flagged)
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Never Hidden (Rule 3)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition"
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

      {isExpanded && (
        <div className="p-5 space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filterType === "all"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "bg-muted text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              All ({flags.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("impossible")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filterType === "impossible"
                  ? "bg-rose-500 text-white font-semibold shadow-xs"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/25"
              }`}
            >
              Impossible Readings ({counts.impossible})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("stuck_value")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filterType === "stuck_value"
                  ? "bg-amber-500 text-black font-semibold shadow-xs"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/25"
              }`}
            >
              Stuck Values ({counts.stuck_value})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("missing")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filterType === "missing"
                  ? "bg-sky-500 text-white font-semibold shadow-xs"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border border-sky-500/25"
              }`}
            >
              Missing Values ({counts.missing})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("duplicate")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filterType === "duplicate"
                  ? "bg-orange-500 text-white font-semibold shadow-xs"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 border border-orange-500/25"
              }`}
            >
              Duplicates ({counts.duplicate})
            </button>
          </div>

          {/* Flags List */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {filteredFlags.map((flag) => (
              <div
                key={flag.id}
                onClick={() => onSelectRow && onSelectRow(flag.sourceRowIndex)}
                className="group flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-background hover:border-amber-500/40 hover:bg-amber-500/5 transition cursor-pointer"
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
                    <div className="text-xs font-semibold text-foreground flex items-center gap-2 flex-wrap">
                      <span>Station: {flag.station}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        Source Row #{flag.sourceRowIndex}
                      </span>
                      {flag.column && (
                        <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                          {flag.column} = "{flag.rawValue}"
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {flag.description}
                    </p>
                  </div>
                </div>

                <span className="text-xs text-muted-foreground group-hover:text-amber-500 shrink-0 font-medium inline-flex items-center gap-1 font-mono">
                  Inspect #{flag.sourceRowIndex}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
