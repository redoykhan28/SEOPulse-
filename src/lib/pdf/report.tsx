import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font
} from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2pL7SUc.woff2", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    backgroundColor: "#ffffff",
    padding: 48,
    fontSize: 10,
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: "2px solid #e5e7eb",
  },
  brand: {
    fontSize: 22,
    fontWeight: 700,
    color: "#4f46e5",
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
  },
  reportMeta: {
    textAlign: "right",
  },
  scoreSection: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  scoreCard: {
    flex: 1,
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  scoreNum: {
    fontSize: 40,
    fontWeight: 700,
  },
  scoreLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
    marginTop: 24,
    paddingBottom: 8,
    borderBottom: "1px solid #e5e7eb",
    color: "#111827",
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    padding: 10,
    borderRadius: 6,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
    flexShrink: 0,
  },
  issueText: {
    flex: 1,
  },
  issueName: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 2,
  },
  issueDetail: {
    fontSize: 9,
    color: "#6b7280",
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid #e5e7eb",
    paddingTop: 12,
    color: "#9ca3af",
    fontSize: 8,
  },
});

type SeoIssue = {
  id: string;
  checkType: string;
  passed: boolean;
  severity: string;
  details: string;
};

type ReportData = {
  siteUrl: string;
  month: string;
  overallScore: number;
  scannedAt: string;
  issues: SeoIssue[];
};

function getScoreColor(score: number) {
  if (score >= 80) return "#059669";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function SeoReportPDF({ data }: { data: ReportData }) {
  const passed = data.issues.filter(i => i.passed);
  const failed = data.issues.filter(i => !i.passed);
  const hostname = (() => { try { return new URL(data.siteUrl).hostname; } catch { return data.siteUrl; } })();

  return (
    <Document title={`SEO Report — ${hostname} — ${data.month}`} author="SEOPulse">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>⚡ SEOPulse</Text>
            <Text style={styles.subtitle}>Technical SEO Health Report</Text>
          </View>
          <View style={styles.reportMeta}>
            <Text style={{ fontSize: 13, fontWeight: 700 }}>{hostname}</Text>
            <Text style={{ color: "#6b7280", marginTop: 4 }}>{data.month}</Text>
            <Text style={{ color: "#9ca3af", fontSize: 8, marginTop: 2 }}>Scanned: {new Date(data.scannedAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Score Cards */}
        <View style={styles.scoreSection}>
          <View style={[styles.scoreCard, { backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }]}>
            <Text style={[styles.scoreNum, { color: getScoreColor(data.overallScore) }]}>{data.overallScore}</Text>
            <Text style={styles.scoreLabel}>Overall Score / 100</Text>
          </View>
          <View style={[styles.scoreCard, { backgroundColor: "#fef2f2", border: "1px solid #fee2e2" }]}>
            <Text style={[styles.scoreNum, { color: "#dc2626" }]}>{failed.length}</Text>
            <Text style={styles.scoreLabel}>Action Required</Text>
          </View>
          <View style={[styles.scoreCard, { backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }]}>
            <Text style={[styles.scoreNum, { color: "#059669" }]}>{passed.length}</Text>
            <Text style={styles.scoreLabel}>Audits Passed</Text>
          </View>
        </View>

        {/* Failed Section */}
        {failed.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: "#dc2626" }]}>
              ❌ Failed Audits — Action Required ({failed.length})
            </Text>
            {failed.map((issue, i) => (
              <View key={issue.id} style={[styles.issueRow, { backgroundColor: i % 2 === 0 ? "#fef2f2" : "#fff5f5" }]}>
                <View style={[styles.dot, { backgroundColor: issue.severity === "FAILED" ? "#dc2626" : "#f59e0b" }]} />
                <View style={styles.issueText}>
                  <Text style={styles.issueName}>{issue.checkType.replace(/_/g, " ").toUpperCase()}</Text>
                  <Text style={styles.issueDetail}>{issue.details}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Passed Section */}
        {passed.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: "#059669" }]}>
              ✓ Passed Audits ({passed.length})
            </Text>
            {passed.map((issue, i) => (
              <View key={issue.id} style={[styles.issueRow, { backgroundColor: i % 2 === 0 ? "#f0fdf4" : "#f7fffe" }]}>
                <View style={[styles.dot, { backgroundColor: "#059669" }]} />
                <View style={styles.issueText}>
                  <Text style={styles.issueName}>{issue.checkType.replace(/_/g, " ").toUpperCase()}</Text>
                  <Text style={styles.issueDetail}>{issue.details}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated by SEOPulse • {hostname}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
