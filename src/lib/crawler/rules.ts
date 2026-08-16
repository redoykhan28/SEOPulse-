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
  // --- SEO CATEGORY ---
  {
    id: 'title_tag',
    name: 'Title Tag',
    category: 'SEO',
    evaluate: ($) => {
      const title = $('title').first().text().trim();
      if (!title) return { passed: false, severity: 'ERROR', details: 'Missing title tag. Every page must have a unique title.', weight: 15 };
      // Google truncates at ~60 chars. Under 10 is too short to be meaningful.
      if (title.length < 10) return { passed: false, severity: 'ERROR', details: `Title "${title}" is too short (${title.length} chars). Minimum recommended is 10.`, weight: 10 };
      if (title.length > 60) return { passed: false, severity: 'WARNING', details: `Title is ${title.length} chars, which may be truncated by Google. Keep it under 60.`, weight: 10 };
      return { passed: true, severity: 'INFO', details: `Title is ${title.length} chars — within the optimal 10-60 range.`, weight: 15 };
    }
  },
  {
    id: 'meta_description',
    name: 'Meta Description',
    category: 'SEO',
    evaluate: ($) => {
      const description = $('meta[name="description"]').attr('content')?.trim();
      if (!description) return { passed: false, severity: 'ERROR', details: 'Missing meta description. This is used by search engines as the page snippet.', weight: 15 };
      if (description.length < 50) return { passed: false, severity: 'WARNING', details: `Description is too short (${description.length} chars). Aim for 120-160 characters.`, weight: 10 };
      if (description.length > 160) return { passed: false, severity: 'WARNING', details: `Description is ${description.length} chars and may be truncated by Google. Keep it under 160.`, weight: 10 };
      return { passed: true, severity: 'INFO', details: `Meta description is ${description.length} chars — within the optimal 120-160 range.`, weight: 15 };
    }
  },
  {
    id: 'h1_presence',
    name: 'H1 Heading',
    category: 'SEO',
    evaluate: ($) => {
      const h1s = $('h1');
      if (h1s.length === 0) return { passed: false, severity: 'ERROR', details: 'No H1 heading found. Every page should have exactly one H1.', weight: 10 };
      if (h1s.length > 1) return { passed: true, severity: 'INFO', details: `Found ${h1s.length} H1 headings. HTML5 allows multiple H1s, but keeping a single main H1 is often recommended for SEO focus.`, weight: 5 };
      const h1Text = h1s.first().text().trim();
      if (!h1Text) return { passed: false, severity: 'WARNING', details: 'H1 tag found but it is empty. Add meaningful text to your H1.', weight: 5 };
      return { passed: true, severity: 'INFO', details: `Exactly one H1 found: "${h1Text.substring(0, 60)}${h1Text.length > 60 ? '...' : ''}"`, weight: 10 };
    }
  },

  // --- TECHNICAL CATEGORY ---
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
    id: 'schema_markup',
    name: 'Schema Markup',
    category: 'Technical',
    evaluate: ($) => {
      const schemas = $('script[type="application/ld+json"]');
      if (schemas.length === 0) return { passed: false, severity: 'WARNING', details: 'No JSON-LD schema markup found. Schema helps Google show rich results (stars, prices, FAQs).', weight: 10 };

      // Validate that each JSON-LD block is parseable and has a @type
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

      // Verify it includes "width=device-width" (bare existence is not enough)
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

  // --- SOCIAL CATEGORY ---
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
      const title = $('meta[name="twitter:title"]').attr('content')?.trim();
      const image = $('meta[name="twitter:image"]').attr('content')?.trim();

      if (!card) return { passed: false, severity: 'WARNING', details: 'Missing twitter:card meta tag. Without it, links shared on Twitter/X show no preview.', weight: 5 };

      const validCards = ['summary', 'summary_large_image', 'app', 'player'];
      if (!validCards.includes(card)) {
        return { passed: false, severity: 'WARNING', details: `twitter:card has an invalid value: "${card}". Valid values: ${validCards.join(', ')}.`, weight: 4 };
      }

      const missing: string[] = [];
      if (!title) missing.push('twitter:title');
      if (!image) missing.push('twitter:image');

      if (missing.length > 0) {
        return { passed: false, severity: 'WARNING', details: `twitter:card is set to "${card}" but missing: ${missing.join(', ')}. Note: These can be inherited from og: tags by Twitter.`, weight: 3 };
      }

      return { passed: true, severity: 'INFO', details: `Twitter Card configured as "${card}" with title and image.`, weight: 5 };
    }
  },

  // --- ACCESSIBILITY CATEGORY ---
  {
    id: 'html_lang',
    name: 'HTML Language Attribute',
    category: 'Accessibility',
    evaluate: ($) => {
      const lang = $('html').attr('lang')?.trim();
      if (!lang) return { passed: false, severity: 'ERROR', details: 'Missing lang attribute on <html> tag. Required by screen readers and Google for language detection.', weight: 5 };
      // Basic check: lang should be at least 2 chars (e.g. "en", "fr", "en-US")
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
        // If ZERO images are found, it might be that images are loaded purely
        // by JS (unlikely on WordPress, but possible). Return a warning instead
        // of a false-positive PASS so the user is aware.
        return {
          passed: false,
          severity: 'WARNING',
          details: 'No images detected. If this page has images, they may be rendered purely by JavaScript (e.g. heavy SPA framework).',
          weight: 5,
        };
      }

      let missingAltCount = 0;
      const missingUrls: string[] = [];

      images.each((_, el) => {
        const alt = $(el).attr('alt');
        // We flag undefined or null as missing alt text.
        // (alt="" is valid for decorative images per accessibility standards)
        if (alt === undefined || alt === null) {
          missingAltCount++;
          // Collect the image URL for a useful error message
          const url =
            $(el).attr('src') ||
            $(el).attr('data-lazy-src') ||
            $(el).attr('data-src') ||
            $(el).attr('data-lazy') ||
            $(el).attr('data-original') ||
            '';
          if (url && missingUrls.length < 5) {
            // Trim long URLs for readability in the UI
            missingUrls.push(url.length > 60 ? url.substring(0, 57) + '...' : url);
          }
        }
      });

      if (missingAltCount > 0) {
        const urlList = missingUrls.length > 0 ? ` Affected: ${missingUrls.join(', ')}` : '';
        return {
          passed: false,
          severity: 'WARNING',
          details: `${missingAltCount} of ${images.length} image(s) are missing alt text (includes lazy-loaded images).${urlList}`,
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
      // Check all meaningful input types
      const inputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select');
      if (inputs.length === 0) return { passed: true, severity: 'INFO', details: 'No form inputs found on this page.', weight: 5 };

      let missingLabelCount = 0;

      inputs.each((_, el) => {
        const id = $(el).attr('id');
        const ariaLabel = $(el).attr('aria-label');
        const ariaLabelledby = $(el).attr('aria-labelledby');
        const titleAttr = $(el).attr('title');
        const placeholder = $(el).attr('placeholder'); // Acceptable as a last resort

        // If any accessible label is present, this input is fine
        if (ariaLabel || ariaLabelledby || titleAttr) return;

        // Check for a <label for="id"> association
        if (id) {
          const label = $(`label[for="${id}"]`);
          if (label.length > 0) return;
        }

        // Check if wrapped in a <label>
        const parentLabel = $(el).closest('label');
        if (parentLabel.length > 0) return;

        // Placeholder-only is not ideal but don't penalise if that's all there is —
        // just count if there's truly nothing at all
        if (!placeholder) {
          missingLabelCount++;
        }
      });

      if (missingLabelCount > 0) return { passed: false, severity: 'WARNING', details: `${missingLabelCount} form input(s) have no label, aria-label, or title attribute. Screen readers cannot identify these fields.`, weight: 5 };
      return { passed: true, severity: 'INFO', details: `All ${inputs.length} form input(s) have accessible labels.`, weight: 5 };
    }
  },
  {
    id: 'empty_links',
    name: 'Descriptive Link Text',
    category: 'Accessibility',
    evaluate: ($) => {
      const links = $('a[href]'); // Only check links that actually go somewhere
      let emptyCount = 0;

      links.each((_, el) => {
        const text = $(el).text().trim();
        const ariaLabel = $(el).attr('aria-label')?.trim();
        const ariaLabelledby = $(el).attr('aria-labelledby')?.trim();
        const title = $(el).attr('title')?.trim();

        // Check if there's an image with an alt attribute inside the link
        // (common pattern for icon links — these ARE accessible)
        const imgWithAlt = $(el).find('img[alt]:not([alt=""])').length > 0;
        const svgWithTitle = $(el).find('title').length > 0; // SVG title element

        if (!text && !ariaLabel && !ariaLabelledby && !title && !imgWithAlt && !svgWithTitle) {
          emptyCount++;
        }
      });

      if (emptyCount > 0) return { passed: false, severity: 'WARNING', details: `${emptyCount} link(s) have no accessible text, aria-label, or labelled image. Screen readers will announce these as "link" with no context.`, weight: 5 };
      return { passed: true, severity: 'INFO', details: `All ${links.length} link(s) have descriptive text or labels.`, weight: 5 };
    }
  }
];
