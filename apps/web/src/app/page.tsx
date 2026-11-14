"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Sparkles,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Key,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  FileText,
  Table,
  AlertOctagon,
  CheckCircle2,
  Wind,
} from "lucide-react";
import { analyzeRawTable } from "@/lib/analyze-table";
import type { AnalysisOutput } from "@/lib/flags-and-facts";
import { computeAirQualityDiff, type AirQualityDiff } from "@/lib/diff-engine";
import type { CivicBriefResponse, BriefAuditInfo } from "@/lib/brief-validator";
import type { SampleDataset } from "@/config/sample-datasets";
import { SampleButtons } from "@/components/studio/sample-buttons";
import { FlagsPanel } from "@/components/studio/flags-panel";
import { toast } from "sonner";

const TableViewer = dynamic(
  () => import("@/components/studio/table-viewer").then((mod) => mod.TableViewer),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        Loading tabular data...
      </div>
    ),
    ssr: false,
  }
);

const BriefView = dynamic(
  () => import("@/components/studio/brief-view").then((mod) => mod.BriefView),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        Loading briefing dossier...
      </div>
    ),
    ssr: false,
  }
);

const DiffPanel = dynamic(
  () => import("@/components/studio/diff-panel").then((mod) => mod.DiffPanel),
  {
    loading: () => (
      <div className="flex items-center justify-center p-6 text-muted-foreground text-sm">
        Loading telemetry comparison...
      </div>
    ),
    ssr: false,
  }
);

const FactModal = dynamic(
  () => import("@/components/studio/fact-modal").then((mod) => mod.FactModal),
  { ssr: false }
);

interface StoredBriefRecord {
  brief: CivicBriefResponse;
  analysis: AnalysisOutput;
  timestamp: string;
}

const STORAGE_KEY = "civic_brief_history";

export default function CivicStudioPage() {
  // Input states
  const [rawText, setRawText] = useState<string>("");
  const [selectedSampleId, setSelectedSampleId] = useState<string>("");

  // Optional custom API key (server-side POST request header)
  const [customKey, setCustomKey] = useState<string>("");
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  // Configuration options
  const [audience, setAudience] = useState<"ward_officer" | "housing_society" | "school">("ward_officer");
  const [language, setLanguage] = useState<"en" | "hi" | "mr" | "ta">("en");
  const [readingLevel, setReadingLevel] = useState<"executive" | "standard" | "accessible">("standard");

  // Analysis state
  const [analysis, setAnalysis] = useState<AnalysisOutput | null>(null);
  const [brief, setBrief] = useState<CivicBriefResponse | null>(null);
  const [auditInfo, setAuditInfo] = useState<BriefAuditInfo | null>(null);
  const [diff, setDiff] = useState<AirQualityDiff | null>(null);
  const [briefParams, setBriefParams] = useState<{
    audience: typeof audience;
    language: typeof language;
    readingLevel: typeof readingLevel;
  } | null>(null);

  // Inspector & UI state
  const [inspectFactId, setInspectFactId] = useState<string | null>(null);
  const [highlightedRowIndices, setHighlightedRowIndices] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"brief" | "table" | "flags">("brief");

  // In-memory cache for synthesized briefs to avoid duplicate API calls for identical parameters
  const briefCacheRef = useRef<Map<string, { brief: CivicBriefResponse; audit: BriefAuditInfo }>>(new Map());

  // Debounce timer ref to prevent main-thread lag during manual text typing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Deterministic local processing in pure TypeScript
  const processInputData = useCallback((text: string) => {
    try {
      setError(null);
      if (!text.trim()) {
        setAnalysis(null);
        return;
      }

      const analyzed = analyzeRawTable(text);
      if (!analyzed || analyzed.normalizedRows.length === 0) {
        setError("Could not parse valid tabular headers or rows. Please ensure CSV, TSV, or JSON format.");
        setAnalysis(null);
        return;
      }

      setAnalysis(analyzed);
    } catch (err) {
      console.error("Data processing error:", err);
      setError("Failed to parse tabular data. Please ensure valid delimiter (comma, tab, semicolon) or JSON.");
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRawText(newText);
    setSelectedSampleId("");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!newText.trim()) {
      setAnalysis(null);
      setError(null);
      return;
    }

    // 250ms debounce for typing efficiency
    debounceTimerRef.current = setTimeout(() => {
      processInputData(newText);
    }, 250);
  };

  const handleSelectSample = (sample: SampleDataset) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSelectedSampleId(sample.id);
    setRawText(sample.data);
    setAudience(sample.defaultAudience);
    processInputData(sample.data);
    toast.success(`Loaded dataset: ${sample.name.replace(/^\[Sample\]\s*/i, "")}`);
  };

  const handleClearData = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setRawText("");
    setSelectedSampleId("");
    setAnalysis(null);
    setBrief(null);
    setBriefParams(null);
    setAuditInfo(null);
    setDiff(null);
    setHighlightedRowIndices([]);
    toast.info("Workbench data cleared.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setSelectedSampleId("");
        processInputData(content);
        toast.success(`Loaded ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  // Keyboard navigation for ARIA tablist
  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const tabList: ("brief" | "table" | "flags")[] = ["brief", "table", "flags"];
    const currentIndex = tabList.indexOf(activeTab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextTab = tabList[(currentIndex + 1) % tabList.length];
      setActiveTab(nextTab);
      document.getElementById(`tab-${nextTab}`)?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevTab = tabList[(currentIndex - 1 + tabList.length) % tabList.length];
      setActiveTab(prevTab);
      document.getElementById(`tab-${prevTab}`)?.focus();
    }
  };

  // Generate Briefing flow with in-memory caching
  const handleGenerateBrief = async () => {
    if (!analysis || analysis.normalizedRows.length === 0) {
      setError("Please paste or load tabular air quality data first.");
      return;
    }

    // Cache key based on data signature and briefing options
    const cacheKey = `${analysis.normalizedRows.length}_${analysis.summary.overallAverageAqi}_${analysis.summary.peakAqi}_${audience}_${language}_${readingLevel}_${customKey.trim()}`;

    // Read previous brief for chronological diff
    let previousRecord: StoredBriefRecord | null = null;
    try {
      const storedJson = localStorage.getItem(STORAGE_KEY);
      if (storedJson) {
        previousRecord = JSON.parse(storedJson);
      }
    } catch (e) {
      console.warn("Could not read previous brief from storage:", e);
    }

    const calculatedDiff = computeAirQualityDiff(
      analysis,
      previousRecord?.analysis || null,
      previousRecord?.timestamp
    );

    // If already generated in this session with identical inputs, reuse instantaneously
    if (briefCacheRef.current.has(cacheKey)) {
      const cached = briefCacheRef.current.get(cacheKey)!;
      setDiff(calculatedDiff);
      setBrief(cached.brief);
      setBriefParams({ audience, language, readingLevel });
      setAuditInfo(cached.audit);
      setActiveTab("brief");
      toast.success("Loaded briefing from instantaneous session cache!");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call server API
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customKey.trim()) {
        headers["x-gemini-api-key"] = customKey.trim();
      }

      const res = await fetch("/api/air-quality/generate-brief", {
        method: "POST",
        headers,
        body: JSON.stringify({
          facts: analysis.facts,
          flags: analysis.flags,
          summary: analysis.summary,
          audience,
          language,
          readingLevel,
          diff: calculatedDiff,
        }),
      });

      const responseData = await res.json();

      if (!res.ok || !responseData.success) {
        throw new Error(responseData.error || "Failed to generate briefing from server.");
      }

      const generatedBrief: CivicBriefResponse = responseData.data;
      const returnedAudit: BriefAuditInfo = responseData.audit;

      // Update in-memory session cache
      briefCacheRef.current.set(cacheKey, { brief: generatedBrief, audit: returnedAudit });

      setDiff(calculatedDiff);
      setBrief(generatedBrief);
      setBriefParams({ audience, language, readingLevel });
      setAuditInfo(returnedAudit);
      setActiveTab("brief");

      // Save to localStorage for chronological comparison
      try {
        const newRecord: StoredBriefRecord = {
          brief: generatedBrief,
          analysis,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecord));
      } catch (saveErr) {
        console.warn("Failed to save brief to localStorage:", saveErr);
      }

      toast.success("Civic briefing successfully synthesized and audited!");
    } catch (err: unknown) {
      console.error("Brief generation error:", err);
      const msg = err instanceof Error ? err.message : "An error occurred while generating the briefing.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      if (analysis) {
        setDiff(computeAirQualityDiff(analysis, null));
      }
      toast.info("Chronological comparison history reset.");
    } catch (e) {
      console.warn(e);
    }
  };

  const selectedFact = analysis?.facts.find((f) => f.id === inspectFactId) || null;
  const briefIsStale =
    !!brief &&
    !!briefParams &&
    (briefParams.audience !== audience ||
      briefParams.language !== language ||
      briefParams.readingLevel !== readingLevel);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8 outline-none">
      {/* Screen Reader Live Status Announcer */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading
          ? "Synthesizing civic briefing and running factual grounding audit..."
          : brief
          ? "Civic briefing generated. Fact-ID audit result is shown above the brief."
          : ""}
      </div>

      {/* Studio Header Card */}
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              CPCB NAQI Standards
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              Deterministic Facts [F1..Fn]
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              Fact-ID Citation Audit
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Civic Air Quality Briefing Studio
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
            Ingest ambient air telemetry &rarr; extract verifiable mathematical facts &amp; sensor anomalies &rarr; synthesize targeted civic action briefings with server-enforced grounding audits.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleGenerateBrief}
            disabled={isLoading || !analysis || analysis.normalizedRows.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer shadow-sm active:scale-98"
            aria-label="Generate Civic Briefing"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Synthesizing &amp; Auditing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Civic Briefing</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-3 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-xs uppercase tracking-wider">System Notice</span>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (5 Cols): Data Workbench & Parameters */}
        <div className="lg:col-span-5 space-y-6">
          {/* Preset Profiles */}
          <SampleButtons
            onSelectSample={handleSelectSample}
            selectedSampleId={selectedSampleId}
          />

          {/* Ingestion Console */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <label
                htmlFor="table-data-input"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide"
              >
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span>Raw Telemetry Ingestion</span>
              </label>

              <div className="flex items-center gap-2">
                {rawText && (
                  <button
                    type="button"
                    onClick={handleClearData}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer transition px-2 py-0.5 rounded hover:bg-muted"
                    title="Clear raw data"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                )}
                <label className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer bg-muted hover:bg-muted/80 px-2.5 py-1 rounded-md border border-border transition shadow-xs">
                  <Upload className="h-3 w-3" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,.json"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            <textarea
              id="table-data-input"
              value={rawText}
              onChange={handleTextChange}
              placeholder="Paste raw telemetry records (CSV, TSV, JSON) or click a dataset profile above..."
              rows={8}
              className="w-full font-mono text-xs p-3.5 rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none resize-y leading-relaxed text-foreground placeholder:text-muted-foreground/60 transition"
              aria-label="Air Quality Table Input"
            />

            {analysis ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono bg-muted/50 p-3 rounded-lg border border-border flex-wrap gap-2">
                <span>Rows: <strong className="text-foreground">{analysis.summary.totalRows}</strong></span>
                <span>Flagged rows: <strong className={analysis.summary.flaggedRowsCount > 0 ? "text-amber-500" : "text-emerald-500"}>{analysis.summary.flaggedRowsCount}</strong></span>
                <span>
                  Avg AQI:{" "}
                  <strong className="text-foreground">
                    {analysis.summary.overallAverageAqi !== null ? analysis.summary.overallAverageAqi : "—"} (
                    {analysis.summary.overallCategory || "N/A"})
                  </strong>
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic px-1">
                No telemetry data loaded. Load a profile above or paste data to calculate facts.
              </p>
            )}
          </div>

          {/* Dissemination Parameters Matrix */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sliders className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Briefing Parameters
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              {/* Audience */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-2">
                  Target Authority / Audience
                </label>
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Target Audience">
                  {[
                    { id: "ward_officer", label: "Ward Officer" },
                    { id: "housing_society", label: "Housing Society" },
                    { id: "school", label: "School Campus" },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      role="radio"
                      aria-checked={audience === aud.id}
                      onClick={() => setAudience(aud.id as any)}
                      className={`py-2 px-2 rounded-lg text-xs font-medium text-center transition cursor-pointer border ${
                        audience === aud.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-background text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-2">
                  Dissemination Language
                </label>
                <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Language">
                  {[
                    { id: "en", label: "English" },
                    { id: "hi", label: "हिंदी" },
                    { id: "mr", label: "मराठी" },
                    { id: "ta", label: "தமிழ்" },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      role="radio"
                      aria-checked={language === lang.id}
                      onClick={() => setLanguage(lang.id as any)}
                      className={`py-2 px-1 rounded-lg text-xs font-medium text-center transition cursor-pointer border ${
                        language === lang.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-background text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reading Level */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-2">
                  Tone / Cognitive Complexity
                </label>
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Reading Level">
                  {[
                    { id: "executive", label: "Executive" },
                    { id: "standard", label: "Standard Civic" },
                    { id: "accessible", label: "Plain Public" },
                  ].map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      role="radio"
                      aria-checked={readingLevel === level.id}
                      onClick={() => setReadingLevel(level.id as any)}
                      className={`py-2 px-2 rounded-lg text-xs font-medium text-center transition cursor-pointer border ${
                        readingLevel === level.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-background text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Server Key Override */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-between w-full cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-amber-500" />
                    <span>Optional Server-Side Gemini API Key Override</span>
                  </span>
                  {showKeyInput ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showKeyInput && (
                  <div className="mt-2 space-y-2 bg-muted/40 p-3 rounded-lg border border-border">
                    <label htmlFor="custom-gemini-key-input" className="text-[11px] text-muted-foreground leading-relaxed block">
                      Supplied strictly through HTTP header to the server API endpoint:
                    </label>
                    <input
                      id="custom-gemini-key-input"
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="AIzaSy..."
                      aria-label="Custom Gemini API Key"
                      className="w-full text-xs font-mono p-2 rounded-md bg-background border border-border focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Computed Verifiable Facts Shelf */}
          {analysis && analysis.facts.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Computed Verifiable Facts ({analysis.facts.length})</span>
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  IDs: F1..F{analysis.facts.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
                {analysis.facts.map((fact) => (
                  <button
                    key={fact.id}
                    type="button"
                    onClick={() => setInspectFactId(fact.id)}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-medium px-2.5 py-1 rounded-md bg-muted/80 hover:bg-primary/10 hover:text-primary border border-border transition cursor-pointer text-foreground"
                    title={fact.statement}
                  >
                    <span className="font-bold text-primary">{fact.id}:</span>
                    <span className="font-sans font-normal truncate max-w-[140px]">
                      {fact.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (7 Cols): Output Center */}
        <div className="lg:col-span-7 space-y-6">
          {/* Real-time Telemetry KPI Overview (At-a-Glance) */}
          {analysis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Network Avg AQI</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono text-foreground">
                    {analysis.summary.overallAverageAqi ?? "—"}
                  </span>
                  {analysis.summary.overallCategory && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {analysis.summary.overallCategory}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Peak Hotspot</span>
                <div className="mt-1">
                  <span className="text-sm font-bold text-foreground block truncate">
                    {analysis.summary.peakStation ?? "—"}
                  </span>
                  <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                    AQI {analysis.summary.peakAqi ?? "—"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Cleanest Zone</span>
                <div className="mt-1">
                  <span className="text-sm font-bold text-foreground block truncate">
                    {analysis.summary.cleanestStation ?? "—"}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                    AQI {analysis.summary.cleanestAqi ?? "—"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Sensor Quality</span>
                <div className="mt-1">
                  <span className={`text-sm font-bold block ${analysis.summary.flaggedRowsCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {analysis.summary.flaggedRowsCount === 0 ? "100% Clean" : `${analysis.summary.flaggedRowsCount} Flagged Rows`}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {analysis.flags.length} sensor flags
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-border pb-1">
            <div className="flex gap-2 text-xs" role="tablist" aria-label="Studio View Tabs" onKeyDown={handleTabKeyDown}>
              <button
                type="button"
                id="tab-brief"
                role="tab"
                aria-selected={activeTab === "brief"}
                aria-controls="panel-brief"
                tabIndex={activeTab === "brief" ? 0 : -1}
                onClick={() => setActiveTab("brief")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg font-semibold transition cursor-pointer text-xs ${
                  activeTab === "brief"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Civic Briefing</span>
              </button>
              <button
                type="button"
                id="tab-table"
                role="tab"
                aria-selected={activeTab === "table"}
                aria-controls="panel-table"
                tabIndex={activeTab === "table" ? 0 : -1}
                onClick={() => setActiveTab("table")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg font-semibold transition cursor-pointer text-xs ${
                  activeTab === "table"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Table className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Audited Telemetry Table ({analysis?.normalizedRows.length || 0})</span>
              </button>
              <button
                type="button"
                id="tab-flags"
                role="tab"
                aria-selected={activeTab === "flags"}
                aria-controls="panel-flags"
                tabIndex={activeTab === "flags" ? 0 : -1}
                onClick={() => setActiveTab("flags")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg font-semibold transition cursor-pointer text-xs ${
                  activeTab === "flags"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlertOctagon className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <span>Sensor Flags</span>
                {analysis && analysis.flags.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold">
                    {analysis.flags.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Chronological Delta Panel */}
          <DiffPanel
            diff={diff}
            narrative={brief?.diffNarrative}
            onClearHistory={handleClearHistory}
          />

          {/* Sensor Flags Alert Panel */}
          {analysis && analysis.flags.length > 0 && (
            <FlagsPanel
              flags={analysis.flags}
              onSelectRow={(rowIndex) => {
                setHighlightedRowIndices([rowIndex]);
                setActiveTab("table");
              }}
            />
          )}

          {/* Tab Content Stream */}
          {activeTab === "brief" && (
            <div role="tabpanel" id="panel-brief" aria-labelledby="tab-brief" tabIndex={0} className="outline-none space-y-6">
              {brief && analysis && briefIsStale && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3 flex-wrap"
                >
                  <span>
                    Audience, language or reading level changed since this brief was generated. Regenerate to update the actions and advisory.
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateBrief}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                    <span>Regenerate</span>
                  </button>
                </div>
              )}
              {brief && analysis ? (
                <BriefView
                  lang={briefParams?.language ?? "en"}
                  brief={brief}
                  facts={analysis.facts}
                  onSelectFact={(fId) => setInspectFactId(fId)}
                  auditInfo={auditInfo}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">
                      No Civic Briefing Generated Yet
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed text-pretty">
                      Select a dataset profile on the left or paste ambient telemetry rows, then click &ldquo;Generate Civic Briefing&rdquo;.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBrief}
                    disabled={isLoading || !analysis || analysis.normalizedRows.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Run Studio Pipeline</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "table" && analysis && (
            <div role="tabpanel" id="panel-table" aria-labelledby="tab-table" tabIndex={0} className="outline-none">
              <TableViewer
                rows={analysis.normalizedRows}
                highlightedRowIndices={highlightedRowIndices}
                onSelectRow={(idx) => setHighlightedRowIndices([idx])}
              />
            </div>
          )}

          {activeTab === "flags" && analysis && (
            <div role="tabpanel" id="panel-flags" aria-labelledby="tab-flags" tabIndex={0} className="outline-none">
              <FlagsPanel
                flags={analysis.flags}
                onSelectRow={(rowIndex) => {
                  setHighlightedRowIndices([rowIndex]);
                  setActiveTab("table");
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fact Grounding Inspector Modal */}
      {selectedFact && analysis && (
        <FactModal
          fact={selectedFact}
          onClose={() => setInspectFactId(null)}
          allRows={analysis.normalizedRows}
          onHighlightRows={(indices) => {
            setHighlightedRowIndices(indices);
            setActiveTab("table");
          }}
        />
      )}
    </main>
  );
}
