"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Loader2, Search, Calendar, Globe } from "lucide-react";
import dynamic from "next/dynamic";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

const DynamicPDFDownloadButton = dynamic(
  () => import("@/components/pdf/PDFDownloadButton"),
  { ssr: false }
);

type SeoIssue = {
  id: string;
  checkType: string;
  passed: boolean;
  severity: string;
  details: string;
  page?: { url: string; title: string | null } | null;
};

type Scan = {
  id: string;
  status: string;
  overallScore: number | null;
  startedAt: string;
  completedAt: string | null;
  seoIssues: SeoIssue[];
};

type Website = {
  id: string;
  url: string;
  scans: Scan[];
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-sm text-gray-400">Not scanned</span>;
  const color =
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
      : score >= 50
      ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10"
      : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10";
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-sm font-semibold", color)}>
      {score}
    </span>
  );
}

export default function ReportsPage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchWebsites = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/websites", { cache: "no-store" });
      const data = await res.json();
      // Filter out websites that haven't been scanned yet
      setWebsites((data.websites || []).filter((w: Website) => w.scans.length > 0 && w.scans[0].completedAt));
    } catch {
      console.error("Failed to fetch websites");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  const filtered = websites.filter((w) => w.url.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Download highly detailed PDF technical SEO reports for your clients.
          </p>
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {websites.length} report{websites.length !== 1 ? "s" : ""} available
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="pl-9 pr-4 py-1.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            <table className="w-full">
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : websites.length === 0 ? (
          <div className="p-16 text-center">
            <div className="mx-auto h-16 w-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              No reports available
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Run a Deep Audit on one of your tracked websites to generate its first SEO report.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No reports match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SEO Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Scan Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Download
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((site) => {
                  const latestScan = site.scans[0];
                  if (!latestScan) return null;
                  
                  const hostname = (() => {
                    try { return new URL(site.url).hostname; } catch { return site.url; }
                  })();

                  return (
                    <tr
                      key={site.id}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                              alt=""
                              className="h-5 w-5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {hostname}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">
                              {site.url}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ScoreBadge score={latestScan.overallScore} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="h-4 w-4" />
                          {new Date(latestScan.completedAt!).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end">
                          <DynamicPDFDownloadButton 
                            websiteUrl={site.url}
                            score={latestScan.overallScore || 0}
                            date={new Date(latestScan.completedAt!).toLocaleDateString()}
                            issues={latestScan.seoIssues}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
