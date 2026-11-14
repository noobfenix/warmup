"use client";

import React, { useState, useEffect } from "react";
import {
  Wind,
  Sparkles,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Sliders,
  Send,
  Trash2,
  HelpCircle,
  FileText,
  BarChart3,
  Layers,
  ShieldCheck,
  Key,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { parseRawTableInput, normalizeTableData, heuristicMapColumns, type NormalizedRow } from "@/lib/table-parser";
import { analyzeAirQualityData, type AnalysisOutput, type ComputedFact } from "@/lib/flags-and-facts";
import { computeAirQualityDiff, type AirQualityDiff } from "@/lib/diff-engine";
import type { CivicBriefResponse } from "@/lib/brief-validator";
import { SAMPLE_DATASETS, type SampleDataset } from "@/config/sample-datasets";
import { SampleButtons } from "@/components/studio/sample-buttons";
import { FlagsPanel } from "@/components/studio/flags-panel";
import { DiffPanel } from "@/components/studio/diff-panel";
import { TableViewer } from "@/components/studio/table-viewer";
import { BriefView } from "@/components/studio/brief-view";
import { FactModal } from "@/components/studio/fact-modal";
import { toast } from "sonner";

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

  // Optional custom API key (stays strictly in server-side POST request header)
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

  // Process data locally in deterministic pure TypeScript
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
    toast.success(`Loaded sample dataset: ${sample.name}`);
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

      // Save to localStorage for next diff
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

      toast.success("Civic briefing successfully generated and audited!");
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
    <main className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Studio Header Card */}
      <section className="rounded-xl border border-border bg-card/90 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Civic Air Quality Briefing Studio
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              CPCB NAQI Standards
            </span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Gemini Server-Grounded
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Ingest air quality tables &rarr; compute deterministic facts with traceable source row IDs (<code className="text-emerald-400 font-mono">F1..Fn</code>) &amp; sensor anomaly flags &rarr; generate audience-targeted briefings with automated Fact ID auditing and zero medical advice.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleGenerateBrief}
            disabled={isLoading || !analysis || analysis.normalizedRows.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer shadow-sm active:scale-98"
            aria-label="Generate Civic Briefing"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Auditing &amp; Synthesizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Generate Civic Briefing</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Error Notice */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-3 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">System Notice</span>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 Cols): Data Workbench & Configuration */}
        <div className="lg:col-span-5 space-y-5">
          {/* Sample Buttons (Labeled as Sample) */}
          <SampleButtons
            onSelectSample={handleSelectSample}
            selectedSampleId={selectedSampleId}
          />

          {/* Tabular Input Workbench */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label
                htmlFor="table-data-input"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> Table Ingestion (Paste or Upload)
              </label>

              <div className="flex items-center gap-2">
                {rawText && (
                  <button
                    type="button"
                    onClick={handleClearData}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer transition"
                    title="Clear raw data"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                )}
                <label className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer bg-muted px-2.5 py-1 rounded border border-border transition">
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
              placeholder="Paste raw table data here (e.g. Station, Timestamp, PM2.5, PM10, AQI)... or click a [Sample] button above."
              rows={8}
              className="w-full font-mono text-xs p-3 rounded-lg border border-border bg-background/80 focus:ring-1 focus:ring-primary focus:outline-none resize-y leading-relaxed text-foreground"
              aria-label="Air Quality Table Input"
            />

            {analysis ? (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono bg-muted/40 p-2.5 rounded-lg border border-border/60">
                <span>Total Observations: {analysis.summary.totalRows}</span>
                <span>Flags: {analysis.summary.flaggedRowsCount}</span>
                <span>
                  Avg AQI:{" "}
                  <strong className="text-foreground">
                    {analysis.summary.overallAverageAqi !== null ? analysis.summary.overallAverageAqi : "—"} (
                    {analysis.summary.overallCategory || "N/A"})
                  </strong>
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">
                No data loaded. Paste table data or click a [Sample] button above to begin.
              </p>
            )}
          </div>

          {/* Audience, Language & Reading Level Configuration */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <Sliders className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Audience &amp; Dissemination Parameters
              </h3>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Audience */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">
                  Target Audience
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
                      className={`p-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                        audience === aud.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">
                  Language Selection (English, Hindi + Marathi/Tamil)
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
                      className={`p-1.5 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                        language === lang.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
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
                <label className="font-semibold text-foreground block mb-1.5">
                  Reading Level
                </label>
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Reading Level">
                  {[
                    { id: "executive", label: "Executive" },
                    { id: "standard", label: "Standard" },
                    { id: "accessible", label: "Accessible" },
                  ].map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      role="radio"
                      aria-checked={readingLevel === level.id}
                      onClick={() => setReadingLevel(level.id as any)}
                      className={`p-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                        readingLevel === level.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Server Key Override */}
              <div className="pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center justify-between w-full cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Key className="h-3 w-3 text-amber-400" />
                    <span>Optional: Server-Side Gemini API Key Override</span>
                  </span>
                  {showKeyInput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showKeyInput && (
                  <div className="mt-2 space-y-1.5 bg-muted/40 p-2.5 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground">
                      If not set in server environment variables, pass a key here (transmitted only to server API endpoint via headers):
                    </p>
                    <input
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full text-xs font-mono p-2 rounded bg-background border border-border focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Computed Verifiable Facts Strip */}
          {analysis && analysis.facts.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Computed Verifiable Facts ({analysis.facts.length})</span>
                </h4>
                <span className="text-[11px] text-muted-foreground font-mono">
                  IDs: F1..F{analysis.facts.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                {analysis.facts.map((fact) => (
                  <button
                    key={fact.id}
                    type="button"
                    onClick={() => setInspectFactId(fact.id)}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-1 rounded bg-muted/80 hover:bg-primary/15 hover:text-primary border border-border transition cursor-pointer"
                    title={fact.statement}
                  >
                    <span>{fact.id}:</span>
                    <span className="font-sans font-normal truncate max-w-[130px]">
                      {fact.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (7 Cols): Output Center */}
        <div className="lg:col-span-7 space-y-5">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-border pb-1">
            <div className="flex gap-2 text-xs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "brief"}
                onClick={() => setActiveTab("brief")}
                className={`px-3.5 py-1.5 rounded-t-lg font-semibold transition cursor-pointer ${
                  activeTab === "brief"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Civic Briefing
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "table"}
                onClick={() => setActiveTab("table")}
                className={`px-3.5 py-1.5 rounded-t-lg font-semibold transition cursor-pointer ${
                  activeTab === "table"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Audited Telemetry Table ({analysis?.normalizedRows.length || 0})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "flags"}
                onClick={() => setActiveTab("flags")}
                className={`px-3.5 py-1.5 rounded-t-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "flags"
                    ? "bg-card border-t border-x border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Sensor Flags</span>
                {analysis && analysis.flags.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                    {analysis.flags.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Chronological Diff Panel */}
          <DiffPanel
            diff={diff}
            narrative={brief?.diffNarrative}
            onClearHistory={handleClearHistory}
          />

          {/* Prominent Flags Panel (Never hidden) */}
          {analysis && analysis.flags.length > 0 && (
            <FlagsPanel
              flags={analysis.flags}
              onSelectRow={(rowIndex) => {
                setHighlightedRowIndices([rowIndex]);
                setActiveTab("table");
              }}
            />
          )}

          {/* Tab Content */}
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
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    No Civic Brief Generated Yet
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Select a sample dataset or paste custom air quality data on the left, then click "Generate Civic Briefing".
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateBrief}
                    disabled={isLoading || !analysis || analysis.normalizedRows.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
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

      {/* Fact Inspection Modal */}
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
