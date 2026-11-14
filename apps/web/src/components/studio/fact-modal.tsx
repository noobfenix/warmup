"use client";

import React, { useEffect } from "react";
import { X, CheckCircle2, Table, ArrowRight, ShieldCheck, Database } from "lucide-react";
import type { ComputedFact } from "@/lib/flags-and-facts";
import type { NormalizedRow } from "@/lib/table-parser";

interface FactModalProps {
  fact: ComputedFact | null;
  onClose: () => void;
  allRows: NormalizedRow[];
  onHighlightRows?: (indices: number[]) => void;
}

export function FactModal({ fact, onClose, allRows, onHighlightRows }: FactModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!fact) return null;

  const relevantRows = allRows.filter((r) =>
    fact.sourceRowIndices.includes(r.sourceRowIndex)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fact-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
    >
      <div className="bg-card text-card-foreground border border-border w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-primary text-primary-foreground">
              {fact.id}
            </span>
            <h2 id="fact-modal-title" className="font-bold text-base text-foreground">
              {fact.title}
            </h2>
            <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {fact.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close fact inspector"
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Fact Statement */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-1">
            <span className="text-xs font-semibold text-primary block uppercase tracking-wide">
              Mathematically Verified Statement
            </span>
            <p className="text-sm font-medium text-foreground leading-relaxed text-pretty">
              &ldquo;{fact.statement}&rdquo;
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-muted-foreground block text-[11px]">Metric</span>
              <span className="font-semibold text-foreground text-xs mt-0.5 block">{fact.metric}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-muted-foreground block text-[11px]">Computed Value</span>
              <span className="font-semibold text-foreground text-xs mt-0.5 block tabular-nums">
                {fact.value} {fact.unit}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-muted-foreground block text-[11px]">Target Station</span>
              <span className="font-semibold text-foreground text-xs mt-0.5 truncate block">
                {fact.station}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <span className="text-muted-foreground block text-[11px]">CPCB Category</span>
              <span className="font-semibold text-foreground text-xs mt-0.5 block">
                {fact.cpcbCategory || "N/A"}
              </span>
            </div>
          </div>

          {/* Source Rows Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>Audited Source Telemetry Rows ({fact.sourceRowIndices.length})</span>
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                Indices: [{fact.sourceRowIndices.join(", ")}]
              </span>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto max-h-56 bg-background">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/70 text-muted-foreground font-mono text-[11px] uppercase tracking-wide border-b border-border">
                  <tr>
                    <th className="p-2.5 pl-3">Row #</th>
                    <th className="p-2.5">Station</th>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5 font-mono text-right">PM2.5</th>
                    <th className="p-2.5 font-mono text-right">PM10</th>
                    <th className="p-2.5 font-mono text-right">AQI</th>
                    <th className="p-2.5 pr-3">CPCB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {relevantRows.map((row) => (
                    <tr key={row.sourceRowIndex} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 pl-3 font-mono font-bold text-primary">
                        #{row.sourceRowIndex}
                      </td>
                      <td className="p-2.5 font-medium text-foreground">{row.station}</td>
                      <td className="p-2.5 text-muted-foreground font-mono text-xs">
                        {row.timestamp || "—"}
                      </td>
                      <td className="p-2.5 font-mono text-right tabular-nums text-foreground/90">
                        {row.values["PM2.5"] !== undefined && row.values["PM2.5"] !== null
                          ? `${row.values["PM2.5"]}`
                          : "—"}
                      </td>
                      <td className="p-2.5 font-mono text-right tabular-nums text-foreground/90">
                        {row.values["PM10"] !== undefined && row.values["PM10"] !== null
                          ? `${row.values["PM10"]}`
                          : "—"}
                      </td>
                      <td className="p-2.5 font-mono text-right font-bold tabular-nums text-foreground">
                        {row.calculatedAqi !== null ? row.calculatedAqi : "—"}
                      </td>
                      <td className="p-2.5 pr-3">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted border border-border">
                          {row.cpcbCategory || "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between text-xs flex-wrap gap-2">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            100% Mathematical Proof &bull; Zero Hallucination
          </span>
          <button
            type="button"
            onClick={() => {
              if (onHighlightRows) onHighlightRows(fact.sourceRowIndices);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs cursor-pointer shadow-xs transition"
          >
            <span>Highlight in Telemetry Table</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
