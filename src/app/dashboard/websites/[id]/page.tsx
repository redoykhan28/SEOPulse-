"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Globe, RefreshCw, AlertTriangle, 
  CheckCircle2, Info, Loader2, ExternalLink, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

type SeoIssue = {
  id: string;
  checkType: string;
  passed: boolean;
  severity: string;
  details: string;
};

type Scan = {
  id: string;
  status: string;
  overallScore: number | null;
  startedAt: string;
  completedAt: string | null;
  seoIssues: SeoIssue[];
};

type WebsiteDetails = {
  id: string;
  url: string;
  scanFrequency: string;
  scans: Scan[];
};

export default function WebsiteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const websiteId = unwrappedParams.id;
  
  const [website, setWebsite] = useState<WebsiteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");

  const fetchWebsiteDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWebsite(data.website);
    } catch (err) {
      setError("Failed to load website details.");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchWebsiteDetails();
  }, [fetchWebsiteDetails]);

  const handleScan = async () => {
    setIsScanning(true);
    setError("");
    try {
      const res = await fetch(`/api/websites/${websiteId}/scan`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to run scan");
      }
      // Re-fetch details to get the new scan
      await fetchWebsiteDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !website) {
    return (
      <div className="p-8 text-center bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 dark:text-red-400">Error Loading Website</h3>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error || "Website not found"}</p>
        <Link href="/dashboard" className="mt-6 inline-block px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const latestScan = website.scans[0];
  const hostname = new URL(website.url).hostname;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{hostname}</h1>
              <a href={website.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-indigo-500 transition-colors">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{website.url}</p>
          </div>
        </div>
        
        <button
          onClick={handleScan}
          disabled={isScanning || latestScan?.status === "RUNNING"}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)]"
        >
          {isScanning || latestScan?.status === "RUNNING" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
          ) : (
            <><RefreshCw className="h-4 w-4" /> Run New Scan</>
          )}
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-10">
            <Globe className="w-32 h-32 text-indigo-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Overall SEO Score</h3>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-5xl font-black tracking-tight",
              latestScan?.overallScore === null ? "text-gray-300 dark:text-gray-700" :
              latestScan!.overallScore >= 80 ? "text-emerald-500" :
              latestScan!.overallScore >= 50 ? "text-yellow-500" : "text-red-500"
            )}>
              {latestScan?.overallScore !== null ? latestScan.overallScore : "--"}
            </span>
            <span className="text-lg text-gray-400 font-medium">/ 100</span>
          </div>
          <div className="mt-4 flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Last scanned: {latestScan?.completedAt ? new Date(latestScan.completedAt).toLocaleString() : "Never"}
          </div>
        </div>

        <div className="col-span-2 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-6">
           <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Issues Summary</h3>
           {latestScan?.seoIssues ? (
             <div className="grid grid-cols-3 gap-4">
               {['ERROR', 'WARNING', 'INFO'].map(sev => {
                 const count = latestScan.seoIssues.filter(i => (sev === 'ERROR' ? !i.passed && i.severity === 'FAILED' : sev === 'WARNING' ? !i.passed && i.severity === 'WARNING' : i.passed)).length;
                 const colors = {
                   ERROR: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400",
                   WARNING: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
                   INFO: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                 };
                 return (
                   <div key={sev} className={cn("p-4 rounded-lg border flex flex-col items-center justify-center text-center", colors[sev as keyof typeof colors])}>
                     <span className="text-2xl font-bold mb-1">{count}</span>
                     <span className="text-xs font-medium uppercase tracking-wider">{sev === 'ERROR' ? 'Failed Checks' : sev === 'WARNING' ? 'Warnings' : 'Passed'}</span>
                   </div>
                 )
               })}
             </div>
           ) : (
             <div className="h-24 flex items-center justify-center text-sm text-gray-400">No scan data available</div>
           )}
        </div>
      </div>

      {/* Detailed Issues Table */}
      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Scan Results</h2>
        </div>
        
        {!latestScan?.seoIssues || latestScan.seoIssues.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Run a scan to see detailed SEO issues.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {latestScan.seoIssues.map((issue) => (
              <div key={issue.id} className="p-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors flex items-start gap-4">
                <div className="mt-0.5 flex-shrink-0">
                  {issue.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : issue.severity === 'FAILED' ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Info className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    {issue.checkType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{issue.details}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
