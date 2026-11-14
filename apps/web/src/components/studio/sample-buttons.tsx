"use client";

import React from "react";
import { Building2, School, Home, CheckCircle2, Database, ArrowRight } from "lucide-react";
import { SAMPLE_DATASETS, type SampleDataset } from "@/config/sample-datasets";
import { computeDatasetStats, type DatasetStats } from "@/lib/analyze-table";

interface SampleCardMeta {
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  stats: string;
}

const MAX_STATIONS_SHOWN = 3;

/** Badge and stats line derived from the dataset itself, so card numbers always match the analysis. */
export function describeDataset(stats: DatasetStats | null): Pick<SampleCardMeta, "badge" | "stats"> {
  if (!stats) return { badge: "Unparseable", stats: "No rows could be parsed" };
  const shown = stats.stations.slice(0, MAX_STATIONS_SHOWN).join(", ");
  const more = stats.stations.length > MAX_STATIONS_SHOWN ? ` +${stats.stations.length - MAX_STATIONS_SHOWN} more` : "";
  const badge =
    stats.flagCount > 0
      ? `${stats.flagCount} sensor flag${stats.flagCount === 1 ? "" : "s"}`
      : stats.category
      ? `Avg: ${stats.category}`
      : "No flags";
  return { badge, stats: `${stats.rowCount} rows • ${shown}${more}` };
}

const STYLE_BY_ID: Record<string, Pick<SampleCardMeta, "icon" | "badgeColor">> = {
  "delhi-ward": {
    icon: <Building2 className="h-5 w-5 text-blue-500" aria-hidden="true" />,
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  "bengaluru-society": {
    icon: <Home className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  "mumbai-schools": {
    icon: <School className="h-5 w-5 text-amber-500" aria-hidden="true" />,
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
};

const DEFAULT_STYLE: Pick<SampleCardMeta, "icon" | "badgeColor"> = {
  icon: <Database className="h-5 w-5 text-muted-foreground" aria-hidden="true" />,
  badgeColor: "bg-muted text-muted-foreground border-border",
};

// Sample data is static, so compute each card's stats once at module load.
const SAMPLE_META: Record<string, SampleCardMeta> = Object.fromEntries(
  SAMPLE_DATASETS.map((sample) => [
    sample.id,
    { ...(STYLE_BY_ID[sample.id] ?? DEFAULT_STYLE), ...describeDataset(computeDatasetStats(sample.data)) },
  ])
);

interface SampleButtonsProps {
  onSelectSample: (sample: SampleDataset) => void;
  selectedSampleId?: string;
}

export function SampleButtons({ onSelectSample, selectedSampleId }: SampleButtonsProps) {
  const getCleanName = (name: string) => name.replace(/^\[Sample\]\s*/i, "");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span>Curated Telemetry Datasets</span>
        </label>
        <span className="text-xs text-muted-foreground">
          Click to load verified civic data
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {SAMPLE_DATASETS.map((sample) => {
          const isSelected = selectedSampleId === sample.id;
          const meta = SAMPLE_META[sample.id];

          return (
            <div
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSample(sample);
                }
              }}
              className={`group flex items-start justify-between gap-4 p-4 rounded-xl border transition-all cursor-pointer text-left ${
                isSelected
                  ? "bg-card border-primary ring-1 ring-primary shadow-sm"
                  : "bg-card hover:bg-muted/50 border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted border border-border shrink-0 mt-0.5">
                  {meta.icon}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {getCleanName(sample.name)}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.badgeColor}`}>
                      {meta.badge}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
                    {sample.description}
                  </p>

                  <p className="text-[11px] text-muted-foreground/80 font-mono">
                    {meta.stats}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-center pl-2">
                {isSelected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Loaded</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                    <span>Load</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
