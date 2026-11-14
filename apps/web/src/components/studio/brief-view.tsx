"use client";

import React, { useState } from "react";
import {
  FileText,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Users,
  Baby,
  HeartPulse,
  Award,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Printer,
  Sparkles,
} from "lucide-react";
import type { CivicBriefResponse } from "@/lib/brief-validator";
import type { ComputedFact } from "@/lib/flags-and-facts";

interface BriefViewProps {
  brief: CivicBriefResponse;
  facts: ComputedFact[];
  onSelectFact: (factId: string) => void;
  lang?: string;
  auditInfo?: {
    groundingScore: number;
    passedAuditing: boolean;
    rejectedFindingsCount: number;
    rejectedFindings?: any[];
  };
}

export function BriefView({ brief, facts, onSelectFact, auditInfo, lang = "en" }: BriefViewProps) {
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [copiedFull, setCopiedFull] = useState<boolean>(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);

  const copyToClipboard = (text: string, type: "note" | "full" | "markdown") => {
    navigator.clipboard.writeText(text);
    if (type === "note") {
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    } else if (type === "full") {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    } else {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    }
  };

  const generateMarkdownBrief = () => {
    return `# OFFICIAL CIVIC AIR QUALITY BRIEFING
**Audience**: ${brief.audience.replace("_", " ").toUpperCase()}
**Language**: ${brief.language.toUpperCase()} | **Tone**: ${brief.readingLevel.toUpperCase()}
**Model**: ${brief.modelUsed || "Gemini"}

## Executive Summary
${brief.executiveSummary}

## Audited Telemetry Findings
${brief.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.finding} (${f.factIds.map((id) => `[${id}]`).join(" ")})`).join("\n")}

## Operational Directives
${brief.prioritizedActions.map((a) => `- **[${a.priority}]** ${a.action} (Target: ${a.targetGroup})`).join("\n")}

## Demographic Protection Advisory
- **General Public**: ${brief.citizenAdvisory.generalPublic}
- **Children & Students**: ${brief.citizenAdvisory.vulnerableGroups.children}
- **Older Adults**: ${brief.citizenAdvisory.vulnerableGroups.olderAdults}
- **Respiratory / Sensitive**: ${brief.citizenAdvisory.vulnerableGroups.sensitivePeople}

## Administrative Internal Note
\`\`\`
${brief.internalBriefingNote}
\`\`\`

---
*Compliance Notice: ${brief.medicalDisclaimer}*`;
  };

  const getSeverityBadge = (severity: "info" | "warning" | "critical") => {
    switch (severity) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
            Informational
          </span>
        );
    }
  };

  const getPriorityClasses = (priority: string) => {
    if (priority.includes("Immediate")) {
      return {
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        container: "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50",
      };
    }
    if (priority.includes("Short-term")) {
      return {
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        container: "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50",
      };
    }
    return {
      badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
      container: "border-border bg-card hover:bg-muted/30",
    };
  };

  return (
    <article lang={lang} className="rounded-xl border border-border bg-card shadow-xs overflow-hidden space-y-6 pb-6">
      {/* Header Bar */}
      <div className="border-b border-border bg-muted/30 p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Audience: {brief.audience.replace("_", " ")}
              </span>
              <span className="uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                Language: {brief.language}
              </span>
              <span className="uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                Tone: {brief.readingLevel}
              </span>
              {brief.modelUsed && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 font-mono text-[11px]">
                  <Sparkles className="h-3 w-3" />
                  {brief.modelUsed}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
              {brief.title}
            </h1>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => copyToClipboard(generateMarkdownBrief(), "markdown")}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition cursor-pointer shadow-xs font-medium"
              title="Copy formatted Markdown brief"
            >
              {copiedMarkdown ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedMarkdown ? "Copied" : "Copy Brief"}</span>
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(JSON.stringify(brief, null, 2), "full")}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition cursor-pointer shadow-xs font-medium"
              title="Export structured JSON"
            >
              {copiedFull ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <FileText className="h-3.5 w-3.5" />}
              <span>{copiedFull ? "Copied" : "JSON"}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-border bg-background hover:bg-muted transition cursor-pointer shadow-xs"
              title="Print Brief"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Fact Grounding Seal: reflects the server audit result, never a fixed claim */}
        {(() => {
          const score = auditInfo?.groundingScore;
          const rejected = auditInfo?.rejectedFindingsCount ?? 0;
          const passed = auditInfo ? auditInfo.passedAuditing && rejected === 0 : null;
          const tone =
            passed === null
              ? "bg-muted border-border text-muted-foreground"
              : passed
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400";
          return (
            <div
              role="status"
              className={`rounded-lg border p-3 flex items-center justify-between text-xs flex-wrap gap-2 font-medium ${tone}`}
            >
              <div className="flex items-center gap-2.5">
                {passed === false ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <Award className="h-4 w-4 shrink-0" />}
                <span>
                  {passed === null
                    ? "Fact-ID audit result unavailable for this brief"
                    : `Fact-ID audit: ${typeof score === "number" ? score : "—"}% of findings cite known facts`}
                </span>
              </div>
              {rejected > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-mono text-xs font-bold">
                  Removed {rejected} finding{rejected === 1 ? "" : "s"} citing unknown Fact IDs
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Main Content Stream */}
      <div className="px-6 sm:px-7 space-y-7">
        {/* Executive Summary */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Executive Summary
          </h2>
          <p className="text-sm sm:text-base text-foreground leading-relaxed text-pretty font-normal">
            {brief.executiveSummary}
          </p>
        </section>

        {/* Audited Civic Findings */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Audited Civic Findings ({brief.findings.length})</span>
            </h2>
            <span className="text-xs text-muted-foreground">
              Click [F#] tags to inspect raw records
            </span>
          </div>

          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
            {brief.findings.map((item, idx) => (
              <div
                key={idx}
                className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-baseline justify-between gap-2.5"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityBadge(item.severity)}
                    {item.factIds.map((fId) => (
                      <button
                        key={fId}
                        type="button"
                        onClick={() => onSelectFact(fId)}
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition cursor-pointer"
                        title={`Inspect source data rows for ${fId}`}
                      >
                        <span>{fId}</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed text-pretty">
                    {item.finding}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Operational Directives */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Operational Directives for {brief.audience.replace("_", " ")}</span>
            </h2>
            <span className="text-xs text-muted-foreground">
              Prioritized by response timeline
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {brief.prioritizedActions.map((action, idx) => {
              const styles = getPriorityClasses(action.priority);
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 transition-colors ${styles.container}`}
                >
                  <div className="space-y-2">
                    <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles.badge}`}>
                      {action.priority}
                    </span>
                    <p className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">
                      {action.action}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Target: <strong className="text-foreground">{action.targetGroup}</strong></span>
                    {action.rationaleFactIds && action.rationaleFactIds.length > 0 && (
                      <div className="flex gap-1 font-mono">
                        {action.rationaleFactIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onSelectFact(id)}
                            className="text-xs font-bold text-primary hover:underline cursor-pointer"
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Citizen Public Advisory */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Public Guidance &amp; Demographic Protection</span>
            </h2>
            <span className="text-xs text-muted-foreground">
              Community dissemination rules
            </span>
          </div>

          {/* General Public */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1">
            <span className="text-xs font-semibold text-primary block">
              General Community Advisory
            </span>
            <p className="text-xs sm:text-sm text-foreground leading-relaxed text-pretty">
              {brief.citizenAdvisory.generalPublic}
            </p>
          </div>

          {/* Vulnerable Groups */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                <Baby className="h-4 w-4" />
                <span>Children &amp; Schools</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
                {brief.citizenAdvisory.vulnerableGroups.children}
              </p>
            </div>

            <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-purple-600 dark:text-purple-400">
                <Users className="h-4 w-4" />
                <span>Senior Citizens</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
                {brief.citizenAdvisory.vulnerableGroups.olderAdults}
              </p>
            </div>

            <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-400">
                <HeartPulse className="h-4 w-4" />
                <span>Sensitive / Respiratory</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
                {brief.citizenAdvisory.vulnerableGroups.sensitivePeople}
              </p>
            </div>
          </div>
        </section>

        {/* Administrative Internal Note */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              <span>Administrative Internal Briefing Note</span>
            </h2>
            <button
              type="button"
              onClick={() => copyToClipboard(brief.internalBriefingNote, "note")}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-muted cursor-pointer transition"
            >
              {copiedNote ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span>{copiedNote ? "Copied" : "Copy Note"}</span>
            </button>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border border-border font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {brief.internalBriefingNote}
          </div>
        </section>

        {/* Public Health & Non-Medical Guardrail */}
        <div className="rounded-lg border border-border bg-muted/40 p-4 flex items-start gap-3 text-xs text-muted-foreground">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">
              Official Non-Medical Civic Guardrail
            </span>
            <p className="leading-relaxed text-xs">{brief.medicalDisclaimer}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
