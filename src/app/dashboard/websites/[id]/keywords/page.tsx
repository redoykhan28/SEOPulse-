"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  ArrowLeft, Upload, Loader2, AlertTriangle, CheckCircle2,
  TrendingUp, MinusCircle, XCircle, Sparkles, FileText,
  Target, BarChart2
} from "lucide-react";
import { cn } from "@/lib/utils";

type KeywordMatch = {
  id: string;
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  matchStatus: string;
  suggestedPage: string | null;
};

type KeywordFile = {
  id: string;
  filename: string;
  uploadedAt: string;
  matches: KeywordMatch[];
};

const STATUS_CONFIG = {
  "targeted": {
    label: "Targeted",
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  "targeted (ai)": {
    label: "Targeted (AI)",
    icon: Sparkles,
    className: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
    badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
  },
  "partially targeted": {
    label: "Partial",
    icon: MinusCircle,
    className: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10",
    badgeClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
  },
  "not targeted": {
    label: "Gap ✦",
    icon: XCircle,
    className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  },
};

function getDifficultyLabel(d: number | null) {
  if (d === null) return null;
  if (d <= 30) return { label: "Easy", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" };
  if (d <= 60) return { label: "Medium", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" };
  return { label: "Hard", cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" };
}

export default function KeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: websiteId } = use(params);
  const [keywordFile, setKeywordFile] = useState<KeywordFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/websites/${websiteId}/keywords`)
      .then(r => r.json())
      .then(d => setKeywordFile(d.keywordFile))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [websiteId]);

  const handleFile = (file: File) => {
    setIsProcessing(true);
    setError("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];

        // Auto-detect columns (case-insensitive)
        const sample = rows[0] || {};
        const keys = Object.keys(sample);
        const kwCol = keys.find(k => /keyword/i.test(k)) || keys[0];
        const volCol = keys.find(k => /volume|vol/i.test(k));
        const diffCol = keys.find(k => /difficult|diff|kd/i.test(k));

        const keywords = rows.map(r => ({
          keyword: (r[kwCol] || "").trim(),
          volume: volCol ? parseInt(r[volCol]) || null : null,
          difficulty: diffCol ? parseInt(r[diffCol]) || null : null,
        })).filter(k => k.keyword.length > 0);

        if (keywords.length === 0) {
          setError("No keywords found in CSV. Ensure a 'keyword' column exists.");
          setIsProcessing(false);
          return;
        }

        try {
          const res = await fetch(`/api/websites/${websiteId}/keywords`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keywords, filename: file.name, useAI }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to process keywords");
          setKeywordFile(data.keywordFile);
        } catch (e: any) {
          setError(e.message);
        } finally {
          setIsProcessing(false);
        }
      },
      error: (e) => {
        setError(`CSV parse error: ${e.message}`);
        setIsProcessing(false);
      }
    });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const filteredMatches = keywordFile?.matches.filter(m => {
    const statusMatch = filterStatus === "all" || m.matchStatus.toLowerCase() === filterStatus;
    const searchMatch = !searchQuery || m.keyword.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  }) || [];

  const stats = {
    total: keywordFile?.matches.length || 0,
    targeted: keywordFile?.matches.filter(m => m.matchStatus.toLowerCase().startsWith("targeted")).length || 0,
    partial: keywordFile?.matches.filter(m => m.matchStatus === "partially targeted").length || 0,
    gaps: keywordFile?.matches.filter(m => m.matchStatus === "not targeted").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/websites/${websiteId}`} className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Keyword Gap Analysis</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload a keyword CSV to find content opportunities</p>
          </div>
        </div>
        {keywordFile && (
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-white/20 transition-colors text-gray-700 dark:text-white">
            <Upload className="h-4 w-4" /> Re-upload
          </button>
        )}
      </div>

      {/* Stats */}
      {keywordFile && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Keywords", value: stats.total, icon: BarChart2, cls: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" },
            { label: "Targeted", value: stats.targeted, icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" },
            { label: "Partial Match", value: stats.partial, icon: MinusCircle, cls: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10" },
            { label: "Content Gaps", value: stats.gaps, icon: TrendingUp, cls: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-xl", s.cls.split(' ').slice(1).join(' '))}><s.icon className={cn("h-5 w-5", s.cls.split(' ')[0])} /></div>
              <div>
                <div className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {!keywordFile && !isProcessing && (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="group cursor-pointer border-2 border-dashed border-gray-300 dark:border-white/20 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-16 text-center transition-all hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5"
        >
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Upload Keyword CSV</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Drag & drop or click to upload. Columns: <code className="text-xs bg-gray-100 dark:bg-white/10 px-1 rounded">keyword</code>, <code className="text-xs bg-gray-100 dark:bg-white/10 px-1 rounded">volume</code>, <code className="text-xs bg-gray-100 dark:bg-white/10 px-1 rounded">difficulty</code></p>
          
          {/* AI Toggle */}
          <div className="flex items-center justify-center gap-3 mt-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setUseAI(!useAI)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                useAI
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                  : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
              )}
            >
              <Sparkles className="h-4 w-4" />
              AI Enhancement {useAI ? "ON" : "OFF"}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">Uses OpenRouter (requires OPENROUTER_API_KEY)</span>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-2xl p-16 text-center">
          <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Analyzing Keywords...</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Matching against {useAI ? "AI + string search" : "crawled page content"}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {keywordFile && (
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <FileText className="h-4 w-4" />
              <span className="font-medium">{keywordFile.filename}</span>
              <span>— {new Date(keywordFile.uploadedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="targeted">Targeted</option>
                <option value="partially targeted">Partial</option>
                <option value="not targeted">Gaps Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                  <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Keyword</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Volume</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Difficulty</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Best Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                {filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-gray-600">No keywords match your filters.</td>
                  </tr>
                ) : filteredMatches.map((m) => {
                  const statusKey = m.matchStatus.toLowerCase() as keyof typeof STATUS_CONFIG;
                  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG["not targeted"];
                  const diff = getDifficultyLabel(m.difficulty);

                  return (
                    <tr key={m.id} className={cn(
                      "hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors",
                      m.matchStatus === "not targeted" ? "bg-red-50/20 dark:bg-red-500/[0.03]" : ""
                    )}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{m.keyword}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-gray-300 font-mono">
                        {m.volume !== null ? m.volume.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-4">
                        {diff ? (
                          <span className={cn("px-2 py-0.5 rounded text-xs font-bold", diff.cls)}>{diff.label} ({m.difficulty})</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", statusCfg.badgeClass)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate text-xs font-mono">
                        {m.suggestedPage ? (
                          <a href={m.suggestedPage} target="_blank" rel="noreferrer" className="hover:text-indigo-500 underline underline-offset-2">
                            {m.suggestedPage}
                          </a>
                        ) : (
                          <span className="text-red-400 font-medium">Create new page →</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}
