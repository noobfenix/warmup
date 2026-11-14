"use client";

import React, { useState } from "react";
import type { NormalizedRow } from "@/lib/table-parser";
import { Table, Eye, Layers } from "lucide-react";
import { getAqiCategory } from "@/lib/cpcb";

interface TableViewerProps {
  rows: NormalizedRow[];
  highlightedRowIndices?: number[];
  onSelectRow?: (rowIndex: number) => void;
}

export function TableViewer({ rows, highlightedRowIndices = [], onSelectRow }: TableViewerProps) {
  const [showRaw, setShowRaw] = useState<boolean>(false);

  if (rows.length === 0) return null;

  const getCategoryBadgeClass = (category: string | null) => {
    switch (category) {
      case "Good":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "Satisfactory":
        return "bg-lime-500/15 text-lime-600 dark:text-lime-400 border-lime-500/30";
      case "Moderate":
        return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
      case "Poor":
        return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
      case "Very Poor":
        return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
      case "Severe":
        return "bg-rose-900/30 text-rose-500 dark:text-rose-400 border-rose-500/40 font-bold";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs space-y-0">
      <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-primary" />
          <span className="font-semibold text-xs text-foreground">
            Normalized Air Quality Telemetry Table ({rows.length} Rows)
          </span>
          {highlightedRowIndices.length > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Highlighting {highlightedRowIndices.length} row(s) [
              {highlightedRowIndices.join(", ")}]
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1 rounded bg-muted border border-border cursor-pointer transition"
        >
          <Layers className="h-3.5 w-3.5" />
          <span>{showRaw ? "Show Normalized Data" : "Show Raw Input Data"}</span>
        </button>
      </div>

      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/80 text-muted-foreground font-mono text-[11px] uppercase border-b border-border sticky top-0 z-10 backdrop-blur">
            <tr>
              <th className="p-2.5">#</th>
              <th className="p-2.5">Station / Location</th>
              <th className="p-2.5">Timestamp</th>
              <th className="p-2.5">PM2.5 (&mu;g/m&sup3;)</th>
              <th className="p-2.5">PM10 (&mu;g/m&sup3;)</th>
              <th className="p-2.5">NO2 (&mu;g/m&sup3;)</th>
              <th className="p-2.5">AQI</th>
              <th className="p-2.5">CPCB Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const isHighlighted = highlightedRowIndices.includes(row.sourceRowIndex);
              return (
                <tr
                  key={row.sourceRowIndex}
                  onClick={() => onSelectRow && onSelectRow(row.sourceRowIndex)}
                  className={`transition cursor-pointer ${
                    isHighlighted
                      ? "bg-primary/20 ring-1 ring-primary/40 font-medium"
                      : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <td className="p-2.5 font-mono font-bold text-muted-foreground">
                    #{row.sourceRowIndex}
                  </td>
                  <td className="p-2.5 font-medium text-foreground">{row.station}</td>
                  <td className="p-2.5 text-muted-foreground font-mono text-[11px]">
                    {row.timestamp || "—"}
                  </td>
                  <td className="p-2.5 font-mono">
                    {showRaw
                      ? row.rawValues["PM2.5"] || "—"
                      : row.values["PM2.5"] !== null && row.values["PM2.5"] !== undefined
                      ? row.values["PM2.5"]
                      : "—"}
                  </td>
                  <td className="p-2.5 font-mono">
                    {showRaw
                      ? row.rawValues["PM10"] || "—"
                      : row.values["PM10"] !== null && row.values["PM10"] !== undefined
                      ? row.values["PM10"]
                      : "—"}
                  </td>
                  <td className="p-2.5 font-mono">
                    {showRaw
                      ? row.rawValues["NO2"] || "—"
                      : row.values["NO2"] !== null && row.values["NO2"] !== undefined
                      ? row.values["NO2"]
                      : "—"}
                  </td>
                  <td className="p-2.5 font-mono font-bold">
                    {row.calculatedAqi !== null ? (
                      <span className="text-foreground">{row.calculatedAqi}</span>
                    ) : (
                      <span className="text-muted-foreground italic">None</span>
                    )}
                  </td>
                  <td className="p-2.5">
                    {row.cpcbCategory ? (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
                          row.cpcbCategory
                        )}`}
                      >
                        {row.cpcbCategory}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
