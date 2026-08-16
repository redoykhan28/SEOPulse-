import * as cheerio from 'cheerio';

export type RuleSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface RuleResult {
  passed: boolean;
  severity: RuleSeverity;
  details: string;
  weight: number;
}

export interface SEORule {
  id: string;
  name: string;
  category: 'SEO' | 'Technical' | 'Social' | 'Accessibility';
  evaluate: ($: cheerio.CheerioAPI, pageUrl?: string) => RuleResult;
}

// Helper: case-insensitive head meta lookup by name attribute
function getHeadMeta($: cheerio.CheerioAPI, name: string): string | undefined {
  return $('head meta')
    .filter((_, el) => $(el).attr('name')?.toLowerCase() === name.toLowerCase())
    .first()
    .attr('content')
    ?.trim();
}

export const seoRules: SEORule[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // SEO CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'title_tag',
    name: 'Title Tag',
    category: 'SEO',
    evaluate: ($) => {
      // Restrict to <head> only — a <title> in <body> is invalid and ignored by Google
      const title = $('head title').first().text().trim();
      if (!title) return { passed: false, severity: 'ERROR', details: 'Missing title tag. Every page must have a unique title.', weight: 15 };
      if (title.length < 10) return { passed: false, severity: 'ERROR', details: `Title "${title}" is too short (${title.length} chars). Minimum recommended is 10.`, weight: 10 };
      // Google truncates at ~60 chars (pixel-width ~580px)
      if (title.length > 60) return { passed: false, severity: 'WARNING', details: `Title is ${title.length} chars — may be truncated by Google (keep under 60).`, weight: 10 };
      return { passed: true, severity: 'INFO', details: `Title is ${title.length} chars — within the optimal 10–60 range.`, weight: 15 };
    }
  },
  {
    id: 'meta_description',
    name: 'Meta Description',
    category: 'SEO',
    evaluate: ($) => {
      // Case-insensitive lookup scoped to <head> (some CMSes use name="Description")
      const description = getHeadMeta($, 'description');
      if (!description) return { passed: false, severity: 'ERROR', details: 'Missing meta description. This is used by search engines as the page snippet.', weight: 15 };
      if (description.length < 50) return { passed: false, severity: 'WARNING', details: `Meta description is too short (${description.length} chars). Aim for 120–155 characters.`, weight: 10 };
      // Google truncates snippets at ~920px width ≈ 155 characters
      if (description.length > 155) return { passed: false, severity: 'WARNING', details: `Meta description is ${description.length} chars — likely to be truncated by Google. Keep it under 155.`, weight: 10 };
      return { passed: true, severity: 'INFO', details: `Meta description is ${description.length} chars — within the optimal 120–155 range.`, weight: 15 };
    }
  },
  {
    id: 'h1_presence',
    name: 'H1 Heading',
    category: 'SEO',
    evaluate: ($) => {
      // Exclude headings inside <header>, <nav>, <footer> templates that are often hidden
      const h1s = $('h1').filter((_, el) => {
        // Skip H1s inside <script> or <template> tags
        const parent = $(el).closest('script, template, noscript');
        return parent.length === 0;
      });
      if (h1s.length === 0) return { passed: false, severity: 'ERROR', details: 'No H1 heading found. Every page should have exactly one H1.', weight: 10 };
      if (h1s.length > 1) return { passed: true, severity: 'INFO', details: `Found ${h1s.length} H1 headings. HTML5 allows multiple H1s, but a single focused H1 is generally better for SEO.`, weight: 5 };
      const h1Text = h1s.first().text().trim();
      if (!h1Text || h1Text.length < 5) return { passed: false, severity: 'WARNING', details: `H1 tag found but the text "${h1Text}" is too short to be meaningful. Add a descriptive heading.`, weight: 5 };
      return { passed: true, severity: 'INFO', details: `Exactly one H1 found: "${h1Text.substring(0, 60)}${h1Text.length > 60 ? '...' : ''}"`, weight: 10 };
    }
  },
  {
    id: 'heading_hierarchy',
    name: 'Heading Hierarchy',
    category: 'SEO',
    evaluate: ($) => {
      // Exclude headings inside script/template/noscript
      const headings = $('h1, h2, h3, h4, h5, h6')
        .filter((_, el) => $(el).closest('script, template, noscript').length === 0)
        .toArray();
      if (headings.length === 0) return { passed: true, severity: 'INFO', details: 'No headings found on this page.', weight: 3 };

      const skips: string[] = [];
      let prevLevel = 0;

      for (const el of headings) {
        const level = parseInt(el.tagName.replace('h', ''), 10);
        if (prevLevel > 0 && level > prevLevel + 1) {
          const skip = `H${prevLevel} → H${level}`;
          // Deduplicate skip entries
          if (!skips.includes(skip)) skips.push(skip);
        }
        prevLevel = level;
      }

      if (skips.length > 0) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `Heading hierarchy has ${skips.length} skipped level(s): ${skips.slice(0, 3).join(', ')}. Skipping levels (e.g. H1 → H3) disrupts document structure and screen reader navigation.`,
          weight: 5,
        };
      }

      return { passed: true, severity: 'INFO', details: `Heading hierarchy is correct across ${headings.length} heading(s).`, weight: 5 };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TECHNICAL CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'https_usage',
    name: 'HTTPS Security',
    category: 'Technical',
    evaluate: ($, pageUrl) => {
      if (!pageUrl) return { passed: true, severity: 'INFO', details: 'Could not determine page URL to check HTTPS.', weight: 5 };
      try {
        const { protocol } = new URL(pageUrl);
        if (protocol !== 'https:') {
          return {
            passed: false,
            severity: 'ERROR',
            details: `Page is served over HTTP, not HTTPS. Google uses HTTPS as a ranking signal and browsers mark HTTP pages as "Not Secure".`,
            weight: 10,
          };
        }
        return { passed: true, severity: 'INFO', details: 'Page is served securely over HTTPS.', weight: 10 };
      } catch {
        return { passed: true, severity: 'INFO', details: 'Could not parse page URL to verify HTTPS.', weight: 5 };
      }
    }
  },
  {
    id: 'canonical_tag',
    name: 'Canonical Tag',
    category: 'Technical',
    evaluate: ($, pageUrl) => {
      // Canonical must be in <head> — Google ignores body canonicals
      const canonicals = $('head link[rel="canonical"]');

      if (canonicals.length === 0) {
        return { passed: false, severity: 'ERROR', details: 'Missing canonical tag. This can cause duplicate content issues.', weight: 10 };
      }

      // Multiple canonical tags confuse Google — only the first is respected
      if (canonicals.length > 1) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `Found ${canonicals.length} canonical tags. Only one is allowed — Google will ignore all of them if multiple exist.`,
          weight: 9,
        };
      }

      let canonical = canonicals.first().attr('href')?.trim() || '';

      // Resolve relative canonical URLs (e.g. "/about" → "https://example.com/about")
      if (canonical && !canonical.startsWith('http') && pageUrl) {
        try { canonical = new URL(canonical, pageUrl).href; } catch { /* keep original */ }
      }

      if (!canonical) {
        return { passed: false, severity: 'WARNING', details: 'Canonical tag exists but has an empty href.', weight: 8 };
      }

      if (pageUrl) {
        try {
          const canonicalHost = new URL(canonical).hostname;
          const pageHost = new URL(pageUrl).hostname;
          if (canonicalHost !== pageHost) {
            return {
              passed: false,
              severity: 'WARNING',
              details: `Canonical points to a different domain (${canonicalHost}). Verify this cross-domain canonical is intentional.`,
              weight: 8,
            };
          }
        } catch {
          return { passed: false, severity: 'WARNING', details: `Canonical tag has an invalid URL: "${canonical}".`, weight: 8 };
        }
      }

      return { passed: true, severity: 'INFO', details: `Canonical tag is valid: "${canonical.substring(0, 80)}${canonical.length > 80 ? '...' : ''}"`, weight: 10 };
    }
  },
  {
    id: 'favicon',
    name: 'Favicon',
    category: 'Technical',
    evaluate: ($, pageUrl) => {
      // Check all standard favicon declarations in <head>
      const favicon =
        $('head link[rel="icon"]').attr('href') ||
        $('head link[rel="shortcut icon"]').attr('href') ||
        $('head link[rel="apple-touch-icon"]').attr('href') ||
        $('head link[rel="apple-touch-icon-precomposed"]').attr('href') ||
        $('head meta[name="msapplication-TileImage"]').attr('content');

      if (!favicon) {
        // Many sites serve /favicon.ico without declaring it in HTML — note this
        return {
          passed: false,
          severity: 'WARNING',
          details: 'No favicon link tag found in <head>. Note: browsers auto-detect /favicon.ico but declaring it explicitly in HTML is recommended for full cross-browser support.',
          weight: 3,
        };
      }
      return { passed: true, severity: 'INFO', details: `Favicon declared: "${favicon.substring(0, 60)}${favicon.length > 60 ? '...' : ''}"`, weight: 3 };
    }
  },
  {
    id: 'schema_markup',
    name: 'Schema Markup',
    category: 'Technical',
    evaluate: ($) => {
      const schemas = $('script[type="application/ld+json"]');
      if (schemas.length === 0) return { passed: false, severity: 'WARNING', details: 'No JSON-LD schema markup found. Schema helps Google show rich results (stars, prices, FAQs).', weight: 10 };

      let validCount = 0;
      let invalidCount = 0;
      const types: string[] = [];

      schemas.each((_, el) => {
        const rawJson = $(el).html()?.trim() || '';
        try {
          const parsed = JSON.parse(rawJson);
          // Handle both single @type and @graph arrays
          const schemaType =
            parsed['@type'] ||
            (Array.isArray(parsed['@graph'])
              ? parsed['@graph'].map((g: any) => g['@type']).filter(Boolean).join(', ')
              : null);
          if (schemaType) {
            validCount++;
            if (types.length < 3) types.push(String(schemaType));
          } else {
            invalidCount++;
          }
        } catch {
          invalidCount++;
        }
      });

      if (invalidCount > 0 && validCount === 0) {
        return { passed: false, severity: 'WARNING', details: `Found ${schemas.length} JSON-LD block(s) but all contain invalid or unparseable JSON. Fix the schema markup.`, weight: 5 };
      }
      if (invalidCount > 0) {
        return { passed: false, severity: 'WARNING', details: `${invalidCount} of ${schemas.length} JSON-LD block(s) contain invalid JSON. Valid types: ${types.join(', ')}.`, weight: 7 };
      }
      return { passed: true, severity: 'INFO', details: `Found ${validCount} valid JSON-LD schema(s): ${types.join(', ')}.`, weight: 10 };
    }
  },
  {
    id: 'viewport_tag',
    name: 'Mobile Viewport',
    category: 'Technical',
    evaluate: ($) => {
      // Scoped to <head> — viewport in body is ignored by browsers
      const viewport = getHeadMeta($, 'viewport');
      if (!viewport) return { passed: false, severity: 'ERROR', details: 'Missing viewport meta tag. Google uses mobile-first indexing — this is critical.', weight: 10 };

      if (!viewport.includes('width=device-width')) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `Viewport tag found but misconfigured: "${viewport}". Recommended: "width=device-width, initial-scale=1".`,
          weight: 7,
        };
      }

      // user-scalable=no disables pinch-zoom and fails WCAG 1.4.4
      if (viewport.includes('user-scalable=no') || viewport.includes('maximum-scale=1')) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `Viewport disables user zoom ("user-scalable=no" or "maximum-scale=1"). This fails WCAG 1.4.4 and harms usability for visually impaired users.`,
          weight: 6,
        };
      }

      return { passed: true, severity: 'INFO', details: 'Mobile viewport is correctly configured.', weight: 10 };
    }
  },
  {
    id: 'robots_directive',
    name: 'Robots Directives',
    category: 'Technical',
    evaluate: ($) => {
      // Case-insensitive lookup for both "robots" and "Robots"
      const robotsMeta = getHeadMeta($, 'robots')?.toLowerCase() || '';
      const googlebot = getHeadMeta($, 'googlebot')?.toLowerCase() || '';
      const combined = `${robotsMeta} ${googlebot}`;

      // "none" is shorthand for "noindex, nofollow"
      if (combined.includes('noindex') || combined.includes('none')) {
        return { passed: false, severity: 'ERROR', details: 'This page is blocked from Google indexing (noindex/none directive found). If intentional, this is fine — otherwise remove the directive immediately.', weight: 8 };
      }
      if (combined.includes('nofollow')) {
        return { passed: false, severity: 'WARNING', details: 'Robots "nofollow" is set — search engines will not follow links on this page. Verify this is intentional.', weight: 5 };
      }
      if (combined.includes('noarchive')) {
        return { passed: false, severity: 'INFO', details: 'Robots "noarchive" is set — Google will not cache this page. This is usually intentional for dynamic content.', weight: 2 };
      }
      return { passed: true, severity: 'INFO', details: 'Page is fully indexable and crawlable by search engines.', weight: 5 };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SOCIAL CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'open_graph',
    name: 'Open Graph Tags',
    category: 'Social',
    evaluate: ($) => {
      // Use head-scoped property selectors
      const ogTitle = $('head meta[property="og:title"]').attr('content')?.trim();
      const ogDesc = $('head meta[property="og:description"]').attr('content')?.trim();
      const ogImage = $('head meta[property="og:image"]').attr('content')?.trim();
      const ogUrl = $('head meta[property="og:url"]').attr('content')?.trim();
      const ogType = $('head meta[property="og:type"]').attr('content')?.trim();

      const missing: string[] = [];
      const warnings: string[] = [];

      if (!ogTitle) missing.push('og:title');
      else if (ogTitle.length > 90) warnings.push(`og:title is ${ogTitle.length} chars (Facebook trims at ~90)`);

      if (!ogDesc) missing.push('og:description');
      else if (ogDesc.length > 200) warnings.push(`og:description is ${ogDesc.length} chars (may be trimmed)`);

      if (!ogImage) missing.push('og:image');
      if (!ogUrl) missing.push('og:url');
      if (!ogType) warnings.push('og:type is missing (recommended: "website" or "article")');

      if (missing.length > 0) {
        return { passed: false, severity: 'WARNING', details: `Missing Open Graph tags: ${missing.join(', ')}. These control how your page looks when shared on Facebook, LinkedIn, etc.`, weight: 8 };
      }
      if (warnings.length > 0) {
        return { passed: false, severity: 'WARNING', details: `Open Graph tags present but: ${warnings.join('; ')}.`, weight: 5 };
      }
      return { passed: true, severity: 'INFO', details: `All core Open Graph tags (title, description, image, url, type) are present.`, weight: 8 };
    }
  },
  {
    id: 'twitter_cards',
    name: 'Twitter / X Cards',
    category: 'Social',
    evaluate: ($) => {
      const card = $('head meta[name="twitter:card"]').attr('content')?.trim();
      const twitterTitle = $('head meta[name="twitter:title"]').attr('content')?.trim();
      const twitterImage = $('head meta[name="twitter:image"]').attr('content')?.trim();

      // Twitter/X inherits og: tags automatically — check them as valid fallbacks
      const ogTitle = $('head meta[property="og:title"]').attr('content')?.trim();
      const ogImage = $('head meta[property="og:image"]').attr('content')?.trim();

      if (!card) return { passed: false, severity: 'WARNING', details: 'Missing twitter:card meta tag. Without it, links shared on Twitter/X show no rich preview.', weight: 5 };

      const validCards = ['summary', 'summary_large_image', 'app', 'player'];
      if (!validCards.includes(card)) {
        return { passed: false, severity: 'WARNING', details: `twitter:card has an invalid value: "${card}". Valid values: ${validCards.join(', ')}.`, weight: 4 };
      }

      // Only flag missing title/image if BOTH twitter: and og: fallbacks are absent
      const effectiveTitle = twitterTitle || ogTitle;
      const effectiveImage = twitterImage || ogImage;

      const missing: string[] = [];
      if (!effectiveTitle) missing.push('twitter:title (no og:title fallback found)');
      if (!effectiveImage) missing.push('twitter:image (no og:image fallback found)');

      if (missing.length > 0) {
        return { passed: false, severity: 'WARNING', details: `twitter:card is "${card}" but no title/image found: ${missing.join(', ')}.`, weight: 3 };
      }

      const usingFallback = (!twitterTitle && ogTitle) || (!twitterImage && ogImage);
      return { passed: true, severity: 'INFO', details: `Twitter Card "${card}" configured correctly${usingFallback ? ' (using og: tag fallbacks)' : ''}.`, weight: 5 };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ACCESSIBILITY CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'html_lang',
    name: 'HTML Language Attribute',
    category: 'Accessibility',
    evaluate: ($) => {
      const lang = $('html').attr('lang')?.trim();
      if (!lang) return { passed: false, severity: 'ERROR', details: 'Missing lang attribute on <html> tag. Required by screen readers and Google for language detection.', weight: 5 };
      // Validate against basic BCP 47 pattern: 2-3 letter code, optionally with region
      const bcp47Pattern = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;
      if (!bcp47Pattern.test(lang)) {
        return { passed: false, severity: 'WARNING', details: `lang="${lang}" does not look like a valid BCP 47 language code. Use codes like "en", "en-US", "fr", "zh-Hans".`, weight: 3 };
      }
      return { passed: true, severity: 'INFO', details: `Language is declared as "${lang}".`, weight: 5 };
    }
  },
  {
    id: 'image_alt_attributes',
    name: 'Image Alt Attributes',
    category: 'Accessibility',
    evaluate: ($) => {
      // Exclude images inside <template>, <noscript>, <script> — they're not rendered
      const images = $('img').filter((_, el) =>
        $(el).closest('template, noscript, script').length === 0
      );

      if (images.length === 0) {
        return {
          passed: true,
          severity: 'INFO',
          details: 'No rendered <img> tags detected on this page. (CSS background images do not require alt text.)',
          weight: 5,
        };
      }

      let missingAltCount = 0;
      const missingUrls: string[] = [];

      images.each((_, el) => {
        const alt = $(el).attr('alt');
        if (alt === undefined || alt === null || alt.trim() === '') {
          missingAltCount++;
          // Collect src from common lazy-loading attributes
          const url =
            $(el).attr('src') ||
            $(el).attr('data-lazy-src') ||
            $(el).attr('data-src') ||
            $(el).attr('data-lazy') ||
            $(el).attr('data-original') ||
            $(el).attr('data-srcset')?.split(',')[0]?.trim().split(' ')[0] ||
            '';
          if (url && missingUrls.length < 20) {
            missingUrls.push(url);
          }
        }
      });

      if (missingAltCount > 0) {
        const urlList = missingUrls.length > 0 ? ` Affected: ${missingUrls.join('|')}` : '';
        return {
          passed: false,
          severity: 'WARNING',
          details: `${missingAltCount} of ${images.length} image(s) are missing alt text.${urlList}`,
          weight: 10,
        };
      }

      return {
        passed: true,
        severity: 'INFO',
        details: `All ${images.length} rendered image(s) have alt attributes.`,
        weight: 10,
      };
    }
  },
  {
    id: 'form_labels',
    name: 'Form Input Labels',
    category: 'Accessibility',
    evaluate: ($) => {
      const inputs = $(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="range"]):not([type="color"]), textarea, select'
      );
      if (inputs.length === 0) return { passed: true, severity: 'INFO', details: 'No form inputs found on this page.', weight: 5 };

      let missingLabelCount = 0;
      let placeholderOnlyCount = 0;

      inputs.each((_, el) => {
        const id = $(el).attr('id');
        const ariaLabel = $(el).attr('aria-label');
        const ariaLabelledby = $(el).attr('aria-labelledby');
        const titleAttr = $(el).attr('title');
        const placeholder = $(el).attr('placeholder');

        // aria-label, aria-labelledby, or title are all valid accessible labels
        if (ariaLabel || ariaLabelledby || titleAttr) return;

        // <label for="id"> association
        if (id && $(`label[for="${id}"]`).length > 0) return;

        // Input wrapped in <label>
        if ($(el).closest('label').length > 0) return;

        // Only placeholder — not an accessible label
        if (placeholder) {
          placeholderOnlyCount++;
        } else {
          missingLabelCount++;
        }
      });

      if (missingLabelCount > 0) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `${missingLabelCount} input(s) have absolutely no label. Screen readers cannot identify these fields.` +
            (placeholderOnlyCount > 0 ? ` Additionally, ${placeholderOnlyCount} input(s) use placeholder-only labels which disappear on focus.` : ''),
          weight: 5,
        };
      }
      if (placeholderOnlyCount > 0) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `${placeholderOnlyCount} input(s) use placeholder text as their only label. Placeholders disappear when the user starts typing and fail WCAG 1.3.1.`,
          weight: 3,
        };
      }

      return { passed: true, severity: 'INFO', details: `All ${inputs.length} form input(s) have proper accessible labels.`, weight: 5 };
    }
  },
  {
    id: 'empty_links',
    name: 'Descriptive Link Text',
    category: 'Accessibility',
    evaluate: ($) => {
      const links = $('a[href]');
      let emptyCount = 0;

      links.each((_, el) => {
        const text = $(el).text().trim();
        const ariaLabel = $(el).attr('aria-label')?.trim();
        const ariaLabelledby = $(el).attr('aria-labelledby')?.trim();
        const title = $(el).attr('title')?.trim();
        // Image with meaningful alt text inside the link is accessible
        const imgWithAlt = $(el).find('img[alt]').filter((_, img) => ($(img).attr('alt') || '').trim() !== '').length > 0;
        // SVG with a <title> child is accessible
        const svgWithTitle = $(el).find('svg title').length > 0;
        // aria-label on the SVG itself
        const svgWithAriaLabel = $(el).find('svg[aria-label]').length > 0;

        if (!text && !ariaLabel && !ariaLabelledby && !title && !imgWithAlt && !svgWithTitle && !svgWithAriaLabel) {
          emptyCount++;
        }
      });

      if (emptyCount > 0) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `${emptyCount} link(s) have no accessible text, aria-label, title, or labelled image. Screen readers will announce these as "link" with no context.`,
          weight: 5,
        };
      }
      return { passed: true, severity: 'INFO', details: `All ${links.length} link(s) have descriptive text or accessible labels.`, weight: 5 };
    }
  }
];
