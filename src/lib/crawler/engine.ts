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
  cache: Map<string, number | 'timeout' | 'error' | 'soft404'>,
): Promise<{ url: string; status: number | string } | null> {
  // Return cached result immediately
  if (cache.has(url)) {
    const cached = cache.get(url)!;
    if (cached === 'soft404') return { url, status: 'soft 404 (page says "not found")' };
    if (cached === 'timeout' || cached === 'error') return null;
    
    if (typeof cached === 'number') {
      // Mirror the exact same logic as below
      if (isBotBlock(cached)) return null;
      if (cached >= 500) return null;
      if (cached === 404 || cached === 410) return { url, status: cached };
      if (cached >= 400 && cached < 500) return { url, status: cached };
      return null;
    }
  }

  // Status codes that mean the SERVER is actively blocking us, NOT that the page doesn't exist.
  // TripAdvisor -> 403, Marriott -> 429, Paywalled sites -> 402, Auth required -> 401
  // Treat these as "exists but inaccessible" — NOT broken.
  function isBotBlock(status: number): boolean {
    return [401, 402, 403, 429].includes(status);
  }

  // Soft 404 keyword patterns — phrases that appear in the page body/title when a CMS
  // returns 200 OK but is actually showing a "not found" page.
  const SOFT_404_PATTERNS = [
    /page\s+not\s+found/i,
    /404\s*[–—-]\s*(not found|error|page)/i,
    /this\s+page\s+(doesn['']?t|does\s+not)\s+exist/i,
    /the\s+page\s+you\s+(requested|were\s+looking\s+for)\s+(could\s+not\s+be\s+found|doesn['']?t\s+exist)/i,
    /no\s+longer\s+(exists|available)/i,
    /we\s+couldn['']?t\s+find\s+that\s+page/i,
    /sorry,\s+we\s+can['']?t\s+find/i,
    /oops[!,.]?\s+(this\s+page|that\s+page)/i,
    /content\s+not\s+found/i,
    /error\s+404/i,
  ];

  function isSoft404(body: string): boolean {
    // Only check the first 5KB — the error message is always near the top
    const sample = body.slice(0, 5120);
    // Extract just the <title> and <h1> text for more accurate matching
    const titleMatch = sample.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = sample.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const titleText = titleMatch?.[1] || '';
    const h1Text = h1Match?.[1] || '';
    const checkText = `${titleText} ${h1Text} ${sample.slice(0, 2000)}`;
    return SOFT_404_PATTERNS.some(pattern => pattern.test(checkText));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let status: number;
    let getResponse: Response | null = null;

    try {
      // Step 1: Fast HEAD request
      const headRes = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEOPulseBot/3.0; +https://seopulse.app)',
          'Accept': 'text/html,application/xhtml+xml,*/*',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      status = headRes.status;

      // Step 2: If HEAD returns ambiguous/anti-bot code, verify with a real GET
      // (400 Bad Request, 405 Method Not Allowed, 500 Server Error — all could be HEAD-specific rejections)
      if (status === 400 || status === 405 || status === 500) {
        const retryRes = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SEOPulseBot/3.0; +https://seopulse.app)',
            'Accept': 'text/html,application/xhtml+xml,*/*',
          },
          signal: controller.signal,
          redirect: 'follow',
        });
        status = retryRes.status;
        // Keep GET response for soft 404 check below
        if (status >= 200 && status < 300) getResponse = retryRes;
      }

      // Step 3: Soft 404 detection — only on apparent 200 OK responses
      // Some CMSes (WordPress, Shopify, HubSpot) return 200 even when page content says "Not Found"
      if (status >= 200 && status < 300) {
        // If we don't already have a GET body, fetch it now
        if (!getResponse) {
          getResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SEOPulseBot/3.0; +https://seopulse.app)',
              'Accept': 'text/html,application/xhtml+xml,*/*',
            },
            signal: controller.signal,
            redirect: 'follow',
          });
        }

        // Only check HTML responses, skip PDFs, images, JSON, etc.
        const contentType = getResponse.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          const body = await getResponse.text();
          if (isSoft404(body)) {
            cache.set(url, 'soft404');
            return { url, status: 'soft 404 (page says "not found")' };
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    cache.set(url, status);

    // Only flag genuinely broken links:
    // 404 = Page Not Found, 410 = Page Permanently Removed
    // Other 4xx are bot-blocks or auth walls — skip them
    // 5xx are server errors — skip (page may work fine for real users)
    if (isBotBlock(status)) return null; // Active bot block — not broken
    if (status >= 500) return null; // Server errors — not our problem, not a "broken link"
    if (status === 404 || status === 410) return { url, status }; // Genuinely missing pages
    if (status >= 400 && status < 500) return { url, status }; // Other 4xx like 408 timeout
    return null; // 2xx / 3xx — all good
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // A timeout likely means Cloudflare rate-limiting — don't penalise
      cache.set(url, 'timeout');
      return null; // Don't report timeouts as broken — too many false positives
    }
    // ENOTFOUND / ECONNREFUSED = domain doesn't exist = genuinely broken
    const isNetworkError = err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED';
    if (isNetworkError) {
      cache.set(url, 'error');
      return { url, status: 'DNS failure — domain not found' };
    }
    cache.set(url, 'error');
    return null; // Unknown error — benefit of the doubt, don't flag
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
  linkStatusCache: Map<string, number | 'timeout' | 'error' | 'soft404'>,
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

        const $bodyClone = $('body').clone();
        $bodyClone.find('script, style, noscript, svg').remove();
        const textContent = $bodyClone.text().replace(/\s+/g, ' ').trim().substring(0, 10000) || null;

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
// Sitemap fetcher — handles both sitemap indexes and regular sitemaps
// ---------------------------------------------------------------------------
async function fetchSitemapUrls(
  baseUrl: string,
  hostname: string,
  sitemapUrl?: string,
  depth: number = 0,
): Promise<string[]> {
  if (depth > 3) return []; // Prevent infinite recursion
  
  const url = sitemapUrl ?? new URL('/sitemap.xml', baseUrl).href;
  const BOT_UA = 'SEOPulseBot/3.0 (+https://seopulse.app)';

  let text: string;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BOT_UA } });
    if (!res.ok) return [];
    text = await res.text();
  } catch {
    return [];
  }

  const pageUrls: string[] = [];

  // Detect if this is a sitemap INDEX (contains <sitemapindex> or <sitemap> tags)
  const isSitemapIndex = /<sitemapindex/i.test(text);

  if (isSitemapIndex) {
    // Extract child sitemap URLs from <loc> inside <sitemap> blocks
    const childSitemapMatches = [...text.matchAll(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/gi)];
    // Fetch all child sitemaps in parallel
    const childResults = await Promise.all(
      childSitemapMatches.map(m => fetchSitemapUrls(baseUrl, hostname, m[1].trim(), depth + 1))
    );
    for (const urls of childResults) pageUrls.push(...urls);
  } else {
    // Regular sitemap — extract all <loc> page URLs
    const locMatches = [...text.matchAll(/<loc>(.*?)<\/loc>/gi)];
    for (const match of locMatches) {
      const rawUrl = match[1].trim();
      try {
        const parsed = new URL(rawUrl);
        // Only include pages from the same hostname
        if (parsed.hostname === hostname) {
          const normalized = normalizeUrl(baseUrl, rawUrl);
          if (normalized) pageUrls.push(normalized);
        }
      } catch { /* skip malformed URLs */ }
    }
  }

  return [...new Set(pageUrls)]; // deduplicate
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
  
  // Restore organically discovered URLs state
  let discoveredUrls: string[] = (scan as any).discoveredUrls ? JSON.parse((scan as any).discoveredUrls) : [];
  const discoveredSet = new Set<string>(discoveredUrls);

  // If this is the very first run, fetch the sitemap to seed the queue
  if (scannedUrls.length === 0) {
    try {
      const fetchedPageUrls = await fetchSitemapUrls(scan.website.url, startHostname);
      for (const url of fetchedPageUrls) {
        if (!pendingUrls.includes(url)) {
          pendingUrls.push(url);
        }
      }
      console.log(`[Crawler] Seeded ${fetchedPageUrls.length} URLs from sitemap for ${scan.website.url}`);
    } catch (e) {
      console.warn(`[Crawler] Failed to parse sitemap for ${scan.website.url}`);
    }
  }

  const visited = new Set<string>(scannedUrls);
  const linkStatusCache = new Map<string, number | 'timeout' | 'error' | 'soft404'>();
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
      discoveredSet.add(url);
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
      discoveredUrls: JSON.stringify(Array.from(discoveredSet)),
    } as any,
  });

  // ── Post-scan analysis (runs only once, when the crawl is 100% complete) ──
  if (isComplete) {
    const crawledPages = await prisma.page.findMany({
      where: { websiteId: scan.websiteId },
      select: { id: true, url: true, title: true, metaDesc: true },
    });

    const rootUrl = normalizeUrl(scan.website.url, scan.website.url);
    const postScanIssues: any[] = [];

    // ── 1. Orphan Page Detection ──────────────────────────────────────────
    for (const page of crawledPages) {
      if (page.url === rootUrl) continue;
      if (!discoveredSet.has(page.url)) {
        postScanIssues.push({
          scanId: scan.id,
          pageId: page.id,
          checkType: 'orphan_page',
          passed: false,
          severity: 'WARNING',
          details: 'This page was found in the sitemap but is not linked from anywhere on the website (orphan page).',
        });
      }
    }

    // ── 2. Duplicate Title Detection ──────────────────────────────────────
    // Group pages by their normalised title
    const titleMap = new Map<string, string[]>(); // title → [url, ...]
    for (const page of crawledPages) {
      const t = page.title?.trim().toLowerCase();
      if (!t) continue;
      if (!titleMap.has(t)) titleMap.set(t, []);
      titleMap.get(t)!.push(page.url);
    }
    for (const page of crawledPages) {
      const t = page.title?.trim().toLowerCase();
      if (!t) continue;
      const dupes = titleMap.get(t)!;
      if (dupes.length > 1) {
        const others = dupes.filter(u => u !== page.url).slice(0, 3).join(', ');
        postScanIssues.push({
          scanId: scan.id,
          pageId: page.id,
          checkType: 'duplicate_title',
          passed: false,
          severity: 'WARNING',
          details: `Duplicate title tag "${page.title?.substring(0, 60)}" found on ${dupes.length} pages. Also used by: ${others}. Duplicate titles confuse search engines and split ranking signals.`,
        });
      }
    }

    // ── 3. Duplicate Meta Description Detection ───────────────────────────
    const descMap = new Map<string, string[]>(); // desc → [url, ...]
    for (const page of crawledPages) {
      const d = page.metaDesc?.trim().toLowerCase();
      if (!d || d.length < 20) continue; // skip very short/empty descriptions
      if (!descMap.has(d)) descMap.set(d, []);
      descMap.get(d)!.push(page.url);
    }
    for (const page of crawledPages) {
      const d = page.metaDesc?.trim().toLowerCase();
      if (!d || d.length < 20) continue;
      const dupes = descMap.get(d)!;
      if (dupes.length > 1) {
        const others = dupes.filter(u => u !== page.url).slice(0, 3).join(', ');
        postScanIssues.push({
          scanId: scan.id,
          pageId: page.id,
          checkType: 'duplicate_meta_description',
          passed: false,
          severity: 'WARNING',
          details: `Duplicate meta description found on ${dupes.length} pages. Also used by: ${others}. Each page should have a unique, descriptive meta description.`,
        });
      }
    }

    if (postScanIssues.length > 0) {
      await prisma.seoIssue.createMany({ data: postScanIssues });
    }
  }

  return {
    pagesCrawled: pagesCrawledThisChunk,
    remainingQueue: dedupedPending.length,
    isComplete,
  };
}
