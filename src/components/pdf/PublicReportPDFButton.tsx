"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { SeoReportPDF } from "@/lib/pdf/report";

interface PublicReportPDFButtonProps {
  reportData: any;
}

export default function PublicReportPDFButton({ reportData }: PublicReportPDFButtonProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <button disabled className="flex items-center gap-2 px-4 py-2 bg-indigo-600/50 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing PDF...
      </button>
    );
  }

  const hostname = (() => { try { return new URL(reportData.siteUrl).hostname; } catch { return reportData.siteUrl; } })();

  return (
    <PDFDownloadLink
      document={<SeoReportPDF data={reportData} />}
      fileName={`seopulse-${hostname}-${reportData.month.replace(/\s/g, '-')}.pdf`}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] cursor-pointer"
    >
      {({ loading }) => loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Download className="h-4 w-4" /> Download PDF</>}
    </PDFDownloadLink>
  );
}
