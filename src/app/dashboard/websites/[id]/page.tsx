"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Globe, RefreshCw, AlertTriangle, 
  CheckCircle2, Info, Loader2, ExternalLink, Calendar,
  ShieldAlert, ShieldCheck
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
  const [activeTab, setActiveTab] = useState<'ALL' | 'FAILED' | 'PASSED'>('ALL');

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
  
  // Categorize issues
  const failedAudits = latestScan?.seoIssues.filter(i => !i.passed) || [];
  const passedAudits = latestScan?.seoIssues.filter(i => i.passed) || [];

  const displayAudits = activeTab === 'ALL' 
    ? latestScan?.seoIssues || [] 
    : activeTab === 'FAILED' 
      ? failedAudits 
      : passedAudits;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)]"
        >
          {isScanning || latestScan?.status === "RUNNING" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
          ) : (
            <><RefreshCw className="h-4 w-4" /> Run Technical Audit</>
          )}
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-6 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-10">
            <Globe className="w-40 h-40 text-indigo-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Technical Health Score</h3>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-6xl font-black tracking-tight",
              latestScan?.overallScore === null ? "text-gray-300 dark:text-gray-700" :
              latestScan!.overallScore >= 80 ? "text-emerald-500" :
              latestScan!.overallScore >= 50 ? "text-yellow-500" : "text-red-500"
            )}>
              {latestScan?.overallScore !== null ? latestScan.overallScore : "--"}
            </span>
            <span className="text-xl text-gray-400 font-medium">/ 100</span>
          </div>
          <div className="mt-6 flex items-center text-xs font-medium text-gray-500 dark:text-gray-400">
            <Calendar className="h-4 w-4 mr-1.5" />
            Last audit: {latestScan?.completedAt ? new Date(latestScan.completedAt).toLocaleString() : "Never"}
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 grid grid-cols-2 gap-4">
           {/* Failed Overview */}
           <div className="bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-xl p-6 flex flex-col justify-center">
             <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                 <ShieldAlert className="h-5 w-5" />
               </div>
               <h3 className="text-sm font-bold text-red-900 dark:text-red-400 uppercase tracking-wide">Action Required</h3>
             </div>
             <div className="text-3xl font-black text-red-600 dark:text-red-500 mt-2">{failedAudits.length}</div>
             <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 font-medium">Audits failed or need improvement</p>
           </div>
           
           {/* Passed Overview */}
           <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-6 flex flex-col justify-center">
             <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                 <ShieldCheck className="h-5 w-5" />
               </div>
               <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-wide">Passed Audits</h3>
             </div>
             <div className="text-3xl font-black text-emerald-600 dark:text-emerald-500 mt-2">{passedAudits.length}</div>
             <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">Successful technical checks</p>
           </div>
        </div>
      </div>

      {/* Detailed Rich Report */}
      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="px-2 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white px-4 sm:px-0">Full Technical Report</h2>
          
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-lg mx-4 sm:mx-0">
            <button 
              onClick={() => setActiveTab('ALL')}
              className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === 'ALL' ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}
            >
              All ({latestScan?.seoIssues?.length || 0})
            </button>
            <button 
              onClick={() => setActiveTab('FAILED')}
              className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === 'FAILED' ? "bg-white dark:bg-white/10 text-red-600 dark:text-red-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}
            >
              Issues ({failedAudits.length})
            </button>
            <button 
              onClick={() => setActiveTab('PASSED')}
              className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === 'PASSED' ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}
            >
              Passed ({passedAudits.length})
            </button>
          </div>
        </div>
        
        {!latestScan?.seoIssues || latestScan.seoIssues.length === 0 ? (
          <div className="p-16 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Run a technical audit to generate the report.</p>
          </div>
        ) : displayAudits.length === 0 ? (
           <div className="p-12 text-center text-gray-500 dark:text-gray-400">
             No audits found in this category.
           </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {displayAudits.map((issue) => (
              <div key={issue.id} className={cn(
                "p-5 sm:px-6 transition-colors flex flex-col sm:flex-row items-start gap-4",
                !issue.passed ? "bg-red-50/30 hover:bg-red-50/60 dark:bg-red-500/5 dark:hover:bg-red-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              )}>
                <div className="mt-0.5 flex-shrink-0">
                  {issue.passed ? (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : issue.severity === 'FAILED' ? (
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                      <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                    <h4 className={cn(
                      "text-sm font-bold tracking-tight",
                      !issue.passed ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                    )}>
                      {issue.checkType.replace(/_/g, ' ').toUpperCase()}
                    </h4>
                    {!issue.passed && (
                       <span className={cn(
                         "inline-flex self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                         issue.severity === 'FAILED' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400"
                       )}>
                         {issue.severity === 'FAILED' ? 'Error' : 'Warning'}
                       </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-sm leading-relaxed",
                    !issue.passed ? "text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"
                  )}>
                    {issue.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
