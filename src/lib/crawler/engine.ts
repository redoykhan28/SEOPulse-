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

// ---------------------------------------------------------------------------
// FIX 1: Smart URL normalization — strips query strings to prevent spider traps
// EXCEPTION 1: Keeps query strings on PHP sites that use them for routing
// EXCEPTION 2: Keeps known pagination params (paged, page, p, pg, start, offset)
// ---------------------------------------------------------------------------

// Query parameters that represent actual different pages (pagination)
// and must be preserved to avoid skipping paginated content
const PAGINATION_PARAMS = new Set([
  'paged',               // WordPress standard pagination
  'page',                // WooCommerce / generic pagination
  'p',                   // WordPress post ID
  'pg',                  // Generic pagination
  'start',               // Some CMSs (Joomla, etc.)
  'offset',              // API-style pagination
  'pagenum',             // Some themes
  'tribe_paged',         // The Events Calendar pagination
  'tribe_event_display', // The Events Calendar views (list, month, day)
]);

// Media and file extensions that should NEVER be crawled as web pages
const IGNORED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
  // Videos / Audio
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mp3', '.wav', '.flac', '.aac',
  // Documents / Files
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  // Assets
  '.css', '.js', '.json', '.xml', '.woff', '.woff2', '.ttf', '.eot'
]);

function normalizeUrl(baseUrl: string, href: string): string | null {
  try {
    const url = new URL(href, baseUrl);

    // Only crawl http/https
    if (!url.protocol.startsWith('http')) return null;

    // Reject non-HTML file extensions
    const pathname = url.pathname.toLowerCase();
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot !== -1) {
      const ext = pathname.substring(lastDot);
      if (IGNORED_EXTENSIONS.has(ext)) return null;
    }

    // Remove fragment (#hash)
    url.hash = '';

    // SMART QUERY STRING HANDLING:
    // If the path itself ends with a known scripting extension, the query
    // string is part of the page identity (e.g. index.php?page=about).
    // For all modern URLs (/blog, /shop, /about), strip query strings,
    // BUT preserve known pagination parameters so we don't skip paginated pages.
    const isLegacyScriptPage = /\.(php|asp|aspx|cfm|cgi|pl|jsp)(\?|$)/i.test(url.pathname);

    if (!isLegacyScriptPage) {
      const paginationEntries: [string, string][] = [];

      // Walk all query params and keep only pagination ones
      url.searchParams.forEach((value, key) => {
        if (PAGINATION_PARAMS.has(key.toLowerCase())) {
          paginationEntries.push([key, value]);
        }
      });

      // Clear all params, then re-add only the pagination ones
      url.search = '';
      for (const [key, value] of paginationEntries) {
        url.searchParams.set(key, value);
      }
    }

    // Remove trailing slash for consistent deduplication
    const normalized = url.href.replace(/\/$/, '');
    return normalized || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Broken Link Checker — checks a single URL via HEAD request with 5s timeout.
// Results are cached in a per-scan Map to avoid redundant network requests.
// Returns the broken URL + status code, or null if the link is healthy.
// ---------------------------------------------------------------------------
async function checkLink(
  url: string,
  cache: Map<string, number | 'timeout' | 'error'>,
): Promise<{ url: string; status: number | string } | null> {
  // Return cached result immediately
  if (cache.has(url)) {
    const cached = cache.get(url)!;
    if (typeof cached === 'number' && cached < 400) return null;
    return { url, status: cached };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let status: number;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'SEOPulseBot/3.0 (+https://seopulse.app)' },
        signal: controller.signal,
        redirect: 'follow',
      });
      status = res.status;
      
      // Fallback to GET if HEAD is rejected by CDNs or unsupported
      if (status === 403 || status === 405 || status === 401 || status === 404 || status === 500) {
        const getRes = await fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': 'SEOPulseBot/3.0 (+https://seopulse.app)' },
          signal: controller.signal,
          redirect: 'follow',
        });
        status = getRes.status;
      }
    } finally {
      clearTimeout(timeout);
    }
    cache.set(url, status);
    return status >= 400 ? { url, status } : null;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      cache.set(url, 'timeout');
      return { url, status: 'timeout (5s)' };
    }
    cache.set(url, 'error');
    return null; // Network error — don't penalise (could be bot block)
  }
}

// ---------------------------------------------------------------------------
// Smart Fetch with JS Detection and Firecrawl Fallback
// ---------------------------------------------------------------------------
async function smartFetch(url: string, controller: AbortController): Promise<string | null> {
  // Step 1: Fast & Free Fetch
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'SEOPulseBot/3.0 (+https://seopulse.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name !== 'AbortError') console.warn(`[Crawler] Network error on ${url}: ${err.message}`);
    return null;
  }

  if (!response.ok) {
    console.warn(`[Crawler] ${response.status} on ${url}`);
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return null;

  const rawHtml = await response.text();
  const $ = cheerio.load(rawHtml);

  // Step 2: JS-Heavy Detection
  const hasSpaMount = $('#root, #__next, #app').length > 0;
  const isBodyEmpty = $('body').text().replace(/\s+/g, '').length < 300;
  const hasNuxt = rawHtml.includes('__NUXT__');
  
  const isJsHeavy = (hasSpaMount && isBodyEmpty) || hasNuxt;

  // Step 3: Route to Firecrawl if JS-heavy and API key exists
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (isJsHeavy && firecrawlKey) {
    try {
      console.log(`[Crawler] JS-Heavy site detected. Routing ${url} to Firecrawl...`);
      // Use a new timeout for Firecrawl since it takes longer
      const fcController = new AbortController();
      const fcTimeout = setTimeout(() => fcController.abort(), 20000); // 20s for Firecrawl
      
      let fcResponse: Response;
      try {
        fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlKey}`,
          },
          body: JSON.stringify({
            url: url,
            formats: ['html'],
          }),
          signal: fcController.signal,
        });
      } finally {
        clearTimeout(fcTimeout);
      }

      if (fcResponse.ok) {
        const fcData = await fcResponse.json();
        if (fcData.success && fcData.data && fcData.data.html) {
           return fcData.data.html; // Return the fully rendered HTML
        }
      }
      
      // If we reach here, Firecrawl failed (e.g. out of credits or 500 error)
      console.warn(`[Crawler] Firecrawl failed (status: ${fcResponse.status}). Falling back to fast fetch for ${url}`);
    } catch (err: any) {
      console.warn(`[Crawler] Firecrawl fetch error: ${err.message}. Falling back to fast fetch for ${url}`);
    }
  }

  // Fallback: return the raw HTML
  return rawHtml;
}

// ---------------------------------------------------------------------------
// FIX 2: Parallel page fetcher with a concurrency limit (default: 5)
// Processes `batch` of URLs simultaneously — safe for shared-hosting targets
// ---------------------------------------------------------------------------
async function crawlBatch(
  urls: string[],
  scanId: string,
  websiteId: string,
  websiteUrl: string,
  startHostname: string,
  visited: Set<string>,
  linkStatusCache: Map<string, number | 'timeout' | 'error'>,
): Promise<string[]> {
  // Returns a list of newly discovered internal URLs from this batch
  const newlyDiscovered: string[] = [];

  await Promise.all(
    urls.map(async (currentUrl) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s per page timeout

        const html = await smartFetch(currentUrl, controller);
        if (!html) return;

        const $ = cheerio.load(html);

        // --- Content Extraction ---
        const title = $('title').text().trim() || null;
        const metaDesc = $('meta[name="description"]').attr('content')?.trim() || null;
        const h1 = $('h1').first().text().trim() || null;

        $('script, style, noscript, svg').remove();
        const textContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000) || null;

        // --- SEO Rules Evaluation ---
        const issues: CrawledPage['issues'] = [];
        for (const rule of seoRules) {
          const result = rule.evaluate($, currentUrl);
          issues.push({
            ruleId: rule.id,
            passed: result.passed,
            severity: result.severity,
            details: result.details,
          });
        }

        // --- Persist to DB ---
        const page = await prisma.page.upsert({
          where: { websiteId_url: { websiteId, url: currentUrl } },
          update: { title, metaDesc, h1, textContent },
          create: { websiteId, url: currentUrl, title, metaDesc, h1, textContent },
        });

        await prisma.seoIssue.createMany({
          data: issues.map(issue => ({
            scanId,
            pageId: page.id,
            checkType: issue.ruleId,
            passed: issue.passed,
            severity: issue.severity === 'ERROR' ? 'FAILED' : 'WARNING',
            details: issue.details,
          })) as any,
        });

        // --- Collect all links for broken-link checking + discovery ---
        const allHrefs: string[] = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          // Skip non-HTTP schemes (mailto, tel, javascript, #hash only)
          if (/^(mailto:|tel:|javascript:|#)/i.test(href.trim())) return;
          const absoluteUrl = normalizeUrl(websiteUrl, href);
          if (absoluteUrl) allHrefs.push(absoluteUrl);
        });

        // --- Discover new internal links ---
        for (const absoluteUrl of allHrefs) {
          try {
            const linkHostname = new URL(absoluteUrl).hostname;
            if (linkHostname === startHostname && !visited.has(absoluteUrl)) {
              newlyDiscovered.push(absoluteUrl);
            }
          } catch { /* ignore malformed URLs */ }
        }

        // --- Check for broken links (HEAD requests, max 25 per page) ---
        const uniqueLinks = [...new Set(allHrefs)];
        // Internal links that are already visited are known-good; skip them.
        // Limit external/unknown links to 25 per page to keep scans fast.
        const linksToCheck = uniqueLinks
          .filter(u => !visited.has(u) || linkStatusCache.has(u))
          .slice(0, 25);

        const brokenResults = (await Promise.all(
          linksToCheck.map(u => checkLink(u, linkStatusCache))
        )).filter(Boolean) as { url: string; status: number | string }[];

        // Save broken_links issue to DB for this page
        const brokenCount = brokenResults.length;
        const brokenDetails = brokenCount > 0
          ? `${brokenCount} broken link(s) found: ${brokenResults.slice(0, 5).map(r => `${r.url} (${r.status})`).join(', ')}${brokenCount > 5 ? ` …and ${brokenCount - 5} more` : ''}`
          : 'No broken links detected on this page.';

        await prisma.seoIssue.create({
          data: {
            scanId,
            pageId: page.id,
            checkType: 'broken_links',
            passed: brokenCount === 0,
            severity: brokenCount > 0 ? 'FAILED' : 'WARNING',
            details: brokenDetails,
          } as any,
        });

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn(`[Crawler] Timeout: ${currentUrl}`);
        } else {
          console.warn(`[Crawler] Error on ${currentUrl}: ${error.message}`);
        }
      }
    })
  );

  return newlyDiscovered;
}

// ---------------------------------------------------------------------------
// Main stateful chunk processor — used by both manual and cron API routes
// ---------------------------------------------------------------------------
export async function processCrawlChunk(
  scanId: string,
  maxChunkSize: number = 20,
  concurrency: number = 5, // FIX 2: parallel workers per batch
): Promise<{
  pagesCrawled: number;
  remainingQueue: number;
  isComplete: boolean;
}> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { website: true },
  });

  if (!scan) throw new Error('Scan not found');

  const startHostname = new URL(scan.website.url).hostname;

  // Restore queue state from DB
  let pendingUrls: string[] = scan.pendingUrls
    ? JSON.parse(scan.pendingUrls)
    : [normalizeUrl(scan.website.url, scan.website.url)!];
  const scannedUrls: string[] = scan.scannedUrls ? JSON.parse(scan.scannedUrls) : [];

  const visited = new Set<string>(scannedUrls);
  const linkStatusCache = new Map<string, number | 'timeout' | 'error'>();
  let pagesCrawledThisChunk = 0;

  // Process URLs in parallel batches of `concurrency` until chunk is full
  while (pendingUrls.length > 0 && pagesCrawledThisChunk < maxChunkSize) {
    // Dequeue the next batch (up to `concurrency` URLs)
    const remaining = maxChunkSize - pagesCrawledThisChunk;
    const batchSize = Math.min(concurrency, pendingUrls.length, remaining);
    const batch: string[] = [];

    // Pull batchSize URLs that haven't been visited yet
    while (batch.length < batchSize && pendingUrls.length > 0) {
      const url = pendingUrls.shift()!;
      if (!visited.has(url)) {
        visited.add(url); // Mark as visited immediately to prevent duplicates
        batch.push(url);
      }
    }

    if (batch.length === 0) continue;

    pagesCrawledThisChunk += batch.length;

    // Crawl this batch in parallel
    const discovered = await crawlBatch(
      batch,
      scan.id,
      scan.websiteId,
      scan.website.url,
      startHostname,
      visited,
      linkStatusCache,
    );

    // Add newly discovered URLs to the queue (deduplicated)
    for (const url of discovered) {
      if (!visited.has(url) && !pendingUrls.includes(url)) {
        pendingUrls.push(url);
      }
    }
  }

  // Deduplicate remaining queue and persist state to DB
  const dedupedPending = [...new Set(pendingUrls)].filter(u => !visited.has(u));
  const isComplete = dedupedPending.length === 0;

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      pendingUrls: JSON.stringify(dedupedPending),
      scannedUrls: JSON.stringify(Array.from(visited)),
    },
  });

  return {
    pagesCrawled: pagesCrawledThisChunk,
    remainingQueue: dedupedPending.length,
    isComplete,
  };
}
