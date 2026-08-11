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
  evaluate: ($: cheerio.CheerioAPI) => RuleResult;
}

export const seoRules: SEORule[] = [
  {
    id: 'title_tag',
    name: 'Title Tag',
    evaluate: ($) => {
      const title = $('title').text().trim();
      if (!title) {
        return { passed: false, severity: 'ERROR', details: 'Missing title tag.', weight: 20 };
      }
      if (title.length < 30 || title.length > 60) {
        return { passed: false, severity: 'WARNING', details: `Title length is ${title.length} chars. Optimal is 30-60.`, weight: 10 };
      }
      return { passed: true, severity: 'INFO', details: 'Title tag is optimal.', weight: 20 };
    }
  },
  {
    id: 'meta_description',
    name: 'Meta Description',
    evaluate: ($) => {
      const description = $('meta[name="description"]').attr('content')?.trim();
      if (!description) {
        return { passed: false, severity: 'ERROR', details: 'Missing meta description.', weight: 20 };
      }
      if (description.length < 120 || description.length > 160) {
        return { passed: false, severity: 'WARNING', details: `Description length is ${description.length} chars. Optimal is 120-160.`, weight: 10 };
      }
      return { passed: true, severity: 'INFO', details: 'Meta description is optimal.', weight: 20 };
    }
  },
  {
    id: 'h1_presence',
    name: 'H1 Heading',
    evaluate: ($) => {
      const h1s = $('h1');
      if (h1s.length === 0) {
        return { passed: false, severity: 'ERROR', details: 'No H1 heading found.', weight: 15 };
      }
      if (h1s.length > 1) {
        return { passed: false, severity: 'WARNING', details: 'Multiple H1 headings found.', weight: 5 };
      }
      return { passed: true, severity: 'INFO', details: 'Exactly one H1 heading found.', weight: 15 };
    }
  },
  {
    id: 'image_alt_attributes',
    name: 'Image Alt Attributes',
    evaluate: ($) => {
      const images = $('img');
      if (images.length === 0) {
        return { passed: true, severity: 'INFO', details: 'No images found on page.', weight: 10 };
      }
      
      let missingAltCount = 0;
      images.each((_, el) => {
        const alt = $(el).attr('alt');
        if (alt === undefined || alt === null) {
          missingAltCount++;
        }
      });
      
      if (missingAltCount > 0) {
        return { passed: false, severity: 'WARNING', details: `${missingAltCount} out of ${images.length} images are missing alt attributes.`, weight: 10 };
      }
      return { passed: true, severity: 'INFO', details: 'All images have alt attributes.', weight: 10 };
    }
  }
];
