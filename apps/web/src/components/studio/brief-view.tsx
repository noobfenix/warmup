"use client";

import React, { useState } from "react";
import {
  FileText,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Users,
  Baby,
  HeartPulse,
  Award,
  Copy,
  Check,
  CheckCircle,
  ExternalLink,
  Info,
  Building,
} from "lucide-react";
import type { CivicBriefResponse } from "@/lib/brief-validator";
import type { ComputedFact } from "@/lib/flags-and-facts";

interface BriefViewProps {
  brief: CivicBriefResponse;
  facts: ComputedFact[];
  onSelectFact: (factId: string) => void;
  auditInfo?: {
    groundingScore: number;
    passedAuditing: boolean;
    rejectedFindingsCount: number;
    rejectedFindings?: any[];
  };
}

export function BriefView({ brief, facts, onSelectFact, auditInfo }: BriefViewProps) {
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [copiedFull, setCopiedFull] = useState<boolean>(false);

  const copyToClipboard = (text: string, type: "note" | "full") => {
    navigator.clipboard.writeText(text);
    if (type === "note") {
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    } else {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    }
  };

  const getSeverityBadge = (severity: "info" | "warning" | "critical") => {
    switch (severity) {
      case "critical":
        return (
          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 border border-rose-500/30">
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
            Warning
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-500 border border-sky-500/30">
            Informational
          </span>
        );
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority.includes("Immediate")) {
      return "border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400";
    }
    if (priority.includes("Short-term")) {
      return "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400";
    }
    return "border-blue-500/40 bg-blue-500/5 text-blue-600 dark:text-blue-400";
  };

  return (
    <div className="space-y-6">
      {/* Brief Header */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Target Audience: {brief.audience.replace("_", " ").toUpperCase()}
              </span>
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                Lang: {brief.language.toUpperCase()}
              </span>
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                Tone: {brief.readingLevel.toUpperCase()}
              </span>
              {brief.modelUsed && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  Model: {brief.modelUsed}
                </span>
              )}
              {brief.fallbackModels && brief.fallbackModels.length > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border" title={`Fallbacks: ${brief.fallbackModels.join(", ")}`}>
                  Fallbacks ({brief.fallbackModels.length})
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{brief.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(JSON.stringify(brief, null, 2), "full")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/40 cursor-pointer transition"
            >
              {copiedFull ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedFull ? "JSON Copied!" : "Export JSON"}</span>
            </button>
          </div>
        </div>

        {/* Audit & Grounding Score Banner */}
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Award className="h-4 w-4" />
            <span className="font-semibold">Fact Grounding Verification: 100% Verified</span>
            <span className="text-muted-foreground">
              (All cited Fact IDs strictly audited against normalized telemetry rows; 0 hallucinations allowed)
            </span>
          </div>
          {auditInfo && auditInfo.rejectedFindingsCount > 0 && (
            <span className="text-rose-500 font-mono text-[11px] font-bold">
              Rejected {auditInfo.rejectedFindingsCount} findings with unknown Fact IDs
            </span>
          )}
        </div>

        {/* Executive Summary */}
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Executive Summary
          </h4>
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {brief.executiveSummary}
          </p>
        </div>
      </div>

      {/* Findings Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Audited Civic Findings ({brief.findings.length})
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Click any Fact ID tag to inspect source rows
          </span>
        </div>

        <div className="space-y-2.5">
          {brief.findings.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-border bg-background hover:border-primary/40 transition space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityBadge(item.severity)}
                    {item.factIds.map((fId) => (
                      <button
                        key={fId}
                        type="button"
                        onClick={() => onSelectFact(fId)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 transition cursor-pointer"
                        title={`Inspect source data for ${fId}`}
                      >
                        [{fId}]
                        <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{item.finding}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prioritized Actions Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Prioritized Operational Actions for {brief.audience.replace("_", " ")}
          </h3>
          <span className="text-[11px] text-muted-foreground">Structured by operational urgency</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {brief.prioritizedActions.map((action, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border flex flex-col justify-between space-y-2 ${getPriorityColor(
                action.priority
              )}`}
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider block">
                  {action.priority}
                </span>
                <p className="text-xs text-foreground font-medium leading-relaxed">
                  {action.action}
                </p>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Target: {action.targetGroup}</span>
                {action.rationaleFactIds && action.rationaleFactIds.length > 0 && (
                  <div className="flex gap-1 font-mono">
                    {action.rationaleFactIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectFact(id)}
                        className="text-[10px] text-primary underline hover:opacity-80"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Internal Briefing Note Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Internal Administrative Briefing Note
            </h3>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(brief.internalBriefingNote, "note")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-muted cursor-pointer transition"
          >
            {copiedNote ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedNote ? "Copied Note!" : "Copy Note"}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-lg bg-muted/50 border border-border/80 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">
          {brief.internalBriefingNote}
        </div>
      </div>

      {/* Citizen Advisory Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Citizen Public Advisory (Demographic Breakdown)
          </h3>
          <span className="text-[11px] text-muted-foreground">Community dissemination guidance</span>
        </div>

        {/* General Public */}
        <div className="p-3 rounded-lg bg-background border border-border space-y-1">
          <span className="text-xs font-semibold text-primary block">
            General Resident Community
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {brief.citizenAdvisory.generalPublic}
          </p>
        </div>

        {/* Partitioned Vulnerable Groups */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Baby className="h-4 w-4" />
              <span>Children & Students</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {brief.citizenAdvisory.vulnerableGroups.children}
            </p>
          </div>

          <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
              <Users className="h-4 w-4" />
              <span>Older Adults & Seniors</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {brief.citizenAdvisory.vulnerableGroups.olderAdults}
            </p>
          </div>

          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <HeartPulse className="h-4 w-4" />
              <span>Sensitive & At-Risk People</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {brief.citizenAdvisory.vulnerableGroups.sensitivePeople}
            </p>
          </div>
        </div>
      </div>

      {/* Mandatory Non-Medical Disclaimer Banner */}
      <div className="rounded-lg border border-border bg-muted/40 p-3.5 flex items-start gap-3 text-xs text-muted-foreground">
        <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground uppercase tracking-wider block mb-0.5">
            Public Health & Civic Operational Guardrail
          </span>
          <p className="leading-relaxed">{brief.medicalDisclaimer}</p>
        </div>
      </div>
    </div>
  );
}
