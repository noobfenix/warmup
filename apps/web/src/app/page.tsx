"use client";

import React, { useState } from "react";
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
import { parseRawTableInput, normalizeTableData, heuristicMapColumns } from "@/lib/table-parser";
import { analyzeAirQualityData, type AnalysisOutput } from "@/lib/flags-and-facts";
import { computeAirQualityDiff, type AirQualityDiff } from "@/lib/diff-engine";
import type { CivicBriefResponse } from "@/lib/brief-validator";
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
  const [auditInfo, setAuditInfo] = useState<any>(null);
  const [diff, setDiff] = useState<AirQualityDiff | null>(null);

  // Inspector & UI state
  const [inspectFactId, setInspectFactId] = useState<string | null>(null);
  const [highlightedRowIndices, setHighlightedRowIndices] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"brief" | "table" | "flags">("brief");

  // Deterministic local processing in pure TypeScript
  const processInputData = (text: string) => {
    try {
      setError(null);
      if (!text.trim()) {
        setAnalysis(null);
        return;
      }

      const parsed = parseRawTableInput(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("Could not parse valid tabular headers or rows. Please ensure CSV, TSV, or JSON format.");
        setAnalysis(null);
        return;
      }

      const mapping = heuristicMapColumns(parsed.headers);
      const normalized = normalizeTableData(parsed, mapping);
      const analyzed = analyzeAirQualityData(normalized);

      setAnalysis(analyzed);
    } catch (err) {
      console.error("Data processing error:", err);
      setError("Failed to parse tabular data. Please ensure valid delimiter (comma, tab, semicolon) or JSON.");
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRawText(newText);
    setSelectedSampleId("");
    processInputData(newText);
  };

  const handleSelectSample = (sample: SampleDataset) => {
    setSelectedSampleId(sample.id);
    setRawText(sample.data);
    setAudience(sample.defaultAudience);
    processInputData(sample.data);
    toast.success(`Loaded dataset: ${sample.name.replace(/^\[Sample\]\s*/i, "")}`);
  };

  const handleClearData = () => {
    setRawText("");
    setSelectedSampleId("");
    setAnalysis(null);
    setBrief(null);
    setHighlightedRowIndices([]);
    toast.info("Workbench data cleared.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // Generate Briefing flow
  const handleGenerateBrief = async () => {
    if (!analysis || analysis.normalizedRows.length === 0) {
      setError("Please paste or load tabular air quality data first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check localStorage for previous brief
      let previousRecord: StoredBriefRecord | null = null;
      try {
        const storedJson = localStorage.getItem(STORAGE_KEY);
        if (storedJson) {
          previousRecord = JSON.parse(storedJson);
        }
      } catch (e) {
        console.warn("Could not read previous brief from storage:", e);
      }

      // Compute code-based deterministic diff
      const calculatedDiff = computeAirQualityDiff(
        analysis,
        previousRecord?.analysis || null,
        previousRecord?.timestamp
      );
      setDiff(calculatedDiff);

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
      setBrief(generatedBrief);
      setAuditInfo(responseData.audit);
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
    } catch (err: any) {
      console.error("Brief generation error:", err);
      const msg = err.message || "An error occurred while generating the briefing.";
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

  return (
    <main className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8">
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
              Zero Hallucination Audit
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
                <span>Flags: <strong className={analysis.summary.flaggedRowsCount > 0 ? "text-amber-500" : "text-emerald-500"}>{analysis.summary.flaggedRowsCount}</strong></span>
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
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Supplied strictly through HTTP header to the server API endpoint:
                    </p>
                    <input
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="AIzaSy..."
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
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-border pb-1">
            <div className="flex gap-2 text-xs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "brief"}
                onClick={() => setActiveTab("brief")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg font-semibold transition cursor-pointer text-xs ${
                  activeTab === "brief"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4 text-primary" />
                <span>Civic Briefing</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "table"}
                onClick={() => setActiveTab("table")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg font-semibold transition cursor-pointer text-xs ${
                  activeTab === "table"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Table className="h-4 w-4 text-primary" />
                <span>Audited Telemetry Table ({analysis?.normalizedRows.length || 0})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "flags"}
                onClick={() => setActiveTab("flags")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg font-semibold transition cursor-pointer text-xs ${
                  activeTab === "flags"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlertOctagon className="h-4 w-4 text-amber-500" />
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
            <>
              {brief && analysis ? (
                <BriefView
                  brief={brief}
                  facts={analysis.facts}
                  onSelectFact={(fId) => setInspectFactId(fId)}
                  auditInfo={auditInfo}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
                    <FileText className="h-6 w-6" />
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
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Run Studio Pipeline</span>
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === "table" && analysis && (
            <TableViewer
              rows={analysis.normalizedRows}
              highlightedRowIndices={highlightedRowIndices}
              onSelectRow={(idx) => setHighlightedRowIndices([idx])}
            />
          )}

          {activeTab === "flags" && analysis && (
            <FlagsPanel
              flags={analysis.flags}
              onSelectRow={(rowIndex) => {
                setHighlightedRowIndices([rowIndex]);
                setActiveTab("table");
              }}
            />
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
