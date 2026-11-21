import { FunctionDeclaration, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { AssistantToolCallLog } from '../src/types/zura.ts';
import { conversionService } from './conversionService.ts';

const ZURA_TOOLS: FunctionDeclaration[] = [
  {
    name: 'checkConnectionAndReadiness',
    description:
      'Inspect Google Data Manager connection, website Google Tag / GTM Enhanced Conversions for Leads setup, and which funnel stages (Qualified, Quote Accepted, Completed Sale) are set to Primary Bidding vs Secondary Observation.',
  },
  {
    name: 'suggestApiPayloadMappings',
    description:
      'Inspect incoming Zura API JSON field names only (never raw customer rows) and suggest mappings to canonical Google conversion fields (leadId, email, phone, gclid, eventTime, timezone, value, currency, consentStatus, stage).',
  },
  {
    name: 'previewValidationErrors',
    description:
      'Return counts of ready vs blocked events and explain anonymized issues (missing contact info, >90-day expiry gap, invalid timestamps, duplicate IDs, consent denied) without exposing raw emails or phones.',
  },
  {
    name: 'explainGoogleDiagnostics',
    description:
      'Inspect recent Google Data Manager results and explain Submitted vs Processed vs Attributed counts, Enhanced Conversions for Leads match rate, 90-day limits, and signal volume.',
  },
  {
    name: 'proposeSchedule',
    description:
      'Analyze API event volume and recommend Hourly (default so deals stay inside the 90-day window), Daily, or Monthly sync.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        businessUpdatePattern: {
          type: Type.STRING,
          description:
            'How often the sales team updates CRM outcomes (e.g. realtime_crm_api, daily_batch, monthly_reconciliation).',
        },
      },
    },
  },
  {
    name: 'summarizeUploadHealth',
    description:
      'Summarize overall revenue attribution health: how many signals were sent by stage (Qualified, Quote Accepted, Completed Sale), attributed SGD revenue, pending/quarantined counts, and Customer Match audience separation.',
  },
];

function executeZuraTool(
  name: string,
  args: Record<string, unknown>
): { payload: Record<string, unknown>; summary: string } {
  const ctx = conversionService.getSanitizedToolContext();
  const state = conversionService.getWorkspaceState();

  const stageCounts = {
    qualified_lead: state.ingestion.rows.filter((r) => r.stage === 'qualified_lead').length,
    converted_lead_quote_accepted: state.ingestion.rows.filter((r) => r.stage === 'converted_lead').length,
    completed_sale: state.ingestion.rows.filter((r) => r.stage === 'completed_sale').length,
  };

  switch (name) {
    case 'checkConnectionAndReadiness':
      return {
        payload: {
          workspaceId: ctx.workspaceId,
          businessName: ctx.businessName,
          connection: ctx.connection,
          destinations: ctx.destinations,
          stageCounts,
          ownerApproved: ctx.validationSummary.ownerApproved,
        },
        summary: `Checked Google connection, website tag, and ${ctx.destinations.length} conversion signals`,
      };

    case 'suggestApiPayloadMappings':
      return {
        payload: {
          apiSchemaFieldsOnly: ctx.csvHeadersOnly,
          currentMapping: ctx.currentMapping,
          suggestedMapping: ctx.suggestedMapping,
        },
        summary: `Inspected ${ctx.csvHeadersOnly.length} API field names only (0 customer PII read)`,
      };

    case 'previewValidationErrors':
      return {
        payload: ctx.validationSummary,
        summary: `Found ${ctx.validationSummary.quarantined} held events and ${ctx.validationSummary.pendingReady} ready to send`,
      };

    case 'explainGoogleDiagnostics':
      return {
        payload: {
          metrics: {
            submitted: ctx.metrics.submitted,
            processed: ctx.metrics.processed,
            attributed: ctx.metrics.attributed,
            pending: ctx.metrics.pending,
            quarantined: ctx.metrics.quarantined,
            totalAttributedValueSgd: ctx.metrics.totalAttributedValueSgd,
          },
          stageCounts,
          diagnostics: ctx.diagnostics,
          recentRuns: ctx.recentRuns,
        },
        summary: `Loaded Google diagnostics & attributed revenue (SGD ${ctx.metrics.totalAttributedValueSgd})`,
      };

    case 'proposeSchedule': {
      const pattern = String(args?.businessUpdatePattern ?? 'realtime_crm_api');
      const recommended = pattern.includes('month')
        ? 'monthly'
        : pattern.includes('daily')
          ? 'daily'
          : 'hourly';
      return {
        payload: {
          currentSchedule: ctx.scheduler,
          recommendedCadence: recommended,
          rationale:
            recommended === 'hourly'
              ? 'Hourly API sync is recommended so Google Smart Bidding gets fresh signals quickly and no deal drifts past the 90-day attribution window.'
              : recommended === 'daily'
                ? 'Daily API sync works when teams update CRM outcomes once a day; still sends only new updates.'
                : 'Monthly is only for accounting checks—too slow for Google Ads bidding and risks hitting the 90-day cutoff.',
        },
        summary: `Recommended ${recommended} API sync (current: ${ctx.scheduler.cadence})`,
      };
    }

    case 'summarizeUploadHealth':
      return {
        payload: {
          metrics: ctx.metrics,
          stageCounts,
          destinations: ctx.destinations.map((d) => ({
            stage: d.stage,
            action: d.actionName,
            biddingInfluence: d.biddingInfluence,
          })),
          scheduler: ctx.scheduler,
          recentRuns: ctx.recentRuns,
        },
        summary: `Health summary: ${ctx.metrics.submitted} sent, ${ctx.metrics.attributed} attributed (SGD ${ctx.metrics.totalAttributedValueSgd})`,
      };

    default:
      return {
        payload: { error: `Unknown tool: ${name}` },
        summary: `Blocked unknown tool "${name}"`,
      };
  }
}

const SYSTEM_INSTRUCTION = `You are the Google Ads Conversion Assistant — a friendly, practical marketing & revenue advisor helping marketers, sales managers, and business owners understand how Google Ads API conversion tracking improves lead quality and real revenue.

AUDIENCE & TONE:
- Write in plain, everyday marketing and business English. Avoid heavy engineering jargon unless the user asks for technical details.
- Think from a REVENUE & ROAS point of view first (ad spend, cost per paying customer, sales close rate, wasted budget on junk leads).
- Keep answers concise, scannable, and easy to repeat to a boss, client, or sales team.

STRICT DOMAIN RULES:
1. This is an API-only setup (CRM -> Conversion Sync API -> Google Ads Data Manager API). NEVER mention or recommend CSV uploads.
2. You ONLY have read-only access via your 6 tools. Backend code handles privacy scrambling (SHA-256 hashing), consent checks, 63d/90d window checks, duplicate protection, and uploads. Raw customer emails and phone numbers are NEVER shared with you.
3. Always clarify TYPICAL GOOGLE ADS CAMPAIGN DURATION & EARLY SIGNAL TIMING when relevant:
   - Official Smart Bidding learning status lasts 7 days, and performance typically takes 1–3 conversion cycles (1–2+ weeks) to stabilize.
   - Typical Google Ads paid campaigns run for a minimum of **3 months** to evaluate properly, and **6–12+ months** to reach maturity and scale.
   - CRITICAL INSIGHT: If you do NOT send a quality SQL signal early (in Weeks 1–2), Google spends Months 1–3 optimizing for cheap form fills and junk leads—and by the time a 3–5 month Closed-Won deal closes, the campaign window is over and both ECL (63d) and GCLID (90d) have expired!
4. Always clarify DEMAND WATERFALL & SHORT-TERM SQL SIGNAL STRATEGY when relevant:
   - In B2B or high-ticket sales, final Closed-Won deals often take 2, 3, or 5 months (60–150+ days)—which EXCEEDS Google’s 63-day ECL limit and 90-day GCLID limit, AND usually produces too few monthly signals (<30/month).
   - Therefore, focus Google Ads Smart Bidding on SHORT-TERM SQL goals inside the Demand Waterfall (Inquiry -> MQL -> SAL -> SQL -> Long-Cycle Closed-Won):
     * Inquiry / Raw Form Fill: Track only (never Primary—otherwise Google buys junk leads).
     * MQL & SAL: Secondary observation (measure funnel health without double-counting).
     * SQL (divided from Sales’ perspective into Meeting Booked [~Day 6], Meeting Held / Qualified [~Day 11 — recommended sweet spot], or Proposal Sent [~Day 24]): PRIMARY BIDDING GOAL! Lands well inside Google’s 63-day ECL and 90-day GCLID windows and hits ~30+ clean signals/month.
     * Proxy Value (Revenue Thinking): Calculate Expected Pipeline Value per SQL = Avg Closed-Won Deal Value × Historical SQL-to-Win Rate (e.g., SGD 12,000 × 25% = SGD 3,000 per SQL Meeting Held) so Smart Bidding optimizes for revenue today without waiting 4 months!
5. Clearly explain official Google concepts simply when asked (always verified against Google Ads Help Center):
   - Enhanced Conversions for Leads (Official Google definition): "An upgraded version of offline conversion import that uses user-provided data, such as email addresses, to supplement imported offline conversion data to improve accuracy and bidding performance." Matches hashed website form data to signed-in Google users.
   - Offline Conversion Import (OCI) & GCLID (Official Google definition): Imports off-the-web outcomes (CRM, phone, in-person sales) back into Google Ads. GCLID (Google Click ID) is the unique URL tracking identifier from auto-tagging that links the offline outcome back to the ad click.
   - Expiration Windows (CRITICAL VERIFIED RULE): YES, Enhanced Conversions for Leads expires EVEN FASTER than GCLID!
     * Enhanced Conversions for Leads (user-provided hashed data matching): expires **63 days** after the last ad click.
     * GCLID (Standard Offline Conversion Import): expires **90 days** after the last ad click.
   - Customer Match (Official Google definition): Uses first-party customer data (emails/phones) to reach or exclude audiences across Search, Shopping, Gmail, YouTube, and Display. It ONLY updates audiences—it NEVER reports an SQL or sale.
6. Distinguish Sent (Submitted) vs Matched (Processed) vs Credited to Ads (Attributed).`;

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('Deadline expired') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('ECONNRESET') ||
    msg.includes('fetch failed')
  );
}

function formatFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return 'Unable to reach Gemini with the current API key. Please check your key in Settings > Secrets.';
  }
  if (
    raw.includes('503') ||
    raw.includes('504') ||
    raw.includes('DEADLINE_EXCEEDED') ||
    raw.includes('Deadline expired') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('high demand') ||
    raw.includes('timeout') ||
    raw.includes('aborted')
  ) {
    return 'The AI assistant is experiencing brief high demand from Gemini right now. Please click Send again in a few seconds.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Gemini API rate limit reached momentarily. Please wait a few seconds and try again.';
  }
  return raw;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: Array<Record<string, unknown>>,
  config: Record<string, unknown>
) {
  // Use ultra-fast gemini-3.1-flash-lite first for snappy low-latency tool chat, with gemini-4-hydrogen backup
  const attempts: Array<{ model: string; thinkingLevel?: ThinkingLevel; delayMs: number }> = [
    { model: 'gemini-3.1-flash-lite', delayMs: 0 },
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, delayMs: 300 },
    { model: 'gemini-3.1-flash-lite', delayMs: 800 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }
    try {
      const mergedConfig = attempt.thinkingLevel
        ? { ...config, thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
        : config;
      return await ai.models.generateContent({
        model: attempt.model,
        contents: contents as never,
        config: mergedConfig as never,
      });
    } catch (err) {
      lastError = err;
      if (!isTransientError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

export async function runZuraAssistantChat(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{ reply: string; toolCalls: AssistantToolCallLog[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 22000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Only include prior turns (avoid duplicating the latest userMessage if client already appended it)
  const trimmedHistory = history.slice(-6);
  const lastInHistory = trimmedHistory[trimmedHistory.length - 1];
  const priorTurns =
    lastInHistory && lastInHistory.role === 'user' && lastInHistory.content.trim() === userMessage
      ? trimmedHistory.slice(0, -1)
      : trimmedHistory;

  const contents: Array<Record<string, unknown>> = priorTurns.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const executedToolCalls: AssistantToolCallLog[] = [];
  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: ZURA_TOOLS }],
  };

  try {
    let response = await generateWithRetry(ai, contents, config);

    let round = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && round < 3) {
      round += 1;
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent as unknown as Record<string, unknown>);
      }

      const functionResponseParts = response.functionCalls.map((call) => {
        const toolName = call.name ?? 'unknown';
        const args = (call.args as Record<string, unknown>) ?? {};
        const result = executeZuraTool(toolName, args);

        executedToolCalls.push({
          name: toolName,
          summary: result.summary,
          piiExposed: false,
        });

        return {
          functionResponse: {
            id: call.id,
            name: toolName,
            response: result.payload,
          },
        };
      });

      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });

      response = await generateWithRetry(ai, contents, config);
    }

    const replyText =
      response.text?.trim() ||
      'I checked your workspace metrics and signal setup, but received an empty reply. Try asking how many signals we are sending, or whether we should send Qualified, Quote, or Sale.';

    return {
      reply: replyText,
      toolCalls: executedToolCalls,
    };
  } catch (err) {
    throw new Error(formatFriendlyError(err));
  }
}
