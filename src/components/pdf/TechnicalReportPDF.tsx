import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register standard fonts
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Inter',
    color: '#111827',
  },
  // Header / Branding
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    borderBottomWidth: 2,
    borderBottomColor: '#4f46e5',
    paddingBottom: 20,
  },
  brand: {
    fontSize: 24,
    fontWeight: 700,
    color: '#4f46e5',
  },
  headerMeta: {
    alignItems: 'flex-end',
  },
  urlText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 10,
    color: '#6b7280',
  },
  
  // Score Section
  scoreSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 30,
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scoreTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 700,
    marginBottom: 10,
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 700,
    color: '#4f46e5',
  },

  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  summaryBox: {
    width: '30%',
    padding: 15,
    borderRadius: 6,
    borderWidth: 1,
  },
  summaryBoxTotal: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  summaryBoxPassed: { borderColor: '#d1fae5', backgroundColor: '#ecfdf5' },
  summaryBoxFailed: { borderColor: '#fee2e2', backgroundColor: '#fef2f2' },
  summaryNumber: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  summaryLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase' },

  // Section Headers
  sectionHeader: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 16,
    marginTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  // Issue Items
  issueCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  issueCardFailed: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  issueCardPassed: {
    borderColor: '#a7f3d0',
    backgroundColor: '#f0fdf4',
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  issueTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  badgeError: { backgroundColor: '#fee2e2', color: '#991b1b' },
  badgeWarning: { backgroundColor: '#fef3c7', color: '#92400e' },
  badgeSuccess: { backgroundColor: '#d1fae5', color: '#065f46' },
  
  issueDetails: {
    fontSize: 10,
    color: '#4b5563',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  pageRef: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Helvetica-Oblique',
  },
  suggestionBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
  },
  suggestionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: '#991b1b',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  suggestionText: {
    fontSize: 10,
    color: '#7f1d1d',
    lineHeight: 1.4,
  }
});

// --- Suggestion Mapping ---
function getSuggestion(ruleId: string): string {
  const suggestions: Record<string, string> = {
    title_tag: "Ensure every page has a <title> tag between 30 and 60 characters long. Include your primary keyword near the beginning.",
    meta_description: "Write a compelling meta description between 120 and 160 characters. It should accurately summarize the page content and encourage click-throughs.",
    h1_presence: "Every page should have exactly one <h1> heading that describes the main topic of the page.",
    canonical_tag: "Include a self-referencing <link rel='canonical' href='...' /> tag in the <head> to prevent duplicate content issues.",
    img_alt_tags: "Add descriptive alt=\"...\" attributes to all images to improve accessibility and image SEO.",
    broken_links: "Update or remove this link. It is returning a 4xx or 5xx error which harms user experience and crawlability.",
    internal_links: "Ensure the page has internal links pointing to other relevant pages on your site to establish site architecture.",
  };
  return suggestions[ruleId] || "Review the failing element and update it to follow SEO best practices.";
}

function formatRuleName(ruleId: string): string {
  return ruleId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

type SeoIssue = {
  id: string;
  checkType: string;
  passed: boolean;
  severity: string;
  details: string;
  page?: { url: string; title: string | null } | null;
};

interface TechnicalReportPDFProps {
  websiteUrl: string;
  score: number;
  date: string;
  issues: SeoIssue[];
}

export function TechnicalReportPDF({ websiteUrl, score, date, issues }: TechnicalReportPDFProps) {
  // Aggregate issues by checkType so the PDF isn't a million pages long.
  // We'll show the check, its status, and sample affected pages.
  
  const groupedIssues = issues.reduce<Record<string, SeoIssue[]>>((acc, issue) => {
    if (!acc[issue.checkType]) acc[issue.checkType] = [];
    acc[issue.checkType].push(issue);
    return acc;
  }, {});

  const allGroups = Object.entries(groupedIssues);
  
  // A group is FAILED if ANY issue in it failed.
  const failedGroups = allGroups.filter(([, issues]) => issues.some(i => !i.passed));
  const passedGroups = allGroups.filter(([, issues]) => issues.every(i => i.passed));

  const totalChecks = allGroups.length;
  const totalFailed = failedGroups.length;
  const totalPassed = passedGroups.length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>SEOPulse</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.urlText}>{websiteUrl}</Text>
            <Text style={styles.dateText}>Scan generated on {date}</Text>
          </View>
        </View>

        {/* Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.scoreTitle}>Technical SEO Score</Text>
          <Text style={styles.scoreValue}>{score}/100</Text>
        </View>

        {/* Summary Grid */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryBox, styles.summaryBoxTotal]}>
            <Text style={[styles.summaryNumber, { color: '#475569' }]}>{totalChecks}</Text>
            <Text style={[styles.summaryLabel, { color: '#64748b' }]}>Total Checks</Text>
          </View>
          <View style={[styles.summaryBox, styles.summaryBoxPassed]}>
            <Text style={[styles.summaryNumber, { color: '#059669' }]}>{totalPassed}</Text>
            <Text style={[styles.summaryLabel, { color: '#10b981' }]}>Passed Audits</Text>
          </View>
          <View style={[styles.summaryBox, styles.summaryBoxFailed]}>
            <Text style={[styles.summaryNumber, { color: '#dc2626' }]}>{totalFailed}</Text>
            <Text style={[styles.summaryLabel, { color: '#ef4444' }]}>Issues Found</Text>
          </View>
        </View>

        {/* Failed Audits */}
        {failedGroups.length > 0 && (
          <View>
            <Text style={styles.sectionHeader}>Issues to Fix</Text>
            {failedGroups.map(([ruleId, groupIssues]) => {
              const failedItems = groupIssues.filter(i => !i.passed);
              const severity = failedItems[0]?.severity || 'WARNING';
              const badgeStyle = severity === 'ERROR' ? styles.badgeError : styles.badgeWarning;
              
              return (
                <View key={ruleId} style={[styles.issueCard, styles.issueCardFailed]} wrap={false}>
                  <View style={styles.issueHeader}>
                    <Text style={styles.issueTitle}>{formatRuleName(ruleId)}</Text>
                    <Text style={[styles.badge, badgeStyle]}>{severity}</Text>
                  </View>
                  
                  <Text style={styles.issueDetails}>
                    Failed on {failedItems.length} page{failedItems.length !== 1 ? 's' : ''}. 
                    Example: {failedItems[0]?.details}
                  </Text>
                  
                  {/* List up to 3 affected pages as examples */}
                  {failedItems.slice(0, 3).map((item, idx) => (
                    item.page ? (
                      <Text key={idx} style={styles.pageRef}>• {item.page.url}</Text>
                    ) : null
                  ))}
                  {failedItems.length > 3 && (
                    <Text style={styles.pageRef}>• ...and {failedItems.length - 3} more</Text>
                  )}

                  <View style={styles.suggestionBox}>
                    <Text style={styles.suggestionTitle}>How to fix it</Text>
                    <Text style={styles.suggestionText}>{getSuggestion(ruleId)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Passed Audits */}
        {passedGroups.length > 0 && (
          <View break={failedGroups.length > 4}>
            <Text style={styles.sectionHeader}>Passed Audits</Text>
            {passedGroups.map(([ruleId]) => (
              <View key={ruleId} style={[styles.issueCard, styles.issueCardPassed]} wrap={false}>
                <View style={styles.issueHeader}>
                  <Text style={styles.issueTitle}>{formatRuleName(ruleId)}</Text>
                  <Text style={[styles.badge, styles.badgeSuccess]}>PASSED</Text>
                </View>
                <Text style={styles.issueDetails}>
                  This check passed successfully across the scanned pages.
                </Text>
              </View>
            ))}
          </View>
        )}

      </Page>
    </Document>
  );
}
