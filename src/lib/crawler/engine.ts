import * as cheerio from 'cheerio';
import { seoRules, RuleResult } from './rules';
import { calculateScore } from './scorer';
import { prisma } from '../prisma';

export interface ScanResult {
  overallScore: number;
  issues: {
    ruleId: string;
    passed: boolean;
    severity: string;
    details: string;
  }[];
}

export async function crawlAndScore(url: string, websiteId: string): Promise<ScanResult> {
  // Fetch HTML
  let html = '';
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SEOPulseBot/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    html = await response.text();
  } catch (error: any) {
    throw new Error(`Failed to crawl URL: ${error.message}`);
  }

  // Parse HTML
  const $ = cheerio.load(html);

  // Evaluate rules
  const results: Record<string, RuleResult> = {};
  const issues: ScanResult['issues'] = [];

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

  // Calculate overall score
  const overallScore = calculateScore(results);

  return {
    overallScore,
    issues,
  };
}
