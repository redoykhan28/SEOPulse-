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
  evaluate: ($: cheerio.CheerioAPI) => RuleResult;
}

export const seoRules: SEORule[] = [
  // --- SEO CATEGORY ---
  {
    id: 'title_tag',
    name: 'Title Tag',
    category: 'SEO',
    evaluate: ($) => {
      const title = $('title').text().trim();
      if (!title) return { passed: false, severity: 'ERROR', details: 'Missing title tag.', weight: 15 };
      if (title.length < 30 || title.length > 60) return { passed: false, severity: 'WARNING', details: `Title length is ${title.length} chars. Optimal is 30-60.`, weight: 10 };
      return { passed: true, severity: 'INFO', details: 'Title tag is optimal.', weight: 15 };
    }
  },
  {
    id: 'meta_description',
    name: 'Meta Description',
    category: 'SEO',
    evaluate: ($) => {
      const description = $('meta[name="description"]').attr('content')?.trim();
      if (!description) return { passed: false, severity: 'ERROR', details: 'Missing meta description.', weight: 15 };
      if (description.length < 120 || description.length > 160) return { passed: false, severity: 'WARNING', details: `Description length is ${description.length} chars. Optimal is 120-160.`, weight: 10 };
      return { passed: true, severity: 'INFO', details: 'Meta description is optimal.', weight: 15 };
    }
  },
  {
    id: 'h1_presence',
    name: 'H1 Heading',
    category: 'SEO',
    evaluate: ($) => {
      const h1s = $('h1');
      if (h1s.length === 0) return { passed: false, severity: 'ERROR', details: 'No H1 heading found.', weight: 10 };
      if (h1s.length > 1) return { passed: false, severity: 'WARNING', details: 'Multiple H1 headings found.', weight: 5 };
      return { passed: true, severity: 'INFO', details: 'Exactly one H1 heading found.', weight: 10 };
    }
  },

  // --- TECHNICAL CATEGORY ---
  {
    id: 'canonical_tag',
    name: 'Canonical Tag',
    category: 'Technical',
    evaluate: ($) => {
      const canonical = $('link[rel="canonical"]').attr('href');
      if (!canonical) return { passed: false, severity: 'ERROR', details: 'Missing canonical URL to prevent duplicate content.', weight: 10 };
      return { passed: true, severity: 'INFO', details: 'Canonical tag is present.', weight: 10 };
    }
  },
  {
    id: 'schema_markup',
    name: 'Schema Markup',
    category: 'Technical',
    evaluate: ($) => {
      const schema = $('script[type="application/ld+json"]');
      if (schema.length === 0) return { passed: false, severity: 'WARNING', details: 'No JSON-LD schema markup found for rich snippets.', weight: 10 };
      return { passed: true, severity: 'INFO', details: `Found ${schema.length} JSON-LD schema(s).`, weight: 10 };
    }
  },
  {
    id: 'viewport_tag',
    name: 'Mobile Viewport',
    category: 'Technical',
    evaluate: ($) => {
      const viewport = $('meta[name="viewport"]').attr('content');
      if (!viewport) return { passed: false, severity: 'ERROR', details: 'Missing viewport meta tag for mobile responsiveness.', weight: 10 };
      return { passed: true, severity: 'INFO', details: 'Mobile viewport is configured.', weight: 10 };
    }
  },
  {
    id: 'robots_directive',
    name: 'Robots Directives',
    category: 'Technical',
    evaluate: ($) => {
      const robots = $('meta[name="robots"]').attr('content')?.toLowerCase() || '';
      if (robots.includes('noindex')) return { passed: false, severity: 'WARNING', details: 'Page is blocked from indexing (noindex).', weight: 5 };
      return { passed: true, severity: 'INFO', details: 'Page is indexable by search engines.', weight: 5 };
    }
  },

  // --- SOCIAL CATEGORY ---
  {
    id: 'open_graph',
    name: 'Open Graph Tags',
    category: 'Social',
    evaluate: ($) => {
      const ogTitle = $('meta[property="og:title"]').length > 0;
      const ogDesc = $('meta[property="og:description"]').length > 0;
      const ogImage = $('meta[property="og:image"]').length > 0;
      
      const missing = [];
      if (!ogTitle) missing.push('og:title');
      if (!ogDesc) missing.push('og:description');
      if (!ogImage) missing.push('og:image');

      if (missing.length > 0) return { passed: false, severity: 'WARNING', details: `Missing Open Graph tags: ${missing.join(', ')}.`, weight: 8 };
      return { passed: true, severity: 'INFO', details: 'All core Open Graph tags are present.', weight: 8 };
    }
  },
  {
    id: 'twitter_cards',
    name: 'Twitter Cards',
    category: 'Social',
    evaluate: ($) => {
      const card = $('meta[name="twitter:card"]').length > 0;
      if (!card) return { passed: false, severity: 'WARNING', details: 'Missing twitter:card meta tag.', weight: 5 };
      return { passed: true, severity: 'INFO', details: 'Twitter Card is configured.', weight: 5 };
    }
  },

  // --- ACCESSIBILITY CATEGORY ---
  {
    id: 'html_lang',
    name: 'HTML Language Attribute',
    category: 'Accessibility',
    evaluate: ($) => {
      const lang = $('html').attr('lang');
      if (!lang) return { passed: false, severity: 'ERROR', details: 'Missing lang attribute on <html> tag.', weight: 5 };
      return { passed: true, severity: 'INFO', details: `Language is defined as "${lang}".`, weight: 5 };
    }
  },
  {
    id: 'image_alt_attributes',
    name: 'Image Alt Attributes',
    category: 'Accessibility',
    evaluate: ($) => {
      // Select ALL image elements — including those using lazy-load attributes
      // Elementor uses data-lazy-src, WP core uses loading="lazy" + src,
      // lazysizes/other plugins use data-src, data-original, data-lazy.
      // We consider an element an "image" if it has ANY of these attributes.
      const images = $('img, [data-src], [data-lazy-src], [data-lazy], [data-original]');

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
      // Find inputs that aren't hidden/submit and don't have an aria-label
      const inputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([aria-label])');
      if (inputs.length === 0) return { passed: true, severity: 'INFO', details: 'All inputs have accessibility labels.', weight: 5 };

      let missingLabelCount = 0;
      inputs.each((_, el) => {
        const id = $(el).attr('id');
        // Check if there is a corresponding <label for="id">
        if (id) {
          const label = $(`label[for="${id}"]`);
          if (label.length === 0) missingLabelCount++;
        } else {
          // If no ID, it must be wrapped in a <label> to be accessible, but for static analysis we'll just flag it
          const parentLabel = $(el).closest('label');
          if (parentLabel.length === 0) missingLabelCount++;
        }
      });

      if (missingLabelCount > 0) return { passed: false, severity: 'WARNING', details: `${missingLabelCount} form input(s) are missing associated labels.`, weight: 5 };
      return { passed: true, severity: 'INFO', details: 'Form inputs are accessible.', weight: 5 };
    }
  },
  {
    id: 'empty_links',
    name: 'Descriptive Link Text',
    category: 'Accessibility',
    evaluate: ($) => {
      const links = $('a');
      let emptyCount = 0;
      links.each((_, el) => {
        const text = $(el).text().trim();
        const ariaLabel = $(el).attr('aria-label');
        if (!text && !ariaLabel) emptyCount++;
      });

      if (emptyCount > 0) return { passed: false, severity: 'WARNING', details: `${emptyCount} link(s) contain no text or aria-label (empty links).`, weight: 5 };
      return { passed: true, severity: 'INFO', details: 'All links contain descriptive text.', weight: 5 };
    }
  }
];
