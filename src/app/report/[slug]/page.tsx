"use client";

import { useState, use } from "react";
import { FileText, Download, Loader2, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamically import PDF components to avoid SSR issues
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then(mod => mod.PDFDownloadLink),
  { ssr: false }
);
const SeoReportPDF = dynamic(
  () => import("@/lib/pdf/report").then(mod => mod.SeoReportPDF),
  { ssr: false }
);

type SeoIssue = { id: string; checkType: string; passed: boolean; severity: string; details: string; };
type ReportData = { siteUrl: string; month: string; overallScore: number; scannedAt: string; issues: SeoIssue[]; };

export default function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch report from API
  useState(() => {
    fetch(`/api/reports/${slug}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setReportData(d.report); })
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false));
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-700 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Report Not Found</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{error || "This report does not exist or has expired."}</p>
        </div>
      </div>
    );
  }

  const hostname = (() => { try { return new URL(reportData.siteUrl).hostname; } catch { return reportData.siteUrl; } })();
  const failed = reportData.issues.filter(i => !i.passed);
  const passed = reportData.issues.filter(i => i.passed);

  const getScoreColor = (s: number) => s >= 80 ? "text-emerald-500" : s >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">⚡ SEOPulse</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Technical SEO Report</h1>
            <div className="flex items-center gap-2 mt-1">
              <a href={reportData.siteUrl} target="_blank" rel="noreferrer" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-500 flex items-center gap-1">
                {hostname} <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{reportData.month}</span>
            </div>
          </div>

          {SeoReportPDF && PDFDownloadLink && (
            <PDFDownloadLink
              document={<SeoReportPDF data={reportData} />}
              fileName={`seopulse-${hostname}-${reportData.month.replace(/\s/g, '-')}.pdf`}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] cursor-pointer"
            >
              {({ loading }) => loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Download className="h-4 w-4" /> Download PDF</>}
            </PDFDownloadLink>
          )}
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Overall Score", value: `${reportData.overallScore}/100`, cls: getScoreColor(reportData.overallScore) },
            { label: "Action Required", value: failed.length, cls: "text-red-500" },
            { label: "Passed Audits", value: passed.length, cls: "text-emerald-500" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-6 text-center">
              <div className={cn("text-3xl font-black mb-1", s.cls)}>{s.value}</div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Failed Section */}
        {failed.length > 0 && (
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-red-50 dark:bg-red-500/5">
              <h2 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">❌ Action Required — {failed.length} Failed Audits</h2>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {failed.map(issue => (
                <div key={issue.id} className="px-6 py-4 flex items-start gap-3 hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-colors">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{issue.checkType.replace(/_/g, " ").toUpperCase()}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{issue.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passed Section */}
        {passed.length > 0 && (
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-emerald-50 dark:bg-emerald-500/5">
              <h2 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">✓ Passed Audits — {passed.length} Checks</h2>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {passed.map(issue => (
                <div key={issue.id} className="px-6 py-4 flex items-start gap-3 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{issue.checkType.replace(/_/g, " ").toUpperCase()}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{issue.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Generated by SEOPulse • {new Date(reportData.scannedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
