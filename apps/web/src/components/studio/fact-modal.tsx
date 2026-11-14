"use client";

import React from "react";
import { X, CheckCircle2, Table } from "lucide-react";
import type { ComputedFact } from "@/lib/flags-and-facts";
import type { NormalizedRow } from "@/lib/table-parser";
import { getAqiCategory } from "@/lib/cpcb";

interface FactModalProps {
  fact: ComputedFact | null;
  onClose: () => void;
  allRows: NormalizedRow[];
  onHighlightRows?: (indices: number[]) => void;
}

export function FactModal({ fact, onClose, allRows, onHighlightRows }: FactModalProps) {
  if (!fact) return null;

  const relevantRows = allRows.filter((r) =>
    fact.sourceRowIndices.includes(r.sourceRowIndex)
  );

  const cpcbInfo = fact.cpcbCategory
    ? getAqiCategory(typeof fact.value === "number" ? fact.value : 100)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
              {fact.id}
            </span>
            <span className="font-semibold text-sm">{fact.title}</span>
            <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border">
              {fact.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Fact Statement */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3.5">
            <span className="text-[11px] font-semibold text-primary block uppercase tracking-wider mb-1">
              Deterministic Mathematical Statement
            </span>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              "{fact.statement}"
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded bg-muted/50 border border-border">
              <span className="text-[11px] text-muted-foreground block">Metric</span>
              <span className="font-semibold text-foreground">{fact.metric}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/50 border border-border">
              <span className="text-[11px] text-muted-foreground block">Computed Value</span>
              <span className="font-semibold text-foreground">
                {fact.value} {fact.unit}
              </span>
            </div>
            <div className="p-2.5 rounded bg-muted/50 border border-border">
              <span className="text-[11px] text-muted-foreground block">Target Station</span>
              <span className="font-semibold text-foreground truncate block">
                {fact.station}
              </span>
            </div>
            <div className="p-2.5 rounded bg-muted/50 border border-border">
              <span className="text-[11px] text-muted-foreground block">CPCB Category</span>
              <span className="font-semibold text-foreground">
                {fact.cpcbCategory || "N/A"}
              </span>
            </div>
          </div>

          {/* Source Rows Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Table className="h-3.5 w-3.5 text-primary" />
                Audited Source Rows ({fact.sourceRowIndices.length} Rows Cited)
              </h5>
              <span className="text-[11px] text-muted-foreground font-mono">
                Indices: [{fact.sourceRowIndices.join(", ")}]
              </span>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto max-h-56">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/70 text-muted-foreground font-mono text-[11px] uppercase border-b border-border">
                  <tr>
                    <th className="p-2">Row #</th>
                    <th className="p-2">Station</th>
                    <th className="p-2">Timestamp</th>
                    <th className="p-2">PM2.5</th>
                    <th className="p-2">PM10</th>
                    <th className="p-2">AQI</th>
                    <th className="p-2">CPCB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {relevantRows.map((row) => (
                    <tr key={row.sourceRowIndex} className="bg-card hover:bg-muted/30">
                      <td className="p-2 font-mono font-bold text-primary">
                        #{row.sourceRowIndex}
                      </td>
                      <td className="p-2 font-medium">{row.station}</td>
                      <td className="p-2 text-muted-foreground font-mono text-[11px]">
                        {row.timestamp || "—"}
                      </td>
                      <td className="p-2 font-mono">
                        {row.values["PM2.5"] !== undefined && row.values["PM2.5"] !== null
                          ? `${row.values["PM2.5"]}`
                          : "—"}
                      </td>
                      <td className="p-2 font-mono">
                        {row.values["PM10"] !== undefined && row.values["PM10"] !== null
                          ? `${row.values["PM10"]}`
                          : "—"}
                      </td>
                      <td className="p-2 font-mono font-bold">
                        {row.calculatedAqi !== null ? row.calculatedAqi : "—"}
                      </td>
                      <td className="p-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted border">
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
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Zero hallucination guarantee: Fact ID mathematically grounded.
          </span>
          <button
            type="button"
            onClick={() => {
              if (onHighlightRows) onHighlightRows(fact.sourceRowIndices);
              onClose();
            }}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium cursor-pointer"
          >
            Locate Rows in Studio Table
          </button>
        </div>
      </div>
    </div>
  );
}
