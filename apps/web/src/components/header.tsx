"use client";

import React from "react";
import { Wind, ShieldCheck, Sparkles, Activity } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-foreground">
                Civic Air Quality Briefing Studio
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-3 w-3" /> CPCB NAQI Standard
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Verifiable, audience-targeted civic briefings grounded in deterministic telemetry facts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md font-mono">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            <span className="hidden md:inline">Telemetry Engine:</span> Active
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
            <Sparkles className="h-3.5 w-3.5" />
            Gemini 2.5 Server-Side
          </span>
        </div>
      </div>
    </header>
  );
}
