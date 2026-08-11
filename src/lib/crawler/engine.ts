import * as cheerio from 'cheerio';
import { seoRules, RuleResult } from './rules';
import { calculateScore } from './scorer';
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

export interface ScanResult {
  overallScore: number;
  pages: CrawledPage[];
}

function normalizeUrl(baseUrl: string, href: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    // Only crawl HTTP/HTTPS
    if (!url.protocol.startsWith('http')) return null;
    // Strip hash and normalize trailing slash for deduplication
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export async function crawlAndScore(startUrl: string, websiteId: string, maxPages: number = 20): Promise<ScanResult> {
  const visited = new Set<string>();
  const queue = [startUrl];
  const pages: CrawledPage[] = [];
  let startUrlObj: URL;
  
  try {
    startUrlObj = new URL(startUrl);
  } catch (e) {
    throw new Error("Invalid start URL");
  }

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift()!;
    const normalizedCurrent = normalizeUrl(startUrl, currentUrl);
    
    if (!normalizedCurrent || visited.has(normalizedCurrent)) {
      continue;
    }
    
    visited.add(normalizedCurrent);
    
    try {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'SEOPulseBot/2.0',
        },
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch ${currentUrl}: ${response.statusText}`);
        continue;
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract Content for Keyword Analysis
      const title = $('title').text().trim() || null;
      const metaDesc = $('meta[name="description"]').attr('content')?.trim() || null;
      const h1 = $('h1').first().text().trim() || null;
      
      // Extract visible text (strip scripts and styles)
      $('script, style, noscript').remove();
      const textContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000) || null; // limit to 10k chars

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

      pages.push({
        url: currentUrl,
        title,
        metaDesc,
        h1,
        textContent,
        results,
        issues
      });

      // Extract internal links to add to queue
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const absoluteUrl = normalizeUrl(startUrl, href);
          if (absoluteUrl) {
            const urlObj = new URL(absoluteUrl);
            // Only add internal links to the same host
            if (urlObj.hostname === startUrlObj.hostname) {
              if (!visited.has(absoluteUrl) && !queue.includes(absoluteUrl)) {
                queue.push(absoluteUrl);
              }
            }
          }
        }
      });

    } catch (error: any) {
      console.warn(`Error crawling ${currentUrl}: ${error.message}`);
    }
  }

  // Calculate overall score (average of all page scores)
  let totalScore = 0;
  for (const page of pages) {
    totalScore += calculateScore(page.results);
  }
  const overallScore = pages.length > 0 ? Math.round(totalScore / pages.length) : 0;

  return {
    overallScore,
    pages,
  };
}
