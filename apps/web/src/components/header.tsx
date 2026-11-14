"use client";

import React from "react";
import { Wind, ShieldCheck, Activity, Cpu } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
        {/* Brand & Context */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-foreground">
                Civic Air Quality Studio
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-3 w-3" /> CPCB NAQI Standard
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Verifiable civic briefings grounded in deterministic telemetry facts
            </p>
          </div>
        </div>

        {/* Operational Indicators */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-foreground font-medium text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline text-muted-foreground">Audit Engine:</span>
            <span>100% Grounded</span>
          </div>

          <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground text-xs font-medium">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <span>Gemini 2.5 Flash</span>
          </div>
        </div>
      </div>
    </header>
  );
}
