"use client";

import { Sparkles, ChevronLeft, Search, Globe } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { REVIEW_MODES } from "@/lib/reviewConstants";
import type { ReviewConfig, VenueSearchResult } from "@/lib/types";
import { getVenueAreas, getVenueTypes, searchVenues, readFile } from "@/lib/api";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

type VenueStep = "area" | "type" | "search" | "done";

const QUARTILE_COLORS: Record<string, string> = {
  Q1: "oklch(60% 0.18 145)",
  Q2: "oklch(60% 0.16 200)",
  Q3: "oklch(60% 0.14 55)",
  Q4: "oklch(55% 0.10 30)",
};

export default function ReviewSetup() {
  const { startReviewRun, setReviewConfig, reviewConfig, currentProjectName, latexContent, currentProjectId, activeFilePath } = useEditorStore();

  // If latexContent isn't loaded yet (editor hasn't mounted), fetch it directly
  const [docContent, setDocContent] = useState(latexContent);
  const [docError, setDocError] = useState(false);
  useEffect(() => {
    if (latexContent) {
      setDocContent(latexContent);
      setDocError(false);
    } else if (currentProjectId) {
      readFile(currentProjectId, activeFilePath)
        .then(content => { setDocContent(content); setDocError(false); })
        .catch(() => setDocError(true));
    }
  }, [latexContent, currentProjectId, activeFilePath]);

  // Extract paper title from \title{} in LaTeX, fallback to project name
  const paperTitle = useMemo(() => {
    const content = docContent || latexContent;
    if (content) {
      const match = content.match(/\\title\s*\{([^}]+)\}/);
      if (match) return match[1].replace(/\s+/g, " ").trim();
    }
    return currentProjectName || "";
  }, [docContent, latexContent, currentProjectName]);

  const [cfg, setCfg] = useState<ReviewConfig>(reviewConfig ?? {
    venue: "",
    topic: paperTitle,
    mode: "depth",
  });

  // Sync topic when paperTitle changes — unless user manually edited the field
  const userEditedTopic = useRef(false);
  useEffect(() => {
    if (!userEditedTopic.current && paperTitle) {
      setCfg(prev => ({ ...prev, topic: paperTitle }));
    }
  }, [paperTitle]);

  // Bug 2: Restore venue step from store — if config already has a venue, show "done"
  const [venueStep, setVenueStep] = useState<VenueStep>(
    reviewConfig?.venue ? "done" : "area"
  );
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [types, setTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VenueSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [customVenue, setCustomVenue] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bug 2: Persist config to store whenever it changes (without starting pipeline)
  useEffect(() => {
    if (cfg.venue || cfg.topic) {
      setReviewConfig(cfg);
    }
  }, [cfg, setReviewConfig]);

  const modeInfo = REVIEW_MODES.find(m => m.id === cfg.mode);
  const venueName = cfg.venue || "your venue";

  // Fetch areas on mount
  useEffect(() => {
    getVenueAreas().then(setAreas).catch(() => {});
  }, []);

  // Fetch types when area is selected
  useEffect(() => {
    if (!selectedArea) return;
    getVenueTypes(selectedArea).then(setTypes).catch(() => {});
  }, [selectedArea]);

  // Debounced venue search
  const doSearch = useCallback((area: string, type: string, q: string) => {
    setSearchLoading(true);
    searchVenues(area, type || undefined, q, 30)
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, []);

  // Load initial results when entering search step
  useEffect(() => {
    if (venueStep === "search" && selectedArea) {
      doSearch(selectedArea, selectedType, "");
    }
  }, [venueStep, selectedArea, selectedType, doSearch]);

  // Debounce search query
  useEffect(() => {
    if (venueStep !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(selectedArea, selectedType, searchQuery);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, venueStep, selectedArea, selectedType, doSearch]);

  const handleAreaSelect = (area: string) => {
    setSelectedArea(area);
    setSelectedType("");
    setSearchQuery("");
    setSearchResults([]);
    setShowCustom(false);
    setVenueStep("type");
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setSearchQuery("");
    setSearchResults([]);
    setShowCustom(false);
    setVenueStep("search");
  };

  const handleVenueSelect = (venue: VenueSearchResult) => {
    setCfg({ ...cfg, venue: venue.title });
    setVenueStep("done");
  };

  const handleCustomSubmit = () => {
    if (customVenue.trim()) {
      setCfg({ ...cfg, venue: customVenue.trim() });
      setVenueStep("done");
    }
  };

  const handleBack = () => {
    if (showCustom) {
      setShowCustom(false);
      return;
    }
    if (venueStep === "type") { setVenueStep("area"); setSelectedArea(""); }
    else if (venueStep === "search") { setVenueStep("type"); setSelectedType(""); }
    else if (venueStep === "done") { setVenueStep("search"); setCfg({ ...cfg, venue: "" }); }
  };

  const typeLabel = (t: string) => {
    if (t === "conference and proceedings") return "Conference & Proceedings";
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "min(100%, 760px)" }}>
        {/* Eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
          <span>start a new review</span>
          <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
        </div>

        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 40, letterSpacing: "-0.02em", lineHeight: 1.05, margin: "0 0 8px" }}>
          What are we <em style={{ color: "var(--accent-3)" }}>reviewing</em>?
        </h2>
        <p style={{ color: "var(--ink-3)", fontSize: 14, maxWidth: 560, marginBottom: 28 }}>
          Pick a target venue. We'll fetch 20 recent papers from it, run four specialist agents — Novelty, Soundness, Rigor, Clarity — and a meta-reviewer in parallel against your draft.
        </p>

        {/* ── Venue selection ─────────────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {venueStep !== "area" && (
              <button
                onClick={handleBack}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center", padding: 0 }}
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <label style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
              {venueStep === "area" && "Select subject area"}
              {venueStep === "type" && `${selectedArea} — select type`}
              {venueStep === "search" && `${selectedArea} · ${typeLabel(selectedType)} — search venue`}
              {venueStep === "done" && "Target venue"}
            </label>
          </div>

          {/* Step 1: Area grid */}
          {venueStep === "area" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {areas.map(area => (
                <button
                  key={area}
                  onClick={() => handleAreaSelect(area)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                    background: "transparent",
                    border: "1px solid var(--rule)",
                    transition: "all .14s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 3%, transparent)"; e.currentTarget.style.borderColor = "var(--ink-4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--rule)"; }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{area}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Type selection */}
          {venueStep === "type" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => handleTypeSelect(t)}
                  style={{
                    textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                    background: "transparent",
                    border: "1px solid var(--rule)",
                    transition: "all .14s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 3%, transparent)"; e.currentTarget.style.borderColor = "var(--ink-4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--rule)"; }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{typeLabel(t)}</span>
                </button>
              ))}
              {/* Custom / None option */}
              <button
                onClick={() => { setShowCustom(true); setVenueStep("search"); setSelectedType(""); }}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                  background: "transparent",
                  border: "1px dashed var(--rule)",
                  transition: "all .14s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 3%, transparent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>Custom venue</span>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>Type any venue name</div>
              </button>
            </div>
          )}

          {/* Step 3: Venue search or custom input */}
          {venueStep === "search" && !showCustom && (
            <div>
              {/* Search input */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }} />
                <input
                  type="text"
                  className="textarea"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search venues…"
                  autoFocus
                  style={{ fontSize: 14, padding: "8px 12px 8px 30px", width: "100%" }}
                />
              </div>

              {/* Results list */}
              <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--rule)", borderRadius: 8 }}>
                {searchLoading && (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>Searching…</div>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>No venues found</div>
                )}
                {!searchLoading && searchResults.map((v, i) => (
                  <button
                    key={v.sourceid}
                    onClick={() => handleVenueSelect(v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      padding: "9px 12px", cursor: "pointer", background: "transparent",
                      border: "none", borderBottom: i < searchResults.length - 1 ? "1px solid var(--rule)" : "none",
                      transition: "background .1s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 3%, transparent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-4)", display: "flex", gap: 8, marginTop: 2 }}>
                        {v.publisher && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{v.publisher}</span>}
                        {v.country && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Globe size={9} />{v.country}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {v.sjr_quartile && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
                          padding: "2px 5px", borderRadius: 4,
                          background: `color-mix(in oklab, ${QUARTILE_COLORS[v.sjr_quartile] || "var(--ink-4)"} 15%, transparent)`,
                          color: QUARTILE_COLORS[v.sjr_quartile] || "var(--ink-4)",
                        }}>
                          {v.sjr_quartile}
                        </span>
                      )}
                      {v.sjr != null && (
                        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
                          {v.sjr.toFixed(1)}
                        </span>
                      )}
                      {v.h_index != null && (
                        <span style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                          h{v.h_index}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Can't find link */}
              <button
                onClick={() => setShowCustom(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-3)", fontSize: 12, marginTop: 8, padding: 0, textDecoration: "underline" }}
              >
                Can't find your venue? Type it manually
              </button>
            </div>
          )}

          {/* Custom venue input */}
          {venueStep === "search" && showCustom && (
            <div>
              <input
                type="text"
                className="textarea"
                value={customVenue}
                onChange={e => setCustomVenue(e.target.value)}
                placeholder="e.g. CVPR 2026, Nature Machine Intelligence, JMLR…"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleCustomSubmit(); }}
                style={{ fontSize: 14, padding: "8px 12px", width: "100%", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleCustomSubmit}
                  className="btn accent sm"
                  style={{ fontSize: 12, padding: "6px 14px" }}
                >
                  Use this venue
                </button>
                <button
                  onClick={() => setShowCustom(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 12 }}
                >
                  Back to search
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done — show selected venue */}
          {venueStep === "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="card" style={{
                flex: 1, padding: "10px 14px", background: "var(--bg-2)",
                border: "1px solid var(--accent-3)",
                boxShadow: "0 0 0 3px color-mix(in oklab, var(--accent-3) 12%, transparent)",
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{cfg.venue}</span>
                <span style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: 8 }}>{selectedArea}{selectedType ? ` · ${typeLabel(selectedType)}` : ""}</span>
              </div>
              <button
                onClick={handleBack}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-3)", fontSize: 12, textDecoration: "underline", flexShrink: 0 }}
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* ── Topic ──────────────────────────────────────────────── */}
        {docError && (
          <div style={{
            padding: "8px 12px", marginBottom: 12, borderRadius: 6,
            background: "color-mix(in oklab, oklch(65% 0.2 30) 10%, var(--bg-2))",
            border: "1px solid color-mix(in oklab, oklch(65% 0.2 30) 30%, transparent)",
            fontSize: 12, color: "oklch(65% 0.2 30)", lineHeight: 1.4,
          }}>
            Could not load document content — paper title could not be extracted automatically. Please enter the topic manually.
          </div>
        )}
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            Paper topic / claimed contribution
          </label>
          <p style={{ fontSize: 12, color: "var(--ink-4)", margin: "4px 0 8px" }}>
            Used to pick the 20 most relevant papers from {venueName}. Be specific — one sentence.
          </p>
          <textarea
            className="textarea"
            rows={2}
            value={cfg.topic}
            onChange={e => { userEditedTopic.current = true; setCfg({ ...cfg, topic: e.target.value }); }}
            placeholder="e.g. Federated learning with adaptive client weighting under non-IID data"
            style={{ fontSize: 14 }}
          />
        </div>

        {/* ── Review mode ────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            Review mode
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
            {REVIEW_MODES.map(m => {
              const active = cfg.mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setCfg({ ...cfg, mode: m.id as "speed" | "depth" })}
                  style={{
                    textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                    background: active ? "color-mix(in oklab, var(--accent-3) 8%, var(--bg-2))" : "transparent",
                    border: `1px solid ${active ? "var(--accent-3)" : "var(--rule)"}`,
                    boxShadow: active ? "0 0 0 3px color-mix(in oklab, var(--accent-3) 10%, transparent)" : "none",
                    transition: "all .14s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7 }}>
                      <span>{m.icon}</span>{m.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{m.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>{m.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Summary card ──────��────────────────────────────────── */}
        <div className="card" style={{ padding: 14, background: "var(--bg-2)", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, borderColor: "var(--rule)" }}>
          <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
            Will run <b style={{ color: "var(--ink)" }}>4 specialist agents + meta-reviewer</b> against{" "}
            <b style={{ color: "var(--ink)" }}>20 recent {venueName}</b> papers on{" "}
            <i style={{ color: "var(--ink-3)" }}>
              "{cfg.topic ? (cfg.topic.slice(0, 50) + (cfg.topic.length > 50 ? "…" : "")) : "your paper topic"}"
            </i>. Estimated <b>{modeInfo?.time}</b>.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="btn accent sm"
            disabled={!cfg.venue || !cfg.topic.trim()}
            onClick={() => startReviewRun(cfg)}
            style={{
              background: "var(--accent-3)", borderColor: "var(--accent-3)", padding: "8px 18px", gap: 6,
              opacity: (!cfg.venue || !cfg.topic.trim()) ? 0.4 : 1,
              cursor: (!cfg.venue || !cfg.topic.trim()) ? "not-allowed" : "pointer",
            }}
          >
            <Sparkles size={13} /> Start review
          </button>
        </div>
      </div>
    </div>
  );
}
