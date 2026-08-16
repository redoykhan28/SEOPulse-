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

export const seoRules: SEORule[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // SEO CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'title_tag',
    name: 'Title Tag',
    category: 'SEO',
    evaluate: ($) => {
      const title = $('head title').first().text().trim();
      if (!title) return { passed: false, severity: 'ERROR', details: 'Missing title tag. Every page must have a unique title.', weight: 15 };
      if (title.length < 10) return { passed: false, severity: 'ERROR', details: `Title "${title}" is too short (${title.length} chars). Minimum recommended is 10.`, weight: 10 };
      // Google truncates at ~60 chars (pixel-width ~580px). 58 is the safest hard limit.
      if (title.length > 60) return { passed: false, severity: 'WARNING', details: `Title is ${title.length} chars — may be truncated by Google (keep under 60).`, weight: 10 };
      return { passed: true, severity: 'INFO', details: `Title is ${title.length} chars — within the optimal 10–60 range.`, weight: 15 };
    }
  },
  {
    id: 'meta_description',
    name: 'Meta Description',
    category: 'SEO',
    evaluate: ($) => {
      const description = $('meta[name="description"]').attr('content')?.trim();
      if (!description) return { passed: false, severity: 'ERROR', details: 'Missing meta description. This is used by search engines as the page snippet.', weight: 15 };
      if (description.length < 50) return { passed: false, severity: 'WARNING', details: `Meta description is too short (${description.length} chars). Aim for 120–155 characters.`, weight: 10 };
      // Google truncates snippets at ~920px width, which corresponds to ~155 characters.
      if (description.length > 155) return { passed: false, severity: 'WARNING', details: `Meta description is ${description.length} chars — likely to be truncated by Google. Keep it under 155.`, weight: 10 };
      return { passed: true, severity: 'INFO', details: `Meta description is ${description.length} chars — within the optimal 120–155 range.`, weight: 15 };
    }
  },
  {
    id: 'h1_presence',
    name: 'H1 Heading',
    category: 'SEO',
    evaluate: ($) => {
      const h1s = $('h1');
      if (h1s.length === 0) return { passed: false, severity: 'ERROR', details: 'No H1 heading found. Every page should have exactly one H1.', weight: 10 };
      if (h1s.length > 1) return { passed: true, severity: 'INFO', details: `Found ${h1s.length} H1 headings. HTML5 allows multiple H1s, but a single, focused H1 is generally better for SEO.`, weight: 5 };
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
      // Walk through headings in DOM order and detect skipped levels
      const headings = $('h1, h2, h3, h4, h5, h6').toArray();
      if (headings.length === 0) return { passed: true, severity: 'INFO', details: 'No headings found on this page.', weight: 3 };

      const skips: string[] = [];
      let prevLevel = 0;

      for (const el of headings) {
        const level = parseInt(el.tagName.replace('h', ''), 10);
        // A jump of more than 1 level (e.g. H1 → H3) is a hierarchy violation
        if (prevLevel > 0 && level > prevLevel + 1) {
          skips.push(`H${prevLevel} → H${level}`);
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
        const protocol = new URL(pageUrl).protocol;
        if (protocol !== 'https:') {
          return {
            passed: false,
            severity: 'ERROR',
            details: `Page is served over HTTP (${protocol}), not HTTPS. Google uses HTTPS as a ranking signal and browsers mark HTTP pages as "Not Secure".`,
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
      const canonical = $('link[rel="canonical"]').attr('href')?.trim();
      if (!canonical) return { passed: false, severity: 'ERROR', details: 'Missing canonical tag. This can cause duplicate content penalties.', weight: 10 };

      // Check for obviously wrong canonical (points to a completely different domain)
      if (pageUrl) {
        try {
          const canonicalHost = new URL(canonical).hostname;
          const pageHost = new URL(pageUrl).hostname;
          if (canonicalHost !== pageHost) {
            return {
              passed: false,
              severity: 'WARNING',
              details: `Canonical tag points to a different domain (${canonicalHost}) than the current page (${pageHost}). Verify this is intentional.`,
              weight: 8,
            };
          }
        } catch {
          return { passed: false, severity: 'WARNING', details: `Canonical tag has an invalid URL: "${canonical}".`, weight: 8 };
        }
      }

      return { passed: true, severity: 'INFO', details: `Canonical tag is present: "${canonical.substring(0, 60)}${canonical.length > 60 ? '...' : ''}"`, weight: 10 };
    }
  },
  {
    id: 'favicon',
    name: 'Favicon',
    category: 'Technical',
    evaluate: ($) => {
      const favicon =
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="apple-touch-icon"]').attr('href');

      if (!favicon) {
        return {
          passed: false,
          severity: 'WARNING',
          details: 'No favicon found. A favicon improves brand recognition in browser tabs, bookmarks, and search results.',
          weight: 3,
        };
      }
      return { passed: true, severity: 'INFO', details: `Favicon detected: "${favicon.substring(0, 60)}${favicon.length > 60 ? '...' : ''}"`, weight: 3 };
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
          const schemaType = parsed['@type'] || (Array.isArray(parsed['@graph']) ? parsed['@graph'].map((g: any) => g['@type']).join(', ') : null);
          if (schemaType) {
            validCount++;
            if (types.length < 3) types.push(schemaType);
          } else {
            invalidCount++;
          }
        } catch {
          invalidCount++;
        }
      });

      if (invalidCount > 0 && validCount === 0) {
        return { passed: false, severity: 'WARNING', details: `Found ${schemas.length} JSON-LD block(s) but they contain invalid or empty JSON. Fix the schema markup.`, weight: 5 };
      }
      if (invalidCount > 0) {
        return { passed: false, severity: 'WARNING', details: `${invalidCount} of ${schemas.length} JSON-LD block(s) contain invalid JSON. Valid types found: ${types.join(', ')}.`, weight: 7 };
      }
      return { passed: true, severity: 'INFO', details: `Found ${validCount} valid JSON-LD schema(s): ${types.join(', ')}.`, weight: 10 };
    }
  },
  {
    id: 'viewport_tag',
    name: 'Mobile Viewport',
    category: 'Technical',
    evaluate: ($) => {
      const viewport = $('meta[name="viewport"]').attr('content')?.trim();
      if (!viewport) return { passed: false, severity: 'ERROR', details: 'Missing viewport meta tag. Google uses mobile-first indexing — this is critical.', weight: 10 };

      if (!viewport.includes('width=device-width')) {
        return {
          passed: false,
          severity: 'WARNING',
          details: `Viewport tag found but may be misconfigured: "${viewport}". Recommended: "width=device-width, initial-scale=1".`,
          weight: 7,
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
      const robotsMeta = $('meta[name="robots"]').attr('content')?.toLowerCase() || '';
      const googlebot = $('meta[name="googlebot"]').attr('content')?.toLowerCase() || '';
      const combined = `${robotsMeta} ${googlebot}`;

      if (combined.includes('noindex')) {
        return { passed: false, severity: 'ERROR', details: 'This page is blocked from Google indexing (noindex). If intentional, this is fine. Otherwise, remove the noindex directive immediately.', weight: 8 };
      }
      if (combined.includes('nofollow')) {
        return { passed: false, severity: 'WARNING', details: 'Robots nofollow is set — search engines will not follow links on this page. Verify this is intentional.', weight: 5 };
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
      const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
      const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
      const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
      const ogUrl = $('meta[property="og:url"]').attr('content')?.trim();

      const missing: string[] = [];
      const warnings: string[] = [];

      if (!ogTitle) missing.push('og:title');
      else if (ogTitle.length > 90) warnings.push(`og:title is ${ogTitle.length} chars (Facebook trims at ~90)`);

      if (!ogDesc) missing.push('og:description');
      else if (ogDesc.length > 200) warnings.push(`og:description is ${ogDesc.length} chars (may be trimmed)`);

      if (!ogImage) missing.push('og:image');
      if (!ogUrl) missing.push('og:url');

      if (missing.length > 0) {
        return { passed: false, severity: 'WARNING', details: `Missing Open Graph tags: ${missing.join(', ')}. These control how your page looks when shared on Facebook, LinkedIn, etc.`, weight: 8 };
      }
      if (warnings.length > 0) {
        return { passed: false, severity: 'WARNING', details: `Open Graph tags present but: ${warnings.join('; ')}.`, weight: 5 };
      }
      return { passed: true, severity: 'INFO', details: 'All core Open Graph tags (title, description, image, url) are present and look good.', weight: 8 };
    }
  },
  {
    id: 'twitter_cards',
    name: 'Twitter / X Cards',
    category: 'Social',
    evaluate: ($) => {
      const card = $('meta[name="twitter:card"]').attr('content')?.trim();
      const twitterTitle = $('meta[name="twitter:title"]').attr('content')?.trim();
      const twitterImage = $('meta[name="twitter:image"]').attr('content')?.trim();

      // Twitter/X falls back to og: tags automatically, so check OG as fallback
      const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
      const ogImage = $('meta[property="og:image"]').attr('content')?.trim();

      if (!card) return { passed: false, severity: 'WARNING', details: 'Missing twitter:card meta tag. Without it, links shared on Twitter/X show no rich preview.', weight: 5 };

      const validCards = ['summary', 'summary_large_image', 'app', 'player'];
      if (!validCards.includes(card)) {
        return { passed: false, severity: 'WARNING', details: `twitter:card has an invalid value: "${card}". Valid values: ${validCards.join(', ')}.`, weight: 4 };
      }

      // Only flag if BOTH twitter: and og: fallbacks are missing
      const effectiveTitle = twitterTitle || ogTitle;
      const effectiveImage = twitterImage || ogImage;

      const missing: string[] = [];
      if (!effectiveTitle) missing.push('twitter:title (no og:title fallback either)');
      if (!effectiveImage) missing.push('twitter:image (no og:image fallback either)');

      if (missing.length > 0) {
        return { passed: false, severity: 'WARNING', details: `twitter:card is "${card}" but no title/image found (checked twitter: and og: tags): ${missing.join(', ')}.`, weight: 3 };
      }

      const source = (!twitterTitle && ogTitle) ? ' (using og: tag fallbacks)' : '';
      return { passed: true, severity: 'INFO', details: `Twitter Card configured as "${card}" with title and image${source}.`, weight: 5 };
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
      if (lang.length < 2) return { passed: false, severity: 'WARNING', details: `lang attribute "${lang}" appears invalid. Use a standard language code like "en" or "en-US".`, weight: 3 };
      return { passed: true, severity: 'INFO', details: `Language is declared as "${lang}".`, weight: 5 };
    }
  },
  {
    id: 'image_alt_attributes',
    name: 'Image Alt Attributes',
    category: 'Accessibility',
    evaluate: ($) => {
      // Select only actual image elements to avoid false positives on divs
      const images = $('img');

      if (images.length === 0) {
        return {
          passed: true,
          severity: 'INFO',
          details: 'No standard <img> tags detected on this page. (Background images or CSS images do not require alt text).',
          weight: 5,
        };
      }

      let missingAltCount = 0;
      const missingUrls: string[] = [];

      images.each((_, el) => {
        const alt = $(el).attr('alt');
        // Flag undefined, null, OR empty string — all are missed SEO opportunities
        if (alt === undefined || alt === null || alt.trim() === '') {
          missingAltCount++;
          const url =
            $(el).attr('src') ||
            $(el).attr('data-lazy-src') ||
            $(el).attr('data-src') ||
            $(el).attr('data-lazy') ||
            $(el).attr('data-original') ||
            '';
          if (url && missingUrls.length < 5) {
            missingUrls.push(url.length > 60 ? url.substring(0, 57) + '...' : url);
          }
        }
      });

      if (missingAltCount > 0) {
        const urlList = missingUrls.length > 0 ? ` Affected images: ${missingUrls.join(', ')}` : '';
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
        details: `All ${images.length} image(s) have alt attributes (including lazy-loaded images).`,
        weight: 10,
      };
    }
  },
  {
    id: 'form_labels',
    name: 'Form Input Labels',
    category: 'Accessibility',
    evaluate: ($) => {
      const inputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select');
      if (inputs.length === 0) return { passed: true, severity: 'INFO', details: 'No form inputs found on this page.', weight: 5 };

      let missingLabelCount = 0;
      let placeholderOnlyCount = 0;

      inputs.each((_, el) => {
        const id = $(el).attr('id');
        const ariaLabel = $(el).attr('aria-label');
        const ariaLabelledby = $(el).attr('aria-labelledby');
        const titleAttr = $(el).attr('title');
        const placeholder = $(el).attr('placeholder');

        if (ariaLabel || ariaLabelledby || titleAttr) return;

        if (id) {
          const label = $(`label[for="${id}"]`);
          if (label.length > 0) return;
        }

        const parentLabel = $(el).closest('label');
        if (parentLabel.length > 0) return;

        // Placeholder-only is NOT a proper accessible label — flag it
        if (placeholder) {
          placeholderOnlyCount++;
        } else {
          missingLabelCount++;
        }
      });

      if (missingLabelCount > 0) return {
        passed: false,
        severity: 'WARNING',
        details: `${missingLabelCount} input(s) have no label at all. Screen readers cannot identify these fields.${placeholderOnlyCount > 0 ? ` Also, ${placeholderOnlyCount} input(s) rely on placeholder text only — placeholders disappear on focus and are not accessible.` : ''}`,
        weight: 5,
      };

      if (placeholderOnlyCount > 0) return {
        passed: false,
        severity: 'WARNING',
        details: `${placeholderOnlyCount} input(s) use placeholder text as their only label. Placeholders disappear when the user starts typing and fail WCAG accessibility standards.`,
        weight: 3,
      };

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
        const imgWithAlt = $(el).find('img[alt]:not([alt=""])').length > 0;
        const svgWithTitle = $(el).find('title').length > 0;

        if (!text && !ariaLabel && !ariaLabelledby && !title && !imgWithAlt && !svgWithTitle) {
          emptyCount++;
        }
      });

      if (emptyCount > 0) return {
        passed: false,
        severity: 'WARNING',
        // Cap at top 10 to avoid flooding the report
        details: `${emptyCount} link(s) have no accessible text, aria-label, or labelled image. Screen readers will announce these as "link" with no context.`,
        weight: 5,
      };
      return { passed: true, severity: 'INFO', details: `All ${links.length} link(s) have descriptive text or labels.`, weight: 5 };
    }
  }
];
