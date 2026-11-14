"use client";

import React, { useState, useMemo } from "react";
import type { NormalizedRow } from "@/lib/table-parser";
import { Table, Layers, Search } from "lucide-react";

interface TableViewerProps {
  rows: NormalizedRow[];
  highlightedRowIndices?: number[];
  onSelectRow?: (rowIndex: number) => void;
}

export function TableViewer({ rows, highlightedRowIndices = [], onSelectRow }: TableViewerProps) {
  const [showRaw, setShowRaw] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (rows.length === 0) return null;

  const getCategoryBadgeClass = (category: string | null) => {
    switch (category) {
      case "Good":
        return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border-emerald-500/30";
      case "Satisfactory":
        return "bg-lime-500/15 text-lime-800 dark:text-lime-400 border-lime-500/30";
      case "Moderate":
        return "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30";
      case "Poor":
        return "bg-orange-500/15 text-orange-900 dark:text-orange-300 border-orange-500/30";
      case "Very Poor":
        return "bg-rose-500/15 text-rose-800 dark:text-rose-400 border-rose-500/30";
      case "Severe":
        return "bg-rose-950/40 text-rose-900 dark:text-rose-300 border-rose-500/40 font-bold";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.station.toLowerCase().includes(q) ||
        (r.cpcbCategory && r.cpcbCategory.toLowerCase().includes(q)) ||
        (r.timestamp && r.timestamp.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs space-y-0">
      {/* Table Action Bar */}
      <div className="bg-muted/40 border-b border-border px-5 py-3 flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-2.5">
          <Table className="h-4 w-4 text-primary" />
          <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
            Audited Telemetry Registry ({rows.length} Total Rows)
          </span>
          {highlightedRowIndices.length > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold">
              Highlighting #{highlightedRowIndices.join(", #")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filter */}
          <div className="relative">
            <Search className="h-3 w-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter stations..."
              aria-label="Filter stations or pollutants"
              className="text-xs pl-7 pr-2.5 py-1 rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-32 sm:w-40"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            aria-label={showRaw ? "Switch to normalized data view" : "Switch to raw data view"}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border cursor-pointer transition shadow-xs"
          >
            <Layers className="h-3 w-3" aria-hidden="true" />
            <span>{showRaw ? "Normalized Data" : "Raw Data"}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-xs text-left border-collapse" aria-label="Audited Telemetry Registry">
          <caption className="sr-only">Audited air quality telemetry table records and CPCB statuses</caption>
          <thead className="bg-muted/80 text-muted-foreground font-mono text-[11px] uppercase tracking-wider border-b border-border sticky top-0 z-10 backdrop-blur-md">
            <tr>
              <th scope="col" className="p-3 pl-4">
                <span className="sr-only">Row Number</span>
                <span aria-hidden="true">#</span>
              </th>
              <th scope="col" className="p-3">Station / Location</th>
              <th scope="col" className="p-3">Timestamp</th>
              <th scope="col" className="p-3 font-mono text-right">PM2.5</th>
              <th scope="col" className="p-3 font-mono text-right">PM10</th>
              <th scope="col" className="p-3 font-mono text-right">NO2</th>
              <th scope="col" className="p-3 font-mono text-right">AQI</th>
              <th scope="col" className="p-3 pr-4">CPCB Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.map((row) => {
              const isHighlighted = highlightedRowIndices.includes(row.sourceRowIndex);
              return (
                <tr
                  key={row.sourceRowIndex}
                  onClick={() => onSelectRow && onSelectRow(row.sourceRowIndex)}
                  className={`transition-colors cursor-pointer ${isHighlighted
                      ? "bg-primary/15 font-medium ring-1 ring-inset ring-primary/40"
                      : "bg-card hover:bg-muted/30"
                    }`}
                >
                  <td className="p-3 pl-4 font-mono text-xs text-muted-foreground font-bold">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRow && onSelectRow(row.sourceRowIndex);
                      }}
                      aria-label={`Inspect row ${row.sourceRowIndex} for station ${row.station}`}
                      className="font-mono text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer rounded px-1 -ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      #{row.sourceRowIndex}
                    </button>
                  </td>
                  <td className="p-3 font-semibold text-foreground">{row.station}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">
                    {row.timestamp || "—"}
                  </td>
                  <td className="p-3 font-mono text-right tabular-nums text-foreground/90">
                    {showRaw
                      ? row.rawValues["PM2.5"] || "—"
                      : row.values["PM2.5"] !== null && row.values["PM2.5"] !== undefined
                        ? row.values["PM2.5"]
                        : "—"}
                  </td>
                  <td className="p-3 font-mono text-right tabular-nums text-foreground/90">
                    {showRaw
                      ? row.rawValues["PM10"] || "—"
                      : row.values["PM10"] !== null && row.values["PM10"] !== undefined
                        ? row.values["PM10"]
                        : "—"}
                  </td>
                  <td className="p-3 font-mono text-right tabular-nums text-foreground/90">
                    {showRaw
                      ? row.rawValues["NO2"] || "—"
                      : row.values["NO2"] !== null && row.values["NO2"] !== undefined
                        ? row.values["NO2"]
                        : "—"}
                  </td>
                  <td className="p-3 font-mono text-right font-bold tabular-nums">
                    {row.calculatedAqi !== null ? (
                      <span className="text-foreground">{row.calculatedAqi}</span>
                    ) : (
                      <span className="text-muted-foreground italic font-normal">—</span>
                    )}
                  </td>
                  <td className="p-3 pr-4">
                    {row.cpcbCategory ? (
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
                          row.cpcbCategory
                        )}`}
                      >
                        {row.cpcbCategory}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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
