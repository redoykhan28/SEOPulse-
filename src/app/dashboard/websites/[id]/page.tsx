"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { 
  ArrowLeft, Globe, RefreshCw, AlertTriangle, 
  CheckCircle2, Info, Loader2, ExternalLink, Calendar,
  ShieldAlert, ShieldCheck, ChevronDown, ChevronRight,
  FileSearch, X, Search, Trash2, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { WebsiteDetailsSkeleton } from "@/components/ui/Skeleton";
import { EditWebsiteModal } from "@/components/EditWebsiteModal";

const DynamicPDFDownloadButton = dynamic(
  () => import("@/components/pdf/PDFDownloadButton"),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type PageRef = { url: string; title: string | null };

export type SeoIssue = {
  id: string;
  checkType: string;
  passed: boolean;
  severity: string;
  details: string;
  page?: PageRef | null;
};

type Scan = {
  id: string;
  status: string;
  overallScore: number | null;
  startedAt: string;
  completedAt: string | null;
  seoIssues: SeoIssue[];
};

type SeoChange = {
  id: string;
  field: string;
  before: string | null;
  after: string | null;
  impact: string | null;
  createdAt: string;
};

type CrawledPage = {
  id: string;
  url: string;
  title: string | null;
  createdAt: string;
};

type WebsiteDetails = {
  id: string;
  url: string;
  scanFrequency: string;
  notifyEmails: string[];
  enabledAlerts: string[];
  scans: Scan[];
  seoChanges: SeoChange[];
  pages: CrawledPage[];
};

// ─── Rule metadata map ────────────────────────────────────────────────────────
const RULE_META: Record<string, { label: string; category: string }> = {
  title_tag:            { label: "Title Tag",                category: "SEO" },
  meta_description:     { label: "Meta Description",         category: "SEO" },
  h1_presence:          { label: "H1 Heading",               category: "SEO" },
  canonical_tag:        { label: "Canonical Tag",            category: "Technical" },
  schema_markup:        { label: "Schema Markup",            category: "Technical" },
  viewport_tag:         { label: "Mobile Viewport",          category: "Technical" },
  robots_directive:     { label: "Robots Directives",        category: "Technical" },
  open_graph:           { label: "Open Graph Tags",          category: "Social" },
  twitter_cards:        { label: "Twitter Cards",            category: "Social" },
  html_lang:            { label: "HTML Language Attribute",  category: "Accessibility" },
  image_alt_attributes: { label: "Image Alt Attributes",     category: "Accessibility" },
  form_labels:          { label: "Form Input Labels",        category: "Accessibility" },
  empty_links:          { label: "Descriptive Link Text",    category: "Accessibility" },
  broken_links:         { label: "Broken Links (404s)",      category: "Technical" },
};

const CATEGORY_COLORS: Record<string, string> = {
  SEO:           "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
  Technical:     "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10",
  Social:        "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10",
  Accessibility: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
};

// ─── Crawled Pages Modal ──────────────────────────────────────────────────────
function CrawledPagesModal({ pages, onClose }: { pages: CrawledPage[]; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const filtered = pages.filter(p =>
    p.url.toLowerCase().includes(search.toLowerCase()) ||
    (p.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Crawled Pages</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{pages.length} pages discovered</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pages..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50 dark:divide-white/5">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No pages match your search.</div>
          ) : filtered.map((page, i) => (
            <div key={page.id} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
              <span className="text-xs text-gray-400 w-7 flex-shrink-0 mt-0.5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {page.title || <span className="italic text-gray-400">No title</span>}
                </p>
                <a
                  href={page.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-500 hover:text-indigo-600 truncate block mt-0.5"
                >
                  {page.url}
                </a>
              </div>
              <a href={page.url} target="_blank" rel="noreferrer" className="flex-shrink-0 text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Accordion Issue Group ────────────────────────────────────────────────────
function IssueAccordion({ checkType, issues, defaultOpen = false }: {
  checkType: string;
  issues: SeoIssue[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = RULE_META[checkType] || { label: checkType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), category: "Technical" };
  const failed = issues.filter(i => !i.passed);
  const passed = issues.filter(i => i.passed);
  const hasFailed = failed.length > 0;
  const categoryColor = CATEGORY_COLORS[meta.category] || CATEGORY_COLORS["Technical"];

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-all",
      hasFailed
        ? "border-red-100 dark:border-red-500/20"
        : "border-gray-100 dark:border-white/10"
    )}>
      {/* Accordion Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-4 text-left transition-colors cursor-pointer",
          hasFailed
            ? "bg-red-50/60 dark:bg-red-500/5 hover:bg-red-50 dark:hover:bg-red-500/10"
            : "bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-white/[0.02]"
        )}
      >
        {/* Status Icon */}
        <div className="flex-shrink-0">
          {hasFailed ? (
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          )}
        </div>

        {/* Title & Category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-sm font-bold", hasFailed ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300")}>
              {meta.label}
            </span>
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide", categoryColor)}>
              {meta.category}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {hasFailed
              ? `${failed.length} page${failed.length !== 1 ? 's' : ''} with issues${passed.length > 0 ? ` · ${passed.length} passed` : ''}`
              : `All ${passed.length} page${passed.length !== 1 ? 's' : ''} passed`
            }
          </p>
        </div>

        {/* Count badge + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasFailed && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
              {failed.length} issue{failed.length !== 1 ? 's' : ''}
            </span>
          )}
          {open
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />
          }
        </div>
      </button>

      {/* Accordion Body */}
      {open && (
        <div className="divide-y divide-gray-50 dark:divide-white/5 bg-white dark:bg-[#0d0d0d]">
          {/* Failed pages first */}
          {failed.map(issue => (
            <div key={issue.id} className="px-5 py-3 flex items-start gap-3 bg-red-50/30 dark:bg-red-500/5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {issue.page?.url && (
                  <a
                    href={issue.page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate block mb-0.5 cursor-pointer"
                  >
                    {issue.page.title || issue.page.url}
                  </a>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300">{issue.details}</p>
              </div>
              <span className={cn(
                "flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                issue.severity === 'FAILED'
                  ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400"
              )}>
                {issue.severity === 'FAILED' ? 'Error' : 'Warning'}
              </span>
            </div>
          ))}
          {/* Passed pages */}
          {passed.map(issue => (
            <div key={issue.id} className="px-5 py-3 flex items-start gap-3 opacity-60">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {issue.page?.url && (
                  <a
                    href={issue.page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline truncate block mb-0.5 cursor-pointer"
                  >
                    {issue.page.title || issue.page.url}
                  </a>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">{issue.details}</p>
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                Pass
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WebsiteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const websiteId = unwrappedParams.id;
  const router = useRouter();
  
  const [website, setWebsite] = useState<WebsiteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ crawled: number; remaining: number } | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'ALL' | 'FAILED' | 'PASSED' | 'HISTORY'>('ALL');
  const [showPagesModal, setShowPagesModal] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { success, error: toastError, info } = useToast();

  const handleDelete = async () => {
    if (!website) return;
    setDeleteTarget(website.url);
  };

  const confirmDelete = async () => {
    if (!website) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/websites/${website.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete website");
      success("Website deleted", `${website.url} has been removed.`);
      router.push('/dashboard');
    } catch (err) {
      toastError("Delete failed", "Could not delete the website. Please try again.");
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const fetchWebsiteDetails = useCallback(async (scrollToReport = false) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWebsite(data.website);
      if (scrollToReport) {
        setJustUpdated(true);
        setTimeout(() => {
          reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        setTimeout(() => setJustUpdated(false), 2000);
      }
    } catch (err) {
      setError("Failed to load website details.");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId]);

  useEffect(() => { fetchWebsiteDetails(); }, [fetchWebsiteDetails]);

  // ─── Chunked scan orchestrator ───────────────────────────────────────────
  const processChunk = useCallback(async (scanId: string) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/scan/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process chunk");

      if (data.status === "RUNNING") {
        setScanProgress(prev => ({
          crawled: (prev?.crawled || 0) + (data.pagesCrawledThisChunk || 0),
          remaining: data.remainingQueue || 0
        }));
        setTimeout(() => processChunk(scanId), 500);
      } else if (data.status === "COMPLETED") {
        setScanProgress(null);
        setIsScanning(false);
        success("Audit Complete", `Successfully scanned ${website?.url}`);
        await fetchWebsiteDetails(true); // true = scroll to report after update
      }
    } catch (err: any) {
      setError(err.message);
      toastError("Audit failed", err.message);
      setIsScanning(false);
      setScanProgress(null);
    }
  }, [websiteId, fetchWebsiteDetails]);

  const handleScan = async () => {
    setIsScanning(true);
    setError("");
    info("Audit Started", `Initializing deep scan for ${website?.url}...`);
    setScanProgress({ crawled: 0, remaining: 1 });
    try {
      const res = await fetch(`/api/websites/${websiteId}/scan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start scan");
      await processChunk(data.scanId);
    } catch (err: any) {
      setError(err.message);
      toastError("Audit failed", err.message);
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="pt-4">
        <WebsiteDetailsSkeleton />
      </div>
    );
  }

  if (error && !website) {
    return (
      <div className="p-8 text-center bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 dark:text-red-400">Error Loading Website</h3>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>
        <Link href="/dashboard" className="mt-6 inline-block px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium cursor-pointer">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (!website) return null;

  const latestScan = website.scans[0];
  const hostname = (() => { try { return new URL(website.url).hostname; } catch { return website.url; } })();

  // Build accordion groups: group issues by checkType
  const allIssues = latestScan?.seoIssues || [];
  const groupedIssues = allIssues.reduce<Record<string, SeoIssue[]>>((acc, issue) => {
    if (!acc[issue.checkType]) acc[issue.checkType] = [];
    acc[issue.checkType].push(issue);
    return acc;
  }, {});

  // Sort groups: failed groups first, then by number of failures desc
  const sortedGroups = Object.entries(groupedIssues).sort(([, a], [, b]) => {
    const aFailed = a.filter(i => !i.passed).length;
    const bFailed = b.filter(i => !i.passed).length;
    return bFailed - aFailed;
  });

  const failedGroups = sortedGroups.filter(([, issues]) => issues.some(i => !i.passed));
  const passedGroups = sortedGroups.filter(([, issues]) => issues.every(i => i.passed));

  const displayGroups = activeTab === 'ALL'
    ? sortedGroups
    : activeTab === 'FAILED'
      ? failedGroups
      : activeTab === 'PASSED'
        ? passedGroups
        : [];

  const totalFailed = allIssues.filter(i => !i.passed).length;
  const totalPassed = allIssues.filter(i => i.passed).length;

  // Progress percentage for the scan bar
  const totalEstimated = scanProgress ? (scanProgress.crawled + scanProgress.remaining) : 1;
  const progressPct = scanProgress ? Math.round((scanProgress.crawled / totalEstimated) * 100) : 0;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Website"
        message={`Are you sure you want to delete ${deleteTarget}? This will permanently remove all scan history and data.`}
        confirmLabel="Yes, Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {website && (
        <EditWebsiteModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSuccess={() => fetchWebsiteDetails(false)}
          website={{
            id: website.id,
            url: website.url,
            scanFrequency: website.scanFrequency,
            notifyEmails: website.notifyEmails,
            enabledAlerts: website.enabledAlerts,
          }}
        />
      )}

      {/* Crawled Pages Modal */}
      {showPagesModal && (
        <CrawledPagesModal pages={website.pages || []} onClose={() => setShowPagesModal(false)} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{hostname}</h1>
              <a href={website.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer">
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/10 transition-colors"
                title="Website Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <Globe className="h-3 w-3" />
              {website.pages?.length || 0} pages • Scanned {website.scanFrequency.toLowerCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Crawled pages button */}
          {(website.pages?.length || 0) > 0 && (
            <button
              onClick={() => setShowPagesModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-all cursor-pointer"
            >
              <FileSearch className="h-4 w-4" />
              View Crawled Pages ({website.pages.length})
            </button>
          )}
          <Link
            href={`/dashboard/websites/${website.id}/keywords`}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-700 dark:text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
          >
            Keyword Gap
          </Link>
          
          {latestScan && (
            <DynamicPDFDownloadButton 
              websiteUrl={website.url} 
              score={latestScan.overallScore || 0}
              date={new Date(latestScan.completedAt || latestScan.startedAt).toLocaleDateString()}
              issues={latestScan.seoIssues}
            />
          )}

          <button
            onClick={handleScan}
            disabled={isScanning || latestScan?.status === "RUNNING"}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] cursor-pointer"
          >
            {isScanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</> : <><RefreshCw className="h-4 w-4" /> Run Deep Audit</>}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-white/5 border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-all cursor-pointer"
            title="Delete Website"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Live Progress Bar ───────────────────────────────────────────── */}
      {isScanning && scanProgress !== null && (
        <div className="bg-white dark:bg-[#111111] border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Deep Audit in Progress</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{scanProgress.crawled}</span> pages crawled
              {scanProgress.remaining > 0 && <span className="ml-2 text-gray-400">· {scanProgress.remaining} remaining</span>}
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {progressPct < 100
              ? `Crawling site — do not close this tab`
              : "Finalizing results..."}
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Score Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-10">
            <Globe className="w-40 h-40 text-indigo-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Technical Health Score</h3>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-6xl font-black tracking-tight",
              (!latestScan || latestScan.overallScore === null) ? "text-gray-300 dark:text-gray-700" :
              latestScan.overallScore >= 80 ? "text-emerald-500" :
              latestScan.overallScore >= 50 ? "text-yellow-500" : "text-red-500"
            )}>
              {(latestScan && latestScan.overallScore !== null) ? latestScan.overallScore : "--"}
            </span>
            <span className="text-xl text-gray-400 font-medium">/ 100</span>
          </div>
          <div className="mt-6 flex items-center text-xs font-medium text-gray-500 dark:text-gray-400">
            <Calendar className="h-4 w-4 mr-1.5" />
            Last audit: {latestScan?.completedAt ? new Date(latestScan.completedAt).toLocaleString() : "Never"}
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-xl p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-red-900 dark:text-red-400 uppercase tracking-wide">Action Required</h3>
            </div>
            <div className="text-3xl font-black text-red-600 dark:text-red-500 mt-2">{totalFailed}</div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 font-medium">Audits failed or need improvement</p>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-wide">Passed Audits</h3>
            </div>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-500 mt-2">{totalPassed}</div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">Successful technical checks</p>
          </div>
        </div>
      </div>

      {/* ── Score History Chart ──────────────────────────────────────────── */}
      {website.scans && website.scans.length > 1 && (
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Score History</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...website.scans].reverse()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                <XAxis dataKey="completedAt" tickFormatter={val => val ? new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''} stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }} labelFormatter={val => val ? new Date(val as string | number).toLocaleString() : ''} />
                <Line type="monotone" dataKey="overallScore" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#4f46e5' }} activeDot={{ r: 6 }} name="SEO Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Accordion Tech Report ────────────────────────────────────────── */}
      <div
        ref={reportRef}
        className={cn(
          "bg-white dark:bg-[#111111] border rounded-xl overflow-hidden transition-all duration-700",
          justUpdated
            ? "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-500/30"
            : "border-gray-200 dark:border-white/10"
        )}
      >
        {/* Tab bar */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Full Technical Report</h2>
          <div className="flex flex-wrap bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
            {(['ALL', 'FAILED', 'PASSED', 'HISTORY'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  activeTab === tab
                    ? cn("bg-white dark:bg-white/10 shadow-sm",
                        tab === 'FAILED' ? "text-red-600 dark:text-red-400" :
                        tab === 'PASSED' ? "text-emerald-600 dark:text-emerald-400" :
                        "text-indigo-600 dark:text-indigo-400 text-gray-900 dark:text-white")
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                {tab === 'ALL' && `All (${sortedGroups.length})`}
                {tab === 'FAILED' && `Issues (${failedGroups.length})`}
                {tab === 'PASSED' && `Passed (${passedGroups.length})`}
                {tab === 'HISTORY' && `Changes (${website.seoChanges?.length || 0})`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-2">
          {activeTab === 'HISTORY' ? (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {!website.seoChanges || website.seoChanges.length === 0 ? (
                <div className="p-16 text-center">
                  <Info className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No changes detected yet. Run multiple scans to see history.</p>
                </div>
              ) : website.seoChanges.map(change => (
                <div key={change.id} className="p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors flex items-start gap-4 rounded-xl">
                  <div className="mt-1">
                    {change.impact === 'high' ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <Info className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{change.field.toUpperCase()} changed</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      From <span className="font-mono text-xs bg-gray-100 dark:bg-white/10 px-1 rounded">{change.before}</span> to <span className="font-mono text-xs bg-gray-100 dark:bg-white/10 px-1 rounded">{change.after}</span>
                    </p>
                    <p className="text-xs text-gray-400">{new Date(change.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : !latestScan ? (
            <div className="p-16 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Run a technical audit to generate the report.</p>
            </div>
          ) : displayGroups.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">No audits found in this category.</div>
          ) : (
            displayGroups.map(([checkType, issues], i) => (
              <IssueAccordion
                key={checkType}
                checkType={checkType}
                issues={issues}
                defaultOpen={false}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
