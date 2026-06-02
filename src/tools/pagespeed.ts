import { lemonTool, z } from 'lemon-ai-agent';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface PsiAudit {
  title?: string;
  displayValue?: string;
  score?: number | null;
  description?: string;
}

interface PsiResponse {
  loadingExperience?: {
    metrics?: Record<string, { category?: string; percentile?: number }>;
  };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null; title?: string }>;
    audits?: Record<string, PsiAudit>;
  };
}

function scorePercent(score: number | null | undefined): string {
  if (score == null) return 'n/a';
  return `${Math.round(score * 100)}`;
}

function extractOpportunities(audits: Record<string, PsiAudit> | undefined) {
  if (!audits) return [];

  return Object.entries(audits)
    .filter(([, audit]) => audit.score != null && audit.score < 1)
    .sort((a, b) => (a[1].score ?? 1) - (b[1].score ?? 1))
    .slice(0, 5)
    .map(([id, audit]) => ({
      id,
      title: audit.title,
      displayValue: audit.displayValue,
      score: scorePercent(audit.score),
    }));
}

function extractMetrics(audits: Record<string, PsiAudit> | undefined) {
  const keys = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive',
  ];
  const metrics: Record<string, string> = {};
  for (const key of keys) {
    const audit = audits?.[key];
    if (audit?.displayValue) metrics[key] = audit.displayValue;
  }
  return metrics;
}

function extractCrux(loadingExperience: PsiResponse['loadingExperience']) {
  if (!loadingExperience?.metrics) return null;
  const crux: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadingExperience.metrics)) {
    if (value.category) crux[key] = value.category;
  }
  return Object.keys(crux).length ? crux : null;
}

export function createPagespeedTool(apiKey: string | undefined) {
  return lemonTool({
    name: 'pagespeed_test',
    description:
      'Analyze a website with Google PageSpeed Insights (same backend as pagespeed.web.dev). Returns performance, accessibility, SEO, and best-practices scores.',
    schema: z.object({
      url: z.string().url().describe('URL to analyze'),
      strategy: z
        .enum(['mobile', 'desktop'])
        .optional()
        .describe('Analysis strategy (default: mobile)'),
      categories: z
        .array(z.enum(['performance', 'accessibility', 'seo', 'best-practices']))
        .optional()
        .describe('Categories to analyze (default: all four)'),
    }),
    run: async ({ url, strategy, categories }) => {
      if (!apiKey) {
        return 'Error: GOOGLE_API_KEY is not set. Required for PageSpeed Insights API.';
      }

      const cats = categories ?? [
        'performance',
        'accessibility',
        'seo',
        'best-practices',
      ];

      const endpoint = new URL(PSI_ENDPOINT);
      endpoint.searchParams.set('url', url);
      endpoint.searchParams.set('key', apiKey);
      endpoint.searchParams.set('strategy', strategy ?? 'mobile');
      for (const cat of cats) {
        endpoint.searchParams.append('category', cat);
      }

      const response = await fetch(endpoint.toString());
      if (!response.ok) {
        const body = await response.text();
        return `PageSpeed API error (${response.status}): ${body.slice(0, 500)}`;
      }

      const data = (await response.json()) as PsiResponse;
      const lighthouse = data.lighthouseResult;
      const audits = lighthouse?.audits;

      const summary = {
        url,
        strategy: strategy ?? 'mobile',
        scores: Object.fromEntries(
          Object.entries(lighthouse?.categories ?? {}).map(([key, cat]) => [
            key,
            { title: cat.title, score: scorePercent(cat.score) },
          ]),
        ),
        coreWebVitals: extractMetrics(audits),
        opportunities: extractOpportunities(audits),
        crux: extractCrux(data.loadingExperience),
      };

      return JSON.stringify(summary, null, 2);
    },
  });
}
