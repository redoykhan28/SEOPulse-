"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Globe,
  Plus,
  RefreshCw,
  ExternalLink,
  Loader2,
  Trash2,
  Search,
} from "lucide-react";
import { AddWebsiteModal } from "@/components/AddWebsiteModal";
import { cn } from "@/lib/utils";

type Website = {
  id: string;
  url: string;
  scanFrequency: string;
  createdAt: string;
  scans: Array<{
    id: string;
    status: string;
    overallScore: number | null;
    completedAt: string | null;
  }>;
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

function FrequencyBadge({ freq }: { freq: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
      {freq.charAt(0) + freq.slice(1).toLowerCase()}
    </span>
  );
}

export default function WebsitesPage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const fetchWebsites = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/websites", { cache: "no-store" });
      const data = await res.json();
      setWebsites(data.websites || []);
    } catch {
      console.error("Failed to fetch websites");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  const handleDeleteWebsite = async (id: string, url: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${url}? This action cannot be undone and will delete all scan history.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/websites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete website");
      setWebsites((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      alert("Error deleting website.");
      console.error(err);
    }
  };

  const filtered = websites.filter(
    (w) =>
      w.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Websites
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage and monitor all your tracked websites.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWebsites}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Website
            </button>
          </div>
        </div>

        {/* Website List Card */}
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
          {/* Search + count bar */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {websites.length} site{websites.length !== 1 ? "s" : ""} tracked
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search websites..."
                className="pl-9 pr-4 py-1.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-16 text-center">
              <Loader2 className="mx-auto h-8 w-8 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm text-gray-400">Loading websites...</p>
            </div>
          ) : websites.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto h-16 w-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4">
                <Globe className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                No websites yet
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                Add a website to start monitoring its SEO health, track changes,
                and generate reports.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add your first website
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No websites match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/5">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Website
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      SEO Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Scan
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filtered.map((site) => {
                    const lastScan = site.scans[0];
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
                          <ScoreBadge score={lastScan?.overallScore ?? null} />
                        </td>
                        <td className="px-6 py-4">
                          <FrequencyBadge freq={site.scanFrequency} />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {lastScan?.completedAt
                            ? new Date(lastScan.completedAt).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              title="Open website"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <Link
                              href={`/dashboard/websites/${site.id}`}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer"
                            >
                              View Details
                            </Link>
                            <button
                              onClick={() => handleDeleteWebsite(site.id, site.url)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete website"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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

      <AddWebsiteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchWebsites}
      />
    </>
  );
}
