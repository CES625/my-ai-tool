import { useState, useRef, useCallback, useEffect } from "react";
import * as mammoth from "mammoth";

/* ═══════════════════════════════════════════
   SYSTEM PROMPT — Instructional Design Engine
   ═══════════════════════════════════════════ */
const SYSTEM_PROMPT = `You are a senior instructional designer, corporate trainer, and document design expert with deep experience in adult learning, knowledge transfer, and professional content formatting.

CORE OBJECTIVE: Transform source material into a high-quality, structured training document that is clear, concise, professionally formatted, and optimized for real-world business use (contact centers, onboarding, SOPs, training programs).

STYLE GUIDE:
- Use clear section hierarchy with Markdown: # for Title, ## for Section Headers, ### for Subsections
- Use bullet points for readability, numbered steps for sequential processes
- Use **bold** for emphasis sparingly — only for key terms or critical actions
- Keep paragraphs short (2-4 lines max)
- Professional, clear, natural tone — instructional but not robotic
- Avoid fluff, filler, or overly academic language
- Write like an experienced operator, not a consultant

PROCESSING RULES:
1. Analyze source content — identify key ideas, processes, and workflows; remove redundancy and noise
2. Extract & prioritize — separate critical vs supporting information; highlight actions and decisions
3. Rebuild for training use — rewrite for clarity and usability; break complex ideas into structured sections; ensure logical progression
4. Enhance learning — add examples, tips, warnings, or best practices where they add value
5. Match the requested style adaptation (Standard, Playbook, Executive Brief, SOP, Quick Reference, etc.)

OUTPUT: A fully formatted training document in Markdown. Include a clear title, structured sections with hierarchy, clean formatting, logical flow from introduction to content to reinforcement, and consistent tone throughout.

Do NOT reference the original document, mention AI or any transformation process, or include unnecessary meta-explanations. Produce the document directly.`;

const buildUserPrompt = (cfg) => {
  const { sourceContent, audience, objective, pageCount, depth, style, tone, customTitle, toggles } = cfg;
  let p = "Transform the following source content into a professional training document.\n\n";
  p += "TARGET AUDIENCE: " + audience + "\n";
  p += "TRAINING OBJECTIVE: " + objective + "\n";
  p += "DESIRED LENGTH: Approximately " + pageCount + " page(s)\n";
  p += "CONTENT DEPTH: " + depth + "\n";
  p += "CREATIVE STYLE: " + style + "\n";
  p += "TONE: " + tone + "\n";
  if (customTitle) p += "DOCUMENT TITLE: " + customTitle + "\n";
  const on = Object.entries(toggles).filter(function(e){ return e[1]; }).map(function(e){ return e[0].replace(/([A-Z])/g, " $1").trim(); });
  if (on.length) p += "INCLUDE THESE SECTIONS: " + on.join(", ") + "\n";
  p += "\n--- SOURCE CONTENT ---\n" + sourceContent + "\n--- END SOURCE CONTENT ---";
  return p;
};

/* ═══════════════════════════════════════════
   DATA CONSTANTS
   ═══════════════════════════════════════════ */
const AUDIENCES = [
  "New Hires / Onboarding", "Frontline Agents", "Team Leads / Supervisors",
  "QA Analysts", "Operations Managers", "Executive Leadership",
  "BPO / Vendor Partners", "Cross-Functional Teams", "General Workforce",
];
const DEPTHS = ["High-Level Overview", "Balanced", "Deep-Dive"];
const STYLES = [
  "Standard Document", "Playbook", "Quick Reference", "Executive Brief", "SOP Format",
];
const TONES = [
  "Professional & Direct", "Conversational & Approachable",
  "Authoritative & Formal", "Coaching & Supportive", "Technical & Precise",
];
const SECTION_TOGGLES = [
  { key: "keyTakeaways", label: "Key Takeaways", icon: "\u25C6" },
  { key: "stepByStep", label: "Step-by-Step Instructions", icon: "\u2460" },
  { key: "examples", label: "Examples / Scenarios", icon: "\u25A7" },
  { key: "tips", label: "Tips / Callouts", icon: "\u2726" },
  { key: "commonMistakes", label: "Common Mistakes", icon: "\u26A0" },
  { key: "knowledgeCheck", label: "Knowledge Check", icon: "?" },
  { key: "coachingNotes", label: "Coaching Notes", icon: "\u25CE" },
];

/* ═══════════════════════════════════════════
   MARKDOWN RENDERER
   ═══════════════════════════════════════════ */
function renderMarkdown(md) {
  if (!md) return "";
  var lines = md.split("\n");
  var html = "";
  var inUl = false;
  var inOl = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (inUl && !/^[-\u2022*]\s/.test(line)) { html += "</ul>"; inUl = false; }
    if (inOl && !/^\d+\.\s/.test(line)) { html += "</ol>"; inOl = false; }

    if (/^### (.+)/.test(line)) {
      html += '<h3 class="ec-md-h3">' + line.replace(/^### /, "") + "</h3>";
    } else if (/^## (.+)/.test(line)) {
      html += '<h2 class="ec-md-h2">' + line.replace(/^## /, "") + "</h2>";
    } else if (/^# (.+)/.test(line)) {
      html += '<h1 class="ec-md-h1">' + line.replace(/^# /, "") + "</h1>";
    } else if (/^---\s*$/.test(line)) {
      html += '<hr class="ec-md-hr"/>';
    } else if (/^[-\u2022*]\s(.+)/.test(line)) {
      if (!inUl) { html += '<ul class="ec-md-ul">'; inUl = true; }
      html += "<li>" + line.replace(/^[-\u2022*]\s/, "") + "</li>";
    } else if (/^\d+\.\s(.+)/.test(line)) {
      if (!inOl) { html += '<ol class="ec-md-ol">'; inOl = true; }
      html += "<li>" + line.replace(/^\d+\.\s/, "") + "</li>";
    } else if (line.trim()) {
      html += '<p class="ec-md-p">' + line + "</p>";
    }
  }

  if (inUl) html += "</ul>";
  if (inOl) html += "</ol>";

  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`]+?)`/g, '<code class="ec-md-code">$1</code>');

  return html;
}

/* ═══════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════ */
var Ico = {
  doc: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  bolt: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  copy: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  check: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  reset: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-12.23L1 10"/>
    </svg>
  ),
  upload: (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  fileOk: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/>
    </svg>
  ),
  close: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function TrainingDocGenerator() {
  const [source, setSource] = useState("");
  const [audience, setAudience] = useState(AUDIENCES[1]);
  const [objective, setObjective] = useState("");
  const [pageCount, setPageCount] = useState(2);
  const [depth, setDepth] = useState("Balanced");
  const [style, setStyle] = useState("Standard Document");
  const [tone, setTone] = useState("Professional & Direct");
  const [customTitle, setCustomTitle] = useState("");
  const [toggles, setToggles] = useState({
    keyTakeaways: true, stepByStep: true, examples: true, tips: true,
    commonMistakes: false, knowledgeCheck: false, coachingNotes: false,
  });
  const [output, setOutput] = useState("");
  const [rawMd, setRawMd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileProcessing, setFileProcessing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(function() {
    var wc = source.trim() ? source.trim().split(/\s+/).length : 0;
    setWordCount(wc);
  }, [source]);

  /* ── File Processing ── */
  var ACCEPTED_TYPES = {
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "text/tab-separated-values": "tsv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/pdf": "pdf",
  };
  var ACCEPTED_EXT = [".txt", ".md", ".csv", ".tsv", ".docx", ".pdf", ".rtf"];

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function getFileExt(name) {
    var dot = name.lastIndexOf(".");
    return dot !== -1 ? name.substring(dot).toLowerCase() : "";
  }

  var processFile = useCallback(async function(file) {
    var ext = getFileExt(file.name);
    if (ACCEPTED_EXT.indexOf(ext) === -1) {
      setError("Unsupported file type. Accepted: .txt, .md, .csv, .tsv, .docx, .pdf, .rtf");
      return;
    }
    setError("");
    setFileProcessing(true);
    setUploadedFile({ name: file.name, size: file.size, type: ext.replace(".", "").toUpperCase() });

    try {
      if (ext === ".docx") {
        var arrayBuf = await file.arrayBuffer();
        var result = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
        setSource(result.value || "");
      } else if (ext === ".pdf") {
        var pdfBuf = await file.arrayBuffer();
        var text = await extractPdfText(pdfBuf);
        setSource(text);
      } else {
        var reader = new FileReader();
        reader.onload = function(e) {
          setSource(e.target.result || "");
          setFileProcessing(false);
        };
        reader.onerror = function() {
          setError("Failed to read file. Try pasting content directly.");
          setFileProcessing(false);
        };
        reader.readAsText(file);
        return;
      }
    } catch (err) {
      setError("Error processing file: " + (err.message || "Unknown error") + ". Try pasting content directly.");
      setUploadedFile(null);
    } finally {
      setFileProcessing(false);
    }
  }, []);

  async function extractPdfText(arrayBuffer) {
    if (!window.pdfjsLib) {
      var script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      document.head.appendChild(script);
      await new Promise(function(resolve, reject) {
        script.onload = resolve;
        script.onerror = function() { reject(new Error("Failed to load PDF reader")); };
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    var pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var pages = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      var strings = content.items.map(function(item) { return item.str; });
      pages.push(strings.join(" "));
    }
    return pages.join("\n\n");
  }

  var handleDrop = useCallback(function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  var handleDragOver = useCallback(function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  var handleDragLeave = useCallback(function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  var handleFileInput = useCallback(function(e) {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
      e.target.value = "";
    }
  }, [processFile]);

  var clearFile = function() {
    setUploadedFile(null);
    setSource("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  var flipToggle = function(k) { setToggles(function(p) { var n = Object.assign({}, p); n[k] = !n[k]; return n; }); };
  var activeToggles = Object.values(toggles).filter(Boolean).length;

  var generate = useCallback(async function() {
    if (!source.trim()) { setError("Paste or type source content to proceed."); return; }
    if (!objective.trim()) { setError("Provide a training objective so the output has clear direction."); return; }
    setError(""); setLoading(true); setOutput(""); setRawMd("");

    try {
      var res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt({ sourceContent: source, audience: audience, objective: objective, pageCount: pageCount, depth: depth, style: style, tone: tone, customTitle: customTitle, toggles: toggles }) }],
        }),
      });
      var data = await res.json();
      if (data.error) throw new Error(data.error.message || "API error");
      var md = (data.content || []).map(function(b) { return b.text || ""; }).join("\n");
      setRawMd(md);
      setOutput(renderMarkdown(md));
    } catch (e) {
      setError(e.message || "Generation failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [source, audience, objective, pageCount, depth, style, tone, customTitle, toggles]);

  var copyMd = function() {
    navigator.clipboard.writeText(rawMd);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 2200);
  };

  var resetAll = function() {
    setOutput(""); setRawMd(""); setError(""); setSource(""); setObjective("");
    setCustomTitle(""); setPageCount(2); setDepth("Balanced");
    setStyle("Standard Document"); setTone("Professional & Direct");
    setAudience(AUDIENCES[1]); setUploadedFile(null); setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setToggles({ keyTakeaways: true, stepByStep: true, examples: true, tips: true, commonMistakes: false, knowledgeCheck: false, coachingNotes: false });
  };

  var outputWords = rawMd.trim() ? rawMd.trim().split(/\s+/).length : 0;

  return (
    <div className="ec-root">
      <style>{STYLESHEET}</style>

      {/* HEADER */}
      <header className="ec-header">
        <div className="ec-header-inner">
          <div className="ec-header-left">
            <div className="ec-logo-mark">{Ico.doc}</div>
            <div>
              <h1 className="ec-header-title">Training Document Generator</h1>
              <p className="ec-header-sub">Transform raw content into structured, professional training materials</p>
            </div>
          </div>
          {output && (
            <button className="ec-btn ec-btn-ghost" onClick={resetAll}>
              {Ico.reset} <span>New Document</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN GRID */}
      <main className="ec-main">

        {/* LEFT: INPUT PANEL */}
        <div className="ec-input-col">

          {/* Source Content */}
          <div className="ec-card ec-card--teal ec-anim" style={{ animationDelay: "0s" }}>
            <div className="ec-card-header">
              <span className="ec-card-label">Source Content</span>
              <span className="ec-card-badge">{wordCount.toLocaleString()} words</span>
            </div>

            {/* Drag-and-Drop Zone */}
            <div
              className={"ec-dropzone" + (dragActive ? " ec-dropzone--active" : "") + (uploadedFile ? " ec-dropzone--has-file" : "")}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={function() { if (!uploadedFile) fileInputRef.current.click(); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.tsv,.docx,.pdf,.rtf"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
              {fileProcessing ? (
                <div className="ec-dropzone-content">
                  <span className="ec-spinner ec-spinner--teal" />
                  <span className="ec-dropzone-text">Extracting text…</span>
                </div>
              ) : uploadedFile ? (
                <div className="ec-dropzone-file">
                  <div className="ec-dropzone-file-info">
                    {Ico.fileOk}
                    <div>
                      <span className="ec-dropzone-filename">{uploadedFile.name}</span>
                      <span className="ec-dropzone-filemeta">{uploadedFile.type} · {formatFileSize(uploadedFile.size)}</span>
                    </div>
                  </div>
                  <button className="ec-dropzone-clear" onClick={function(e) { e.stopPropagation(); clearFile(); }} type="button" title="Remove file">
                    {Ico.close}
                  </button>
                </div>
              ) : (
                <div className="ec-dropzone-content">
                  <div className="ec-dropzone-icon">{Ico.upload}</div>
                  <span className="ec-dropzone-text">Drop a file here or <span className="ec-dropzone-link">browse</span></span>
                  <span className="ec-dropzone-hint">.txt, .md, .csv, .docx, .pdf — max 10 MB</span>
                </div>
              )}
            </div>

            <div className="ec-dropzone-divider">
              <span className="ec-dropzone-divider-text">or paste content directly</span>
            </div>

            <textarea
              className="ec-textarea"
              rows={7}
              placeholder="Paste your raw content here — SOPs, process docs, training notes, call scripts, policies…"
              value={source}
              onChange={function(e) { setSource(e.target.value); }}
              spellCheck={false}
            />
            <p className="ec-helper">Upload a document or paste text. The engine handles restructuring, cleanup, and formatting.</p>
          </div>

          {/* Document Settings */}
          <div className="ec-card ec-card--blue ec-anim" style={{ animationDelay: "0.05s" }}>
            <div className="ec-card-header">
              <span className="ec-card-label">Document Settings</span>
            </div>
            <div className="ec-field">
              <label className="ec-label">Training Objective <span className="ec-req">*</span></label>
              <input
                className="ec-input"
                placeholder="e.g., Teach agents the escalation workflow for billing disputes"
                value={objective}
                onChange={function(e) { setObjective(e.target.value); }}
              />
            </div>
            <div className="ec-field">
              <label className="ec-label">Custom Title <span className="ec-opt">(optional)</span></label>
              <input
                className="ec-input"
                placeholder="e.g., Billing Escalation Playbook"
                value={customTitle}
                onChange={function(e) { setCustomTitle(e.target.value); }}
              />
            </div>
          </div>

          {/* Configuration */}
          <div className="ec-card ec-card--indigo ec-anim" style={{ animationDelay: "0.1s" }}>
            <div className="ec-card-header">
              <span className="ec-card-label">Configuration</span>
            </div>
            <div className="ec-config-grid">
              <div className="ec-field">
                <label className="ec-label">Audience</label>
                <select className="ec-select" value={audience} onChange={function(e) { setAudience(e.target.value); }}>
                  {AUDIENCES.map(function(a) { return <option key={a}>{a}</option>; })}
                </select>
              </div>
              <div className="ec-field">
                <label className="ec-label">Content Depth</label>
                <select className="ec-select" value={depth} onChange={function(e) { setDepth(e.target.value); }}>
                  {DEPTHS.map(function(d) { return <option key={d}>{d}</option>; })}
                </select>
              </div>
              <div className="ec-field">
                <label className="ec-label">Creative Style</label>
                <select className="ec-select" value={style} onChange={function(e) { setStyle(e.target.value); }}>
                  {STYLES.map(function(s) { return <option key={s}>{s}</option>; })}
                </select>
              </div>
              <div className="ec-field">
                <label className="ec-label">Tone</label>
                <select className="ec-select" value={tone} onChange={function(e) { setTone(e.target.value); }}>
                  {TONES.map(function(t) { return <option key={t}>{t}</option>; })}
                </select>
              </div>
            </div>
            <div className="ec-field ec-field--range">
              <label className="ec-label">Target Length</label>
              <div className="ec-range-row">
                <input
                  type="range" min={1} max={10} step={1}
                  value={pageCount}
                  onChange={function(e) { setPageCount(+e.target.value); }}
                  className="ec-range"
                />
                <span className="ec-range-val">{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
              </div>
            </div>
          </div>

          {/* Section Toggles */}
          <div className="ec-card ec-card--amber ec-anim" style={{ animationDelay: "0.15s" }}>
            <div className="ec-card-header">
              <span className="ec-card-label">Section Toggles</span>
              <span className="ec-card-badge ec-card-badge--amber">{activeToggles} active</span>
            </div>
            <div className="ec-toggle-grid">
              {SECTION_TOGGLES.map(function(item) {
                return (
                  <button
                    key={item.key}
                    className={"ec-toggle " + (toggles[item.key] ? "ec-toggle--on" : "ec-toggle--off")}
                    onClick={function() { flipToggle(item.key); }}
                    type="button"
                  >
                    <span className="ec-toggle-icon">{item.icon}</span>
                    <span className="ec-toggle-text">{item.label}</span>
                    <span className="ec-toggle-switch">
                      <span className="ec-toggle-knob" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && <div className="ec-error">{error}</div>}

          {/* Generate Button */}
          <button
            className={"ec-btn ec-btn-primary ec-btn-generate" + (loading ? " ec-btn--loading" : "")}
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <><span className="ec-spinner" /> Generating document…</>
            ) : (
              <>{Ico.bolt} Generate Training Document</>
            )}
          </button>
        </div>

        {/* RIGHT: OUTPUT PANEL */}
        <div className="ec-output-col">
          <div className="ec-output-card">
            {/* Empty State */}
            {!output && !loading && (
              <div className="ec-empty">
                <div className="ec-empty-icon">{Ico.doc}</div>
                <p className="ec-empty-title">Document output</p>
                <p className="ec-empty-desc">Configure your settings, paste source content, and generate. Your formatted training document will render here.</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="ec-empty">
                <div className="ec-loading-bar"><div className="ec-loading-fill" /></div>
                <p className="ec-empty-title">Building your document</p>
                <p className="ec-empty-desc">Analyzing source content, applying structure, and formatting output…</p>
              </div>
            )}

            {/* Result */}
            {output && (
              <>
                <div className="ec-output-toolbar">
                  <div className="ec-output-meta">
                    <span className="ec-card-label" style={{ marginBottom: 0 }}>Generated Document</span>
                    <span className="ec-output-stat">{outputWords.toLocaleString()} words · {style}</span>
                  </div>
                  <div className="ec-output-actions">
                    <button className="ec-btn ec-btn-ghost ec-btn-sm" onClick={copyMd}>
                      {copied ? <>{Ico.check} <span>Copied</span></> : <>{Ico.copy} <span>Copy Markdown</span></>}
                    </button>
                  </div>
                </div>
                <div
                  className="ec-md-body"
                  dangerouslySetInnerHTML={{ __html: output }}
                />
                <div className="ec-output-footer">
                  © Consumer Engagement Solutions, LLC. — All Rights Reserved.
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="ec-footer">
        © Consumer Engagement Solutions, LLC. — All Rights Reserved.
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STYLESHEET — ec-* naming convention
   Full CES style system v2
   ═══════════════════════════════════════════ */
var STYLESHEET = "\
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');\
\
:root {\
  --ec-primary: #2563EB;\
  --ec-primary-hover: #1D4ED8;\
  --ec-primary-light: #EFF6FF;\
  --ec-primary-glow: rgba(37,99,235,0.18);\
  --ec-teal: #0D9488;\
  --ec-teal-light: #F0FDFA;\
  --ec-green: #16A34A;\
  --ec-green-light: #F0FDF4;\
  --ec-amber: #D97706;\
  --ec-amber-light: #FFFBEB;\
  --ec-red: #DC2626;\
  --ec-red-light: #FEF2F2;\
  --ec-indigo: #4F46E5;\
  --ec-indigo-light: #EEF2FF;\
  --ec-bg: #F8FAFC;\
  --ec-card: #FFFFFF;\
  --ec-border: #E5E7EB;\
  --ec-border-light: #F1F5F9;\
  --ec-text: #111827;\
  --ec-text-sec: #6B7280;\
  --ec-text-muted: #9CA3AF;\
  --ec-radius: 10px;\
  --ec-radius-sm: 8px;\
  --ec-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03);\
  --ec-shadow-md: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);\
}\
\
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\
\
.ec-root {\
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\
  background: var(--ec-bg);\
  color: var(--ec-text);\
  min-height: 100vh;\
  -webkit-font-smoothing: antialiased;\
}\
\
@keyframes ec-fadeUp {\
  from { opacity: 0; transform: translateY(10px); }\
  to { opacity: 1; transform: translateY(0); }\
}\
@keyframes ec-spin {\
  to { transform: rotate(360deg); }\
}\
@keyframes ec-loading {\
  0% { transform: translateX(-100%); }\
  50% { transform: translateX(0%); }\
  100% { transform: translateX(100%); }\
}\
\
.ec-anim { animation: ec-fadeUp 0.4s ease both; }\
\
.ec-header {\
  background: var(--ec-card);\
  border-bottom: 1px solid var(--ec-border);\
  padding: 14px 24px;\
  position: sticky;\
  top: 0;\
  z-index: 100;\
}\
.ec-header-inner {\
  max-width: 1100px;\
  margin: 0 auto;\
  display: flex;\
  justify-content: space-between;\
  align-items: center;\
  gap: 12px;\
}\
.ec-header-left {\
  display: flex;\
  align-items: center;\
  gap: 12px;\
}\
.ec-logo-mark {\
  width: 40px;\
  height: 40px;\
  border-radius: var(--ec-radius);\
  background: linear-gradient(135deg, var(--ec-primary), var(--ec-primary-hover));\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  color: #fff;\
  flex-shrink: 0;\
  box-shadow: 0 2px 8px rgba(37,99,235,0.25);\
}\
.ec-header-title {\
  font-size: 1.15rem;\
  font-weight: 700;\
  color: var(--ec-text);\
  letter-spacing: -0.025em;\
  line-height: 1.2;\
}\
.ec-header-sub {\
  font-size: 0.78rem;\
  color: var(--ec-text-sec);\
  margin-top: 1px;\
  line-height: 1.3;\
}\
\
.ec-main {\
  max-width: 1100px;\
  margin: 0 auto;\
  padding: 24px;\
  display: grid;\
  grid-template-columns: 400px 1fr;\
  gap: 24px;\
  align-items: start;\
}\
\
.ec-input-col {\
  display: flex;\
  flex-direction: column;\
  gap: 16px;\
  position: sticky;\
  top: 82px;\
  max-height: calc(100vh - 100px);\
  overflow-y: auto;\
  padding-right: 4px;\
  scrollbar-width: thin;\
  scrollbar-color: var(--ec-border) transparent;\
}\
.ec-input-col::-webkit-scrollbar { width: 4px; }\
.ec-input-col::-webkit-scrollbar-thumb { background: var(--ec-border); border-radius: 4px; }\
\
.ec-card {\
  background: var(--ec-card);\
  border-radius: var(--ec-radius);\
  border: 1px solid var(--ec-border);\
  border-left: 3px solid var(--ec-border);\
  padding: 16px 18px;\
  box-shadow: var(--ec-shadow);\
  transition: box-shadow 0.2s ease, border-color 0.2s ease;\
}\
.ec-card:hover { box-shadow: var(--ec-shadow-md); }\
.ec-card--teal { border-left-color: var(--ec-teal); }\
.ec-card--blue { border-left-color: var(--ec-primary); }\
.ec-card--indigo { border-left-color: var(--ec-indigo); }\
.ec-card--amber { border-left-color: var(--ec-amber); }\
.ec-card--green { border-left-color: var(--ec-green); }\
\
.ec-card-header {\
  display: flex;\
  justify-content: space-between;\
  align-items: center;\
  margin-bottom: 12px;\
}\
.ec-card-label {\
  font-size: 0.68rem;\
  font-weight: 700;\
  letter-spacing: 0.07em;\
  text-transform: uppercase;\
  color: var(--ec-text-muted);\
}\
.ec-card-badge {\
  font-size: 0.7rem;\
  font-weight: 600;\
  color: var(--ec-primary);\
  background: var(--ec-primary-light);\
  padding: 2px 9px;\
  border-radius: 12px;\
}\
.ec-card-badge--amber {\
  color: var(--ec-amber);\
  background: var(--ec-amber-light);\
}\
\
.ec-field { margin-bottom: 12px; }\
.ec-field:last-child { margin-bottom: 0; }\
\
.ec-label {\
  display: block;\
  font-size: 0.8rem;\
  font-weight: 600;\
  color: var(--ec-text);\
  margin-bottom: 5px;\
  letter-spacing: -0.01em;\
}\
.ec-req { color: var(--ec-red); font-weight: 500; }\
.ec-opt { color: var(--ec-text-muted); font-weight: 400; font-size: 0.73rem; }\
\
.ec-input,\
.ec-textarea,\
.ec-select {\
  width: 100%;\
  padding: 9px 12px;\
  border-radius: var(--ec-radius-sm);\
  border: 1px solid var(--ec-border);\
  font-size: 0.85rem;\
  font-family: inherit;\
  color: var(--ec-text);\
  background: #FAFBFC;\
  outline: none;\
  transition: border-color 0.15s ease, box-shadow 0.15s ease;\
}\
.ec-input:focus,\
.ec-textarea:focus,\
.ec-select:focus {\
  border-color: var(--ec-primary);\
  box-shadow: 0 0 0 3px var(--ec-primary-glow);\
  background: #fff;\
}\
.ec-textarea {\
  resize: vertical;\
  line-height: 1.6;\
  min-height: 100px;\
}\
.ec-select {\
  cursor: pointer;\
  appearance: auto;\
}\
\
.ec-helper {\
  font-size: 0.72rem;\
  color: var(--ec-text-muted);\
  margin-top: 6px;\
  line-height: 1.4;\
}\
\
.ec-config-grid {\
  display: grid;\
  grid-template-columns: 1fr 1fr;\
  gap: 12px 14px;\
}\
\
.ec-field--range { margin-top: 4px; }\
.ec-range-row {\
  display: flex;\
  align-items: center;\
  gap: 12px;\
}\
.ec-range {\
  flex: 1;\
  accent-color: var(--ec-primary);\
  height: 6px;\
}\
.ec-range-val {\
  font-size: 0.82rem;\
  font-weight: 700;\
  color: var(--ec-primary);\
  min-width: 60px;\
  text-align: right;\
}\
\
.ec-toggle-grid {\
  display: flex;\
  flex-direction: column;\
  gap: 5px;\
}\
.ec-toggle {\
  display: flex;\
  align-items: center;\
  gap: 8px;\
  padding: 7px 10px;\
  border-radius: var(--ec-radius-sm);\
  border: 1px solid var(--ec-border);\
  background: var(--ec-card);\
  cursor: pointer;\
  font-family: inherit;\
  font-size: 0.8rem;\
  font-weight: 500;\
  transition: all 0.15s ease;\
  text-align: left;\
  width: 100%;\
}\
.ec-toggle:hover { background: var(--ec-bg); }\
.ec-toggle--on {\
  border-color: #BFDBFE;\
  background: var(--ec-primary-light);\
}\
.ec-toggle--on:hover { background: #DBEAFE; }\
.ec-toggle-icon {\
  width: 22px;\
  height: 22px;\
  border-radius: 6px;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  font-size: 0.7rem;\
  flex-shrink: 0;\
  background: var(--ec-bg);\
  color: var(--ec-text-sec);\
  font-weight: 700;\
}\
.ec-toggle--on .ec-toggle-icon {\
  background: var(--ec-primary);\
  color: #fff;\
}\
.ec-toggle-text {\
  flex: 1;\
  color: var(--ec-text-sec);\
}\
.ec-toggle--on .ec-toggle-text { color: var(--ec-text); }\
.ec-toggle-switch {\
  width: 32px;\
  height: 18px;\
  border-radius: 12px;\
  background: var(--ec-border);\
  position: relative;\
  flex-shrink: 0;\
  transition: background 0.2s ease;\
}\
.ec-toggle--on .ec-toggle-switch { background: var(--ec-primary); }\
.ec-toggle-knob {\
  position: absolute;\
  top: 2px;\
  left: 2px;\
  width: 14px;\
  height: 14px;\
  border-radius: 50%;\
  background: #fff;\
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);\
  transition: transform 0.2s ease;\
}\
.ec-toggle--on .ec-toggle-knob { transform: translateX(14px); }\
\
.ec-error {\
  padding: 10px 14px;\
  border-radius: var(--ec-radius-sm);\
  border: 1px solid #FECACA;\
  border-left: 3px solid var(--ec-red);\
  background: var(--ec-red-light);\
  color: var(--ec-red);\
  font-size: 0.82rem;\
  font-weight: 500;\
  animation: ec-fadeUp 0.25s ease;\
}\
\
.ec-btn {\
  display: inline-flex;\
  align-items: center;\
  justify-content: center;\
  gap: 7px;\
  font-family: inherit;\
  font-weight: 600;\
  border: none;\
  cursor: pointer;\
  border-radius: var(--ec-radius-sm);\
  transition: all 0.15s ease;\
  white-space: nowrap;\
}\
.ec-btn:active { transform: scale(0.97); }\
\
.ec-btn-primary {\
  background: linear-gradient(135deg, var(--ec-primary), var(--ec-primary-hover));\
  color: #fff;\
  padding: 12px 20px;\
  font-size: 0.88rem;\
  box-shadow: 0 2px 8px rgba(37,99,235,0.28);\
}\
.ec-btn-primary:hover {\
  box-shadow: 0 4px 14px rgba(37,99,235,0.35);\
  filter: brightness(1.05);\
}\
.ec-btn--loading {\
  opacity: 0.75;\
  cursor: not-allowed;\
  pointer-events: none;\
}\
\
.ec-btn-ghost {\
  background: var(--ec-card);\
  color: var(--ec-text-sec);\
  border: 1px solid var(--ec-border);\
  padding: 7px 14px;\
  font-size: 0.8rem;\
}\
.ec-btn-ghost:hover {\
  background: var(--ec-bg);\
  color: var(--ec-text);\
  border-color: #D1D5DB;\
}\
.ec-btn-sm { padding: 5px 12px; font-size: 0.76rem; }\
.ec-btn-generate { width: 100%; margin-top: 2px; }\
\
.ec-spinner {\
  width: 16px;\
  height: 16px;\
  border: 2px solid rgba(255,255,255,0.3);\
  border-top-color: #fff;\
  border-radius: 50%;\
  animation: ec-spin 0.65s linear infinite;\
  display: inline-block;\
  flex-shrink: 0;\
}\
\
.ec-output-col {\
  min-height: 500px;\
  display: flex;\
}\
.ec-output-card {\
  flex: 1;\
  background: var(--ec-card);\
  border-radius: var(--ec-radius);\
  border: 1px solid var(--ec-border);\
  box-shadow: var(--ec-shadow);\
  display: flex;\
  flex-direction: column;\
  overflow: hidden;\
  animation: ec-fadeUp 0.45s ease both;\
  animation-delay: 0.1s;\
}\
\
.ec-empty {\
  flex: 1;\
  display: flex;\
  flex-direction: column;\
  align-items: center;\
  justify-content: center;\
  padding: 64px 32px;\
  text-align: center;\
}\
.ec-empty-icon {\
  width: 56px;\
  height: 56px;\
  border-radius: 14px;\
  background: var(--ec-bg);\
  border: 1px solid var(--ec-border);\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  color: var(--ec-text-muted);\
  margin-bottom: 16px;\
}\
.ec-empty-title {\
  font-size: 0.95rem;\
  font-weight: 600;\
  color: var(--ec-text-sec);\
  margin-bottom: 6px;\
}\
.ec-empty-desc {\
  font-size: 0.82rem;\
  color: var(--ec-text-muted);\
  max-width: 300px;\
  line-height: 1.5;\
}\
\
.ec-loading-bar {\
  width: 200px;\
  height: 4px;\
  border-radius: 4px;\
  background: var(--ec-border);\
  overflow: hidden;\
  margin-bottom: 20px;\
}\
.ec-loading-fill {\
  width: 45%;\
  height: 100%;\
  border-radius: 4px;\
  background: linear-gradient(90deg, var(--ec-primary), var(--ec-indigo));\
  animation: ec-loading 1.8s ease-in-out infinite;\
}\
\
.ec-output-toolbar {\
  display: flex;\
  justify-content: space-between;\
  align-items: center;\
  padding: 12px 20px;\
  border-bottom: 1px solid var(--ec-border);\
  background: var(--ec-card);\
  position: sticky;\
  top: 0;\
  z-index: 10;\
}\
.ec-output-meta {\
  display: flex;\
  flex-direction: column;\
  gap: 2px;\
}\
.ec-output-stat {\
  font-size: 0.72rem;\
  color: var(--ec-text-muted);\
}\
.ec-output-actions {\
  display: flex;\
  gap: 6px;\
}\
\
.ec-md-body {\
  padding: 28px 32px 48px;\
  line-height: 1.7;\
}\
.ec-md-h1 {\
  font-size: 1.45rem;\
  font-weight: 700;\
  color: var(--ec-text);\
  margin: 0 0 14px 0;\
  padding-bottom: 12px;\
  border-bottom: 2px solid var(--ec-primary);\
  letter-spacing: -0.02em;\
  line-height: 1.25;\
}\
.ec-md-h2 {\
  font-size: 1.1rem;\
  font-weight: 700;\
  color: var(--ec-text);\
  margin: 30px 0 10px 0;\
  padding-bottom: 7px;\
  border-bottom: 1px solid var(--ec-border);\
  letter-spacing: -0.015em;\
  line-height: 1.3;\
}\
.ec-md-h3 {\
  font-size: 0.95rem;\
  font-weight: 600;\
  color: #374151;\
  margin: 22px 0 6px 0;\
  line-height: 1.35;\
}\
.ec-md-p {\
  font-size: 0.88rem;\
  color: #374151;\
  line-height: 1.72;\
  margin: 0 0 10px 0;\
}\
.ec-md-ul, .ec-md-ol {\
  margin: 8px 0 16px 22px;\
  padding: 0;\
}\
.ec-md-ul li, .ec-md-ol li {\
  font-size: 0.88rem;\
  color: #374151;\
  line-height: 1.65;\
  margin-bottom: 5px;\
}\
.ec-md-ul li::marker { color: var(--ec-primary); }\
.ec-md-ol li::marker { color: var(--ec-primary); font-weight: 600; }\
.ec-md-hr {\
  border: none;\
  border-top: 1px solid var(--ec-border);\
  margin: 26px 0;\
}\
.ec-md-code {\
  font-family: 'SFMono-Regular', 'Menlo', monospace;\
  font-size: 0.82em;\
  background: var(--ec-bg);\
  border: 1px solid var(--ec-border);\
  padding: 1px 5px;\
  border-radius: 4px;\
  color: var(--ec-indigo);\
}\
.ec-md-body strong { color: var(--ec-text); }\
\
.ec-output-footer {\
  padding: 16px 20px;\
  border-top: 1px solid var(--ec-border-light);\
  text-align: center;\
  font-size: 0.7rem;\
  color: var(--ec-text-muted);\
  background: var(--ec-bg);\
}\
\
.ec-footer {\
  text-align: center;\
  padding: 20px 24px;\
  font-size: 0.72rem;\
  color: var(--ec-text-muted);\
  border-top: 1px solid var(--ec-border-light);\
}\
\
.ec-dropzone {\
  border: 2px dashed var(--ec-border);\
  border-radius: var(--ec-radius-sm);\
  padding: 20px 16px;\
  text-align: center;\
  cursor: pointer;\
  transition: all 0.2s ease;\
  background: var(--ec-bg);\
}\
.ec-dropzone:hover {\
  border-color: #B0C4DE;\
  background: #F1F5F9;\
}\
.ec-dropzone--active {\
  border-color: var(--ec-teal);\
  background: var(--ec-teal-light);\
  box-shadow: 0 0 0 3px rgba(13,148,136,0.12);\
}\
.ec-dropzone--has-file {\
  border-style: solid;\
  border-color: var(--ec-teal);\
  background: var(--ec-teal-light);\
  cursor: default;\
  padding: 12px 14px;\
}\
.ec-dropzone-content {\
  display: flex;\
  flex-direction: column;\
  align-items: center;\
  gap: 6px;\
}\
.ec-dropzone-icon {\
  width: 44px;\
  height: 44px;\
  border-radius: 12px;\
  background: var(--ec-card);\
  border: 1px solid var(--ec-border);\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  color: var(--ec-text-muted);\
  margin-bottom: 2px;\
  transition: all 0.2s ease;\
}\
.ec-dropzone:hover .ec-dropzone-icon {\
  color: var(--ec-teal);\
  border-color: #B2DFDB;\
}\
.ec-dropzone--active .ec-dropzone-icon {\
  color: var(--ec-teal);\
  background: #fff;\
  border-color: var(--ec-teal);\
}\
.ec-dropzone-text {\
  font-size: 0.82rem;\
  font-weight: 500;\
  color: var(--ec-text-sec);\
}\
.ec-dropzone-link {\
  color: var(--ec-primary);\
  font-weight: 600;\
  text-decoration: underline;\
  text-decoration-color: rgba(37,99,235,0.3);\
  text-underline-offset: 2px;\
}\
.ec-dropzone-hint {\
  font-size: 0.7rem;\
  color: var(--ec-text-muted);\
}\
.ec-dropzone-file {\
  display: flex;\
  align-items: center;\
  justify-content: space-between;\
  gap: 10px;\
  width: 100%;\
}\
.ec-dropzone-file-info {\
  display: flex;\
  align-items: center;\
  gap: 10px;\
  min-width: 0;\
}\
.ec-dropzone-filename {\
  font-size: 0.82rem;\
  font-weight: 600;\
  color: var(--ec-text);\
  display: block;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
  max-width: 220px;\
}\
.ec-dropzone-filemeta {\
  font-size: 0.7rem;\
  color: var(--ec-teal);\
  display: block;\
  margin-top: 1px;\
}\
.ec-dropzone-clear {\
  width: 28px;\
  height: 28px;\
  border-radius: 6px;\
  border: 1px solid var(--ec-border);\
  background: var(--ec-card);\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  cursor: pointer;\
  color: var(--ec-text-muted);\
  flex-shrink: 0;\
  transition: all 0.15s ease;\
}\
.ec-dropzone-clear:hover {\
  background: var(--ec-red-light);\
  border-color: #FECACA;\
  color: var(--ec-red);\
}\
.ec-dropzone-divider {\
  display: flex;\
  align-items: center;\
  gap: 12px;\
  margin: 12px 0;\
}\
.ec-dropzone-divider::before,\
.ec-dropzone-divider::after {\
  content: '';\
  flex: 1;\
  height: 1px;\
  background: var(--ec-border);\
}\
.ec-dropzone-divider-text {\
  font-size: 0.7rem;\
  font-weight: 500;\
  color: var(--ec-text-muted);\
  text-transform: uppercase;\
  letter-spacing: 0.04em;\
  white-space: nowrap;\
}\
\
.ec-spinner--teal {\
  width: 20px;\
  height: 20px;\
  border: 2px solid rgba(13,148,136,0.2);\
  border-top-color: var(--ec-teal);\
  border-radius: 50%;\
  animation: ec-spin 0.65s linear infinite;\
  display: inline-block;\
}\
\
@media (max-width: 860px) {\
  .ec-main {\
    grid-template-columns: 1fr;\
    padding: 16px;\
  }\
  .ec-input-col {\
    position: static;\
    max-height: none;\
    overflow: visible;\
    padding-right: 0;\
  }\
  .ec-config-grid {\
    grid-template-columns: 1fr;\
  }\
  .ec-header-sub { display: none; }\
  .ec-md-body { padding: 20px 18px 36px; }\
}\
";
