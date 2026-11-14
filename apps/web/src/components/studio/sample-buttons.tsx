"use client";

import React from "react";
import { Button } from "@warmup/ui/components/button";
import { Database, Building2, School, MapPin } from "lucide-react";
import { SAMPLE_DATASETS, type SampleDataset } from "@/config/sample-datasets";

interface SampleButtonsProps {
  onSelectSample: (sample: SampleDataset) => void;
  selectedSampleId?: string;
}

export function SampleButtons({ onSelectSample, selectedSampleId }: SampleButtonsProps) {
  const getIcon = (id: string) => {
    switch (id) {
      case "delhi-ward":
        return <Building2 className="h-3.5 w-3.5 text-blue-500" />;
      case "bengaluru-society":
        return <MapPin className="h-3.5 w-3.5 text-emerald-500" />;
      case "mumbai-schools":
        return <School className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <Database className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" /> Sample Civic Datasets (Labeled as Sample)
        </label>
        <span className="text-[11px] text-muted-foreground">Click to load pre-verified civic data</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {SAMPLE_DATASETS.map((sample) => {
          const isSelected = selectedSampleId === sample.id;
          return (
            <button
              key={sample.id}
              type="button"
              onClick={() => onSelectSample(sample)}
              className={`flex flex-col text-left p-2.5 rounded-lg border transition-all text-xs ${
                isSelected
                  ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30"
                  : "bg-card hover:bg-accent/50 border-border"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                {getIcon(sample.id)}
                <span>{sample.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {sample.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
