"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { TechnicalReportPDF } from "./TechnicalReportPDF";
import type { SeoIssue } from "@/app/dashboard/websites/[id]/page"; // Ensure we have a compatible type or just use any for now if strict typing fails

interface PDFDownloadButtonProps {
  websiteUrl: string;
  score: number;
  date: string;
  issues: any[];
}

export default function PDFDownloadButton({ websiteUrl, score, date, issues }: PDFDownloadButtonProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <button disabled className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-700 dark:text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing PDF...
      </button>
    );
  }

  const hostname = (() => { try { return new URL(websiteUrl).hostname; } catch { return websiteUrl; } })();
  const fileName = `${hostname}-seo-report.pdf`;

  return (
    <PDFDownloadLink
      document={<TechnicalReportPDF websiteUrl={websiteUrl} score={score} date={date} issues={issues} />}
      fileName={fileName}
      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-700 dark:text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
    >
      {({ loading }) => (
        <>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {loading ? "Preparing PDF..." : "Download PDF Report"}
        </>
      )}
    </PDFDownloadLink>
  );
}
