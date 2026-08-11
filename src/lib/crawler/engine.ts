import * as cheerio from 'cheerio';
import { seoRules, RuleResult } from './rules';
import { prisma } from '../prisma';

export interface CrawledPage {
  url: string;
  title: string | null;
  metaDesc: string | null;
  h1: string | null;
  textContent: string | null;
  results: Record<string, RuleResult>;
  issues: {
    ruleId: string;
    passed: boolean;
    severity: string;
    details: string;
  }[];
}

function normalizeUrl(baseUrl: string, href: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (!url.protocol.startsWith('http')) return null;
    url.hash = ''; // Remove hash
    return url.href.replace(/\/$/, ''); // Remove trailing slash
  } catch {
    return null;
  }
}

/**
 * Stateful crawler that processes a chunk of URLs from the Scan queue.
 * @param scanId The ID of the Scan in the DB
 * @param maxChunkSize Maximum number of pages to crawl in this invocation
 */
export async function processCrawlChunk(scanId: string, maxChunkSize: number = 20): Promise<{
  pagesCrawled: number;
  remainingQueue: number;
  isComplete: boolean;
}> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { website: true },
  });

  if (!scan) throw new Error("Scan not found");

  const startUrlObj = new URL(scan.website.url);
  
  // Parse queues from DB (defaulting if null)
  let pendingUrls: string[] = scan.pendingUrls ? JSON.parse(scan.pendingUrls) : [normalizeUrl(scan.website.url, scan.website.url)!];
  let scannedUrls: string[] = scan.scannedUrls ? JSON.parse(scan.scannedUrls) : [];
  
  const visited = new Set<string>(scannedUrls);
  let pagesCrawledThisChunk = 0;

  // Process up to maxChunkSize URLs
  while (pendingUrls.length > 0 && pagesCrawledThisChunk < maxChunkSize) {
    const currentUrl = pendingUrls.shift()!;
    
    // Skip if already visited
    if (visited.has(currentUrl)) continue;
    
    visited.add(currentUrl);
    pagesCrawledThisChunk++;

    try {
      const response = await fetch(currentUrl, {
        headers: { 'User-Agent': 'SEOPulseBot/3.0' },
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch ${currentUrl}: ${response.statusText}`);
        continue;
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract Content
      const title = $('title').text().trim() || null;
      const metaDesc = $('meta[name="description"]').attr('content')?.trim() || null;
      const h1 = $('h1').first().text().trim() || null;
      
      $('script, style, noscript').remove();
      const textContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000) || null;

      // Evaluate SEO rules
      const results: Record<string, RuleResult> = {};
      const issues: CrawledPage['issues'] = [];

      for (const rule of seoRules) {
        const result = rule.evaluate($);
        results[rule.id] = result;
        issues.push({
          ruleId: rule.id,
          passed: result.passed,
          severity: result.severity,
          details: result.details,
        });
      }

      // Save the Page to DB
      const page = await prisma.page.upsert({
        where: {
          websiteId_url: { websiteId: scan.websiteId, url: currentUrl },
        },
        update: { title, metaDesc, h1, textContent },
        create: { websiteId: scan.websiteId, url: currentUrl, title, metaDesc, h1, textContent },
      });

      // Save Issues to DB
      await prisma.seoIssue.createMany({
        data: issues.map(issue => ({
          scanId: scan.id,
          pageId: page.id,
          checkType: issue.ruleId,
          passed: issue.passed,
          severity: issue.severity === 'ERROR' ? 'FAILED' : 'WARNING',
          details: issue.details,
        })) as any,
      });

      // Extract new internal links
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const absoluteUrl = normalizeUrl(scan.website.url, href);
          if (absoluteUrl) {
            const urlObj = new URL(absoluteUrl);
            // Only add internal links to the exact same hostname
            if (urlObj.hostname === startUrlObj.hostname) {
              if (!visited.has(absoluteUrl) && !pendingUrls.includes(absoluteUrl)) {
                pendingUrls.push(absoluteUrl);
              }
            }
          }
        }
      });

    } catch (error: any) {
      console.warn(`Error crawling ${currentUrl}: ${error.message}`);
    }
  }

  // Deduplicate and save queues back to DB
  pendingUrls = [...new Set(pendingUrls)].filter(u => !visited.has(u));
  scannedUrls = Array.from(visited);
  const isComplete = pendingUrls.length === 0;

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      pendingUrls: JSON.stringify(pendingUrls),
      scannedUrls: JSON.stringify(scannedUrls),
    },
  });

  return {
    pagesCrawled: pagesCrawledThisChunk,
    remainingQueue: pendingUrls.length,
    isComplete,
  };
}
