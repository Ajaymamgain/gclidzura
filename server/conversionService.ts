import crypto from 'node:crypto';
import type {
  AuditLogEntry,
  ColumnMapping,
  ConversionDestination,
  DiagnosticItem,
  DryRunSummary,
  FunnelStageId,
  LeadDeskStage,
  ParsedConversionRow,
  RowIssue,
  ScheduleCadence,
  UploadRunRecord,
  ValidationIssueCode,
  WhatsAppLeadRecord,
  WorkspaceState,
} from '../src/types/zura.ts';

interface RawRecord {
  rowIndex: number;
  source: 'csv' | 'api';
  raw: Record<string, string>;
  isCorrected: boolean;
  alreadySent: boolean;
  deliveryStage: 'none' | 'submitted' | 'processed' | 'attributed';
}

export const DEFAULT_SG_HOME_SERVICES_CSV = [
  'lead_ref,customer_email,contact_phone,google_click_id,outcome_timestamp,tz,job_value,currency_code,ad_consent,funnel_outcome',
  'SG-LEAD-9041,tan.weiming@example.sg,+6591234011,EAIaIQobChMI9a7x_SG_01,2026-11-18T10:14:22+08:00,Asia/Singapore,0,SGD,GRANTED,qualified_lead',
  'SG-LEAD-9042,nurul.aisyah@example.sg,+6582345122,EAIaIQobChMI9a7x_SG_02,2026-11-18T11:32:05+08:00,Asia/Singapore,380,SGD,GRANTED,converted_lead',
  'SG-LEAD-9043,lim.kengheng@example.sg,+6596781233,EAIaIQobChMI9a7x_SG_03,2026-11-18T13:05:40+08:00,Asia/Singapore,640,SGD,GRANTED,completed_sale',
  'SG-LEAD-9044,priya.nair@example.sg,+6581129844,EAIaIQobChMI9a7x_SG_04,2026-11-18T14:22:18+08:00,Asia/Singapore,920,SGD,GRANTED,completed_sale',
  'SG-LEAD-9045,david.koh@example.sg,+6594456755,EAIaIQobChMI9a7x_SG_05,2026-11-18T15:10:00+08:00,Asia/Singapore,0,SGD,GRANTED,qualified_lead',
  'SG-LEAD-9046,sharon.ng@example.sg,+6597812366,,2026-11-18T16:45:12+08:00,Asia/Singapore,450,SGD,GRANTED,completed_sale',
  'SG-LEAD-9047,,,,2026-11-18T17:12:00+08:00,Asia/Singapore,320,SGD,GRANTED,completed_sale',
  'SG-LEAD-9048,arjun.menon@example.sg,+6583349077,EAIaIQobChMI9a7x_SG_08,2026-07-10T11:00:00+08:00,Asia/Singapore,510,SGD,GRANTED,completed_sale',
  'SG-LEAD-9042,nurul.aisyah@example.sg,+6582345122,EAIaIQobChMI9a7x_SG_02,2026-11-18T11:32:05+08:00,Asia/Singapore,380,SGD,GRANTED,converted_lead',
  'SG-LEAD-9050,chloe.yeo@example.sg,+6598872211,EAIaIQobChMI9a7x_SG_10,2026-11-18T18:05:31+08:00,Asia/Singapore,780,SGD,DENIED,completed_sale',
  'SG-LEAD-9051,farhan.hakim@example.sg,+6587763322,EAIaIQobChMI9a7x_SG_11,2026-11-19T09:15:44+08:00,Asia/Singapore,290,SGD,GRANTED,converted_lead',
  'SG-LEAD-9052,mei.ling@example.sg,+6592214433,EAIaIQobChMI9a7x_SG_12,2026-11-19T10:40:19+08:00,Asia/Singapore,,SGD,GRANTED,completed_sale',
  'SG-LEAD-9053,kelvin.chua@example.sg,+6595547788,EAIaIQobChMI9a7x_SG_13,2026-11-19T11:25:02+08:00,Asia/Singapore,1180,SGD,GRANTED,completed_sale',
  'SG-LEAD-9054,siti.rahimah@example.sg,+6584436699,EAIaIQobChMI9a7x_SG_14,2026-11-19T12:18:55+08:00,Asia/Singapore,0,SGD,GRANTED,qualified_lead',
].join('\n');

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || !cleaned.includes('@')) return null;
  return cleaned;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '').trim();
  if (digits.length < 8) return null;
  return digits.startsWith('+') ? digits : `+65${digits}`;
}

function maskEmail(raw: string): string {
  const norm = normalizeEmail(raw);
  if (!norm) return '—';
  const [local, domain] = norm.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(raw: string): string {
  const norm = normalizePhone(raw);
  if (!norm) return '—';
  return `${norm.slice(0, 3)} **** ${norm.slice(-4)}`;
}

function parseCsvLines(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };

  const headers = splitRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitRow(lines[i]);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = vals[idx] ?? '';
    });
    rows.push(rec);
  }
  return { headers, rows };
}

function autoSuggestMapping(headers: string[]): ColumnMapping {
  const pick = (patterns: RegExp[]): string => {
    for (const pat of patterns) {
      const found = headers.find((h) => pat.test(h.toLowerCase()));
      if (found) return found;
    }
    return '';
  };

  return {
    leadId: pick([/lead.*(id|ref)/, /transaction.*id/, /event.*id/, /order.*id/]),
    email: pick([/email/, /mail/]),
    phone: pick([/phone/, /whatsapp/, /mobile/, /tel/]),
    gclid: pick([/gclid/, /click.*id/]),
    eventTime: pick([/time/, /date/, /timestamp/]),
    timezone: pick([/^tz$/, /timezone/, /zone/]),
    value: pick([/value/, /amount/, /revenue/, /price/]),
    currency: pick([/currency/, /curr/]),
    consentStatus: pick([/consent/, /permission/]),
    stage: pick([/funnel/, /stage/, /^outcome$/, /event.*name/, /status/]),
  };
}

function isValidIsoTimestamp(raw: string): boolean {
  if (!raw || raw.trim().length < 10) return false;
  // Require ISO-8601 style YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(raw.trim())) return false;
  const parsed = Date.parse(raw.trim());
  return !Number.isNaN(parsed);
}

function computeNextRunIso(cadence: ScheduleCadence, paused: boolean): string {
  if (paused) return 'Paused by operator';
  const now = new Date();
  if (cadence === 'hourly') {
    const next = new Date(now.getTime() + 60 * 60 * 1000);
    next.setMinutes(0, 0, 0);
    return next.toISOString();
  }
  if (cadence === 'daily') {
    const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    next.setUTCHours(1, 0, 0, 0); // 09:00 SGT
    return next.toISOString();
  }
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 1, 0, 0));
  return next.toISOString();
}

export class ZuraConversionService {
  private workspaceId = 'ws_sg_coolcare_01';
  private businessName = 'CoolCare Aircon & Home Services';
  private region = 'Singapore (SG)';
  private currency = 'SGD';
  private timezone = 'Asia/Singapore';
  private rolloutPhase = 'Agency-Assisted Pilot (Workspace 1 of 1)';

  private googleConnection = {
    connected: true,
    accountEmail: 'ops@coolcare.sg',
    customerAccountId: '482-910-3348',
    customerAccountName: 'CoolCare Singapore — Search & Local Services',
    oauthScope: 'https://www.googleapis.com/auth/datamanager',
    grantsCampaignManagement: false as const,
    websiteTagVerified: true,
    gtmEnhancedLeadsEnabled: true,
    whatsappLeadBridgeEnabled: true,
    lastVerifiedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  };

  private destinations: ConversionDestination[] = [
    {
      id: 'dest_qualified',
      stageId: 'qualified_lead',
      stageLabel: 'Qualified Lead',
      businessDefinition: 'WhatsApp agent confirms property type, service scope, and Singapore postal code.',
      googleFunction: 'enhanced_conversions_leads',
      googleConversionActionId: 'customers/4829103348/conversionActions/701428910',
      googleConversionActionName: 'SG_WhatsApp_Qualified_Lead',
      biddingInfluence: 'secondary_observation',
      enabled: true,
    },
    {
      id: 'dest_converted',
      stageId: 'converted_lead',
      stageLabel: 'Converted Lead (Quotation Accepted)',
      businessDefinition: 'Homeowner accepts SGD quotation in WhatsApp and confirms technician slot.',
      googleFunction: 'enhanced_conversions_leads',
      googleConversionActionId: 'customers/4829103348/conversionActions/701428955',
      googleConversionActionName: 'SG_Quotation_Accepted',
      biddingInfluence: 'primary_bidding',
      enabled: true,
    },
    {
      id: 'dest_sale',
      stageId: 'completed_sale',
      stageLabel: 'Completed Sale (Verified Job)',
      businessDefinition: 'Job completed on-site, invoice settled in SGD, actual transaction value recorded.',
      googleFunction: 'offline_conversions',
      googleConversionActionId: 'customers/4829103348/conversionActions/701429004',
      googleConversionActionName: 'SG_Completed_Job_Revenue',
      biddingInfluence: 'primary_bidding',
      enabled: true,
    },
    {
      id: 'dest_audience',
      stageId: 'audience_retargeting',
      stageLabel: 'Customer Match Audience (Distinct from Sales)',
      businessDefinition: 'Past annual aircon servicing customers synced to Google Audiences for seasonal reminders. Never reports a sale.',
      googleFunction: 'customer_match',
      googleConversionActionId: 'customers/4829103348/userLists/88412031',
      googleConversionActionName: 'SG_Annual_Servicing_CRM_Audience',
      biddingInfluence: 'audience_only',
      enabled: true,
    },
  ];

  private scopedKeyFull = 'zura_ing_sg_9f4b2c81e0a7d53c14b9e6a2';
  private scopedKeyMasked = 'zura_ing_sg_••••••••e6a2';
  private csvFilename = 'api_event_stream_v1';
  private csvHeaders: string[] = [];
  private mapping: ColumnMapping = {
    leadId: 'lead_ref',
    email: 'customer_email',
    phone: 'contact_phone',
    gclid: 'google_click_id',
    eventTime: 'outcome_timestamp',
    timezone: 'tz',
    value: 'job_value',
    currency: 'currency_code',
    consentStatus: 'ad_consent',
    stage: 'funnel_outcome',
  };
  private rawRecords: RawRecord[] = [];
  private sentTransactionIds = new Set<string>(['SG-LEAD-9041', 'SG-LEAD-9042', 'SG-LEAD-9043']);

  private lastDryRun: DryRunSummary | null = null;
  private ownerApproved = false;
  private approvedBy: string | null = null;
  private approvedAt: string | null = null;

  private scheduler = {
    active: true,
    paused: false,
    cadence: 'hourly' as ScheduleCadence,
    deltaOnly: true as const,
    safeRetryEnabled: true,
    lastRunAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  };

  private customerMatchAudienceCount = 1284;

  private salesLeadsInternal: Array<
    WhatsAppLeadRecord & { rawEmail: string; rawPhone: string }
  > = [
    {
      leadId: 'SG-LEAD-9201',
      customerName: 'Marcus Goh',
      propertyArea: 'Tampines 4-Room HDB (S520412)',
      serviceRequest: 'Chemical overhaul for 3 Daikin inverter units',
      rawEmail: 'marcus.goh@example.sg',
      rawPhone: '+6591428801',
      emailMasked: maskEmail('marcus.goh@example.sg'),
      phoneMasked: maskPhone('+6591428801'),
      gclid: 'EAIaIQobChMI_SG_TAMPINES_01',
      adCampaign: 'SG Search — Aircon Chemical Overhaul',
      consentStatus: 'GRANTED',
      currentStage: 'new_enquiry',
      quotedValueSgd: 420,
      finalInvoiceSgd: null,
      lastMessagePreview: 'Hi, saw your Google ad. Can your team service 3 units this Saturday morning?',
      updatedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      syncedStages: [],
    },
    {
      leadId: 'SG-LEAD-9202',
      customerName: 'Amina Binte Yusuf',
      propertyArea: 'Punggol Executive Condo (S828814)',
      serviceRequest: 'Full system-4 Mitsubishi installation + trunking',
      rawEmail: 'amina.yusuf@example.sg',
      rawPhone: '+6582654190',
      emailMasked: maskEmail('amina.yusuf@example.sg'),
      phoneMasked: maskPhone('+6582654190'),
      gclid: 'EAIaIQobChMI_SG_PUNGGOL_02',
      adCampaign: 'SG Search — System 4 Aircon Install',
      consentStatus: 'GRANTED',
      currentStage: 'qualified_lead',
      quotedValueSgd: 3450,
      finalInvoiceSgd: null,
      lastMessagePreview: 'Confirmed 4-unit layout & postal code. Waiting for your itemized quotation.',
      updatedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
      syncedStages: ['qualified_lead'],
    },
    {
      leadId: 'SG-LEAD-9203',
      customerName: 'Derrick Ong',
      propertyArea: 'Bukit Timah Terrace (S269707)',
      serviceRequest: 'Emergency water leak repair + gas top-up (5 units)',
      rawEmail: 'derrick.ong@example.sg',
      rawPhone: '+6597331129',
      emailMasked: maskEmail('derrick.ong@example.sg'),
      phoneMasked: maskPhone('+6597331129'),
      gclid: 'EAIaIQobChMI_SG_BTIMAH_03',
      adCampaign: 'SG Search — Urgent Aircon Repair',
      consentStatus: 'GRANTED',
      currentStage: 'converted_lead',
      quotedValueSgd: 890,
      finalInvoiceSgd: null,
      lastMessagePreview: 'Quotation of SGD 890 accepted! See technician at 2pm today.',
      updatedAt: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
      syncedStages: ['qualified_lead', 'converted_lead'],
    },
    {
      leadId: 'SG-LEAD-9204',
      customerName: 'Siew Ling Chua',
      propertyArea: 'Bishan Condo (S579837)',
      serviceRequest: 'Annual 4-visit servicing contract',
      rawEmail: 'siewling.chua@example.sg',
      rawPhone: '+6588412276',
      emailMasked: maskEmail('siewling.chua@example.sg'),
      phoneMasked: maskPhone('+6588412276'),
      gclid: '',
      adCampaign: 'SG Local Services — Aircon Maintenance',
      consentStatus: 'GRANTED',
      currentStage: 'qualified_lead',
      quotedValueSgd: 560,
      finalInvoiceSgd: null,
      lastMessagePreview: 'No GCLID captured (direct WhatsApp follow-up) — enhanced email/phone matching ready.',
      updatedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
      syncedStages: ['qualified_lead'],
    },
    {
      leadId: 'SG-LEAD-9205',
      customerName: 'Rohan Subramaniam',
      propertyArea: 'Jurong West 5-Room HDB (S640512)',
      serviceRequest: '2-unit general servicing',
      rawEmail: 'rohan.subra@example.sg',
      rawPhone: '+6590227134',
      emailMasked: maskEmail('rohan.subra@example.sg'),
      phoneMasked: maskPhone('+6590227134'),
      gclid: 'EAIaIQobChMI_SG_JURONG_05',
      adCampaign: 'SG Search — Aircon Servicing',
      consentStatus: 'DENIED',
      currentStage: 'new_enquiry',
      quotedValueSgd: 160,
      finalInvoiceSgd: null,
      lastMessagePreview: 'Customer opted out of ad_user_data consent — backend will quarantine if submitted.',
      updatedAt: new Date(Date.now() - 102 * 60 * 1000).toISOString(),
      syncedStages: [],
    },
  ];

  private runs: UploadRunRecord[] = [
    {
      runId: 'run_20261119_0400',
      startedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      trigger: 'scheduled_delta',
      cadence: 'hourly',
      submitted: 3,
      processed: 3,
      attributed: 2,
      rejected: 0,
      skippedDuplicates: 1,
      status: 'completed',
    },
  ];

  private diagnostics: DiagnosticItem[] = [
    {
      id: 'diag_1',
      code: 'ATTRIBUTION_LAG_WINDOW',
      severity: 'info',
      title: '1 processed event awaiting Google Ads attribution window',
      detail:
        'Google Data Manager accepted and processed 3 conversions; 2 are attributed to ad clicks and 1 enhanced-lead match is inside the 24–72h reporting lag window.',
      affectedCount: 1,
      timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'diag_2',
      code: 'DUPLICATE_ADJUSTMENT_PREVENTED',
      severity: 'warning',
      title: 'Duplicate transaction ID blocked to prevent unintended adjustment',
      detail:
        'Lead ID SG-LEAD-9042 appeared twice in the source file. Reusing a transaction ID triggers Google adjustment semantics, so Zura quarantined the duplicate before submission.',
      affectedCount: 1,
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
  ];

  private auditLog: AuditLogEntry[] = [
    {
      id: 'aud_1',
      timestamp: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      actor: 'agency.lead@zura.sg',
      action: 'Verified Google Data Manager OAuth Scope',
      detail: 'Confirmed datamanager scope for events:ingest on customer account 482-910-3348 (no campaign management scope requested).',
      category: 'oauth',
    },
    {
      id: 'aud_2',
      timestamp: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
      actor: 'ops@coolcare.sg',
      action: 'Verified Website GTM Tag & WhatsApp Lead Bridge',
      detail: 'Confirmed Google tag collects first-party identifiers and passes stable SG-LEAD-* reference into WhatsApp pre-filled enquiry.',
      category: 'config',
    },
    {
      id: 'aud_3',
      timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      actor: 'scheduler:hourly-delta',
      action: 'Completed Delta Upload Run (run_20261119_0400)',
      detail: 'Submitted 3 new events, 3 processed by Google Data Manager, 2 attributed to clicks (1 in lag window), 1 duplicate skipped.',
      category: 'upload',
    },
  ];

  constructor() {
    this.loadCsvInternal(DEFAULT_SG_HOME_SERVICES_CSV, this.csvFilename, true);
  }

  private addAudit(actor: string, action: string, detail: string, category: AuditLogEntry['category']) {
    this.auditLog.unshift({
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      detail,
      category,
    });
    if (this.auditLog.length > 40) {
      this.auditLog = this.auditLog.slice(0, 40);
    }
  }

  private loadCsvInternal(csvText: string, filename: string, initialSeed = false) {
    const parsed = parseCsvLines(csvText);
    this.csvFilename = filename;
    this.csvHeaders = parsed.headers;
    this.mapping = autoSuggestMapping(parsed.headers);
    this.rawRecords = parsed.rows.map((raw, idx) => {
      const leadId = (raw[this.mapping.leadId] || '').trim();
      const isSeedSent = initialSeed && idx < 3 && this.sentTransactionIds.has(leadId);
      const deliveryStage: RawRecord['deliveryStage'] = isSeedSent
        ? idx < 2
          ? 'attributed'
          : 'processed'
        : 'none';
      return {
        rowIndex: idx + 1,
        source: 'api' as const,
        raw,
        isCorrected: false,
        alreadySent: isSeedSent,
        deliveryStage,
      };
    });
  }

  private evaluateRows(): ParsedConversionRow[] {
    const seenLeadIds = new Map<string, number>();

    return this.rawRecords.map((rec) => {
      const getVal = (col: string) => (col ? (rec.raw[col] ?? '').trim() : '');
      const leadId = getVal(this.mapping.leadId);
      const rawEmail = getVal(this.mapping.email);
      const rawPhone = getVal(this.mapping.phone);
      const gclid = getVal(this.mapping.gclid);
      const eventTime = getVal(this.mapping.eventTime);
      const timezone = getVal(this.mapping.timezone) || this.timezone;
      const rawValue = getVal(this.mapping.value);
      const currency = (getVal(this.mapping.currency) || this.currency).toUpperCase();
      const consentStatus = (getVal(this.mapping.consentStatus) || 'UNSPECIFIED').toUpperCase();
      const stage = (getVal(this.mapping.stage) || 'qualified_lead').toLowerCase();

      const normEmail = normalizeEmail(rawEmail);
      const normPhone = normalizePhone(rawPhone);
      const parsedVal = rawValue === '' ? null : Number(rawValue);
      const value = parsedVal !== null && !Number.isNaN(parsedVal) ? parsedVal : null;

      const issues: RowIssue[] = [];

      if (!leadId) {
        issues.push({
          code: 'MISSING_IDENTIFIER',
          field: 'leadId',
          message: 'Missing stable lead/event ID required for deduplication and WhatsApp-to-ad linking.',
          severity: 'error',
        });
      }

      if (!normEmail && !normPhone && !gclid) {
        issues.push({
          code: 'MISSING_IDENTIFIER',
          field: 'email/phone/gclid',
          message: 'Requires at least one valid first-party identifier (email or E.164 phone) or Google click ID (GCLID).',
          severity: 'error',
        });
      }

      if (!isValidIsoTimestamp(eventTime)) {
        issues.push({
          code: 'INVALID_TIMESTAMP',
          field: 'eventTime',
          message: `Invalid outcome timestamp "${eventTime || 'empty'}". Must be ISO-8601 with timezone offset (e.g. 2026-11-18T14:20:00+08:00).`,
          severity: 'error',
        });
      } else {
        const eventMs = Date.parse(eventTime);
        const refNowMs = Date.parse('2026-11-19T12:00:00+08:00');
        const daysOld = Math.floor((refNowMs - eventMs) / (1000 * 60 * 60 * 24));
        if (daysOld > 90) {
          issues.push({
            code: 'EXPIRED_90_DAY_WINDOW',
            field: 'eventTime',
            message: `Event is ${daysOld} days old—exceeds Google Ads' strict 90-day conversion attribution window. Cannot be attributed to the original click.`,
            severity: 'error',
          });
        }
      }

      if (leadId) {
        const prevRow = seenLeadIds.get(leadId);
        if (prevRow !== undefined) {
          issues.push({
            code: 'DUPLICATE_TRANSACTION_ID',
            field: 'leadId',
            message: `Duplicate transaction ID "${leadId}" (matches row #${prevRow}). Reusing IDs triggers Google adjustment semantics.`,
            severity: 'error',
          });
        } else {
          seenLeadIds.set(leadId, rec.rowIndex);
        }
      }

      if (consentStatus !== 'GRANTED') {
        issues.push({
          code: 'CONSENT_DENIED_OR_MISSING',
          field: 'consentStatus',
          message: `ad_user_data consent is "${consentStatus}". Backend consent gate blocks unconsented uploads.`,
          severity: 'error',
        });
      }

      if (stage === 'completed_sale' && (value === null || value <= 0)) {
        issues.push({
          code: 'MISSING_VALUE_FOR_SALE',
          field: 'value',
          message: 'Completed sale requires an actual positive transaction value in SGD.',
          severity: 'error',
        });
      }

      if (!/^[A-Z]{3}$/.test(currency)) {
        issues.push({
          code: 'INVALID_CURRENCY',
          field: 'currency',
          message: `Currency "${currency}" must be a 3-letter ISO-4217 code (e.g. SGD).`,
          severity: 'error',
        });
      }

      let status: ParsedConversionRow['status'] = 'ready';
      if (issues.some((i) => i.severity === 'error')) {
        status = 'quarantined';
      } else if (rec.alreadySent && !rec.isCorrected) {
        status = rec.deliveryStage === 'none' ? 'submitted' : rec.deliveryStage;
      }

      return {
        rowIndex: rec.rowIndex,
        source: rec.source,
        leadId: leadId || `ROW-${rec.rowIndex}`,
        emailMasked: maskEmail(rawEmail),
        phoneMasked: maskPhone(rawPhone),
        hasEmail: Boolean(normEmail),
        hasPhone: Boolean(normPhone),
        gclid,
        eventTime,
        timezone,
        value,
        currency,
        consentStatus,
        stage,
        status,
        issues,
        isCorrected: rec.isCorrected,
        alreadySent: rec.alreadySent,
        emailHashPreview: normEmail ? sha256Hex(normEmail).slice(0, 16) + '…' : undefined,
        phoneHashPreview: normPhone ? sha256Hex(normPhone).slice(0, 16) + '…' : undefined,
      };
    });
  }

  public getWorkspaceState(): WorkspaceState {
    const rows = this.evaluateRows();

    const pending = rows.filter((r) => r.status === 'ready').length;
    const quarantined = rows.filter((r) => r.status === 'quarantined').length;
    const submittedRows = rows.filter(
      (r) => r.status === 'submitted' || r.status === 'processed' || r.status === 'attributed'
    );
    const processedRows = rows.filter((r) => r.status === 'processed' || r.status === 'attributed');
    const attributedRows = rows.filter((r) => r.status === 'attributed');

    const totalAttributedValueSgd = attributedRows.reduce((sum, r) => sum + (r.value ?? 0), 0);

    return {
      workspaceId: this.workspaceId,
      businessName: this.businessName,
      region: this.region,
      currency: this.currency,
      timezone: this.timezone,
      rolloutPhase: this.rolloutPhase,
      googleConnection: { ...this.googleConnection },
      destinations: this.destinations.map((d) => ({ ...d })),
      salesLeads: this.salesLeadsInternal.map(({ rawEmail: _e, rawPhone: _p, ...pub }) => ({
        ...pub,
        syncedStages: [...pub.syncedStages],
      })),
      ingestion: {
        sourceMode: 'both',
        apiEndpoint: '/api/workspace/source/ingest-event',
        scopedKeyMasked: this.scopedKeyMasked,
        scopedKeyFull: this.scopedKeyFull,
        csvFilename: this.csvFilename,
        csvHeaders: [...this.csvHeaders],
        mapping: { ...this.mapping },
        rows,
      },
      validation: {
        lastDryRun: this.lastDryRun,
        ownerApproved: this.ownerApproved,
        approvedBy: this.approvedBy,
        approvedAt: this.approvedAt,
      },
      scheduler: {
        ...this.scheduler,
        nextRunAt: computeNextRunIso(this.scheduler.cadence, this.scheduler.paused),
      },
      metrics: {
        pending,
        quarantined,
        submitted: submittedRows.length,
        processed: processedRows.length,
        attributed: attributedRows.length,
        customerMatchAudienceCount: this.customerMatchAudienceCount,
        totalAttributedValueSgd,
      },
      runs: [...this.runs],
      diagnostics: [...this.diagnostics],
      auditLog: [...this.auditLog],
    };
  }

  public updateConnection(patch: Partial<typeof this.googleConnection>) {
    this.googleConnection = {
      ...this.googleConnection,
      ...patch,
      grantsCampaignManagement: false,
      lastVerifiedAt: new Date().toISOString(),
    };
    this.addAudit(
      this.googleConnection.accountEmail,
      'Updated Google Connection & Tagging Verification',
      `OAuth connected=${this.googleConnection.connected}, websiteTag=${this.googleConnection.websiteTagVerified}, whatsappBridge=${this.googleConnection.whatsappLeadBridgeEnabled}.`,
      'oauth'
    );
    return this.getWorkspaceState();
  }

  public updateDestination(id: string, patch: Partial<ConversionDestination>) {
    this.destinations = this.destinations.map((d) => {
      if (d.id !== id) return d;
      // Enforce Customer Match can never be primary_bidding or report a sale
      const nextBidding =
        d.googleFunction === 'customer_match'
          ? 'audience_only'
          : (patch.biddingInfluence ?? d.biddingInfluence);
      return { ...d, ...patch, biddingInfluence: nextBidding };
    });
    this.addAudit(
      'ops@coolcare.sg',
      'Updated Conversion Destination Mapping',
      `Updated destination ${id} (${patch.biddingInfluence ?? 'configuration'}).`,
      'config'
    );
    return this.getWorkspaceState();
  }

  public uploadCsv(csvText: string, filename = 'uploaded_outcomes.csv') {
    this.loadCsvInternal(csvText, filename, false);
    this.lastDryRun = null;
    this.addAudit(
      'ops@coolcare.sg',
      'Uploaded Source CSV',
      `Loaded ${this.rawRecords.length} records from ${filename}. Raw PII kept strictly in backend workspace.`,
      'config'
    );
    return this.getWorkspaceState();
  }

  public updateMapping(mapping: ColumnMapping) {
    this.mapping = { ...mapping };
    this.lastDryRun = null;
    this.addAudit(
      'ops@coolcare.sg',
      'Updated API Payload Field Mapping',
      `Mapped leadId→${mapping.leadId || 'none'}, eventTime→${mapping.eventTime || 'none'}, consent→${mapping.consentStatus || 'none'}.`,
      'config'
    );
    return this.getWorkspaceState();
  }

  public fixRow(
    rowIndex: number,
    fixes: {
      leadId?: string;
      email?: string;
      phone?: string;
      eventTime?: string;
      value?: string;
      consentStatus?: string;
    }
  ) {
    const rec = this.rawRecords.find((r) => r.rowIndex === rowIndex);
    if (!rec) throw new Error(`Row #${rowIndex} not found.`);

    if (fixes.leadId !== undefined && this.mapping.leadId) rec.raw[this.mapping.leadId] = fixes.leadId;
    if (fixes.email !== undefined && this.mapping.email) rec.raw[this.mapping.email] = fixes.email;
    if (fixes.phone !== undefined && this.mapping.phone) rec.raw[this.mapping.phone] = fixes.phone;
    if (fixes.eventTime !== undefined && this.mapping.eventTime) rec.raw[this.mapping.eventTime] = fixes.eventTime;
    if (fixes.value !== undefined && this.mapping.value) rec.raw[this.mapping.value] = fixes.value;
    if (fixes.consentStatus !== undefined && this.mapping.consentStatus) {
      rec.raw[this.mapping.consentStatus] = fixes.consentStatus;
    }

    rec.isCorrected = true;
    this.lastDryRun = null;
    this.addAudit(
      'ops@coolcare.sg',
      `Corrected Quarantined Row #${rowIndex}`,
      `Applied operator fix to row #${rowIndex}; flagged as deliberately corrected for next delta batch.`,
      'validation'
    );
    return this.getWorkspaceState();
  }

  public ingestApiEvent(
    apiKey: string | undefined,
    payload: {
      leadId: string;
      email?: string;
      phone?: string;
      gclid?: string;
      eventTime?: string;
      timezone?: string;
      value?: number;
      currency?: string;
      consentStatus?: string;
      stage?: FunnelStageId;
    }
  ) {
    if (apiKey !== this.scopedKeyFull) {
      throw new Error('Unauthorized: Invalid or missing X-Zura-Ingestion-Key for workspace ws_sg_coolcare_01.');
    }

    const nextIndex = this.rawRecords.length + 1;
    const raw: Record<string, string> = {};
    raw[this.mapping.leadId || 'lead_ref'] = payload.leadId;
    raw[this.mapping.email || 'customer_email'] = payload.email ?? '';
    raw[this.mapping.phone || 'contact_phone'] = payload.phone ?? '';
    raw[this.mapping.gclid || 'google_click_id'] = payload.gclid ?? '';
    raw[this.mapping.eventTime || 'outcome_timestamp'] =
      payload.eventTime ?? new Date().toISOString().replace('Z', '+08:00');
    raw[this.mapping.timezone || 'tz'] = payload.timezone ?? this.timezone;
    raw[this.mapping.value || 'job_value'] = payload.value !== undefined ? String(payload.value) : '0';
    raw[this.mapping.currency || 'currency_code'] = payload.currency ?? this.currency;
    raw[this.mapping.consentStatus || 'ad_consent'] = payload.consentStatus ?? 'GRANTED';
    raw[this.mapping.stage || 'funnel_outcome'] = payload.stage ?? 'completed_sale';

    this.rawRecords.push({
      rowIndex: nextIndex,
      source: 'api',
      raw,
      isCorrected: false,
      alreadySent: false,
      deliveryStage: 'none',
    });

    this.addAudit(
      'zura-ingestion-api',
      `Ingested Live API Event (${payload.leadId})`,
      `Queued ${payload.stage ?? 'completed_sale'} event via scoped workspace key (${this.scopedKeyMasked}).`,
      'api'
    );
    return this.getWorkspaceState();
  }

  public runDryValidation(): { workspace: WorkspaceState; dryRun: DryRunSummary } {
    const rows = this.evaluateRows();
    const issueBreakdown: Record<ValidationIssueCode, number> = {
      MISSING_IDENTIFIER: 0,
      INVALID_TIMESTAMP: 0,
      EXPIRED_90_DAY_WINDOW: 0,
      DUPLICATE_TRANSACTION_ID: 0,
      CONSENT_DENIED_OR_MISSING: 0,
      MISSING_VALUE_FOR_SALE: 0,
      INVALID_CURRENCY: 0,
    };

    for (const r of rows) {
      for (const issue of r.issues) {
        issueBreakdown[issue.code] = (issueBreakdown[issue.code] || 0) + 1;
      }
    }

    const eligibleRows = rows.filter((r) => r.status === 'ready');
    const skippedAlreadySent = rows.filter((r) => r.alreadySent && !r.isCorrected).length;
    const quarantinedRows = rows.filter((r) => r.status === 'quarantined').length;

    const hashedPayloadSamples = eligibleRows.slice(0, 4).map((r) => {
      const rec = this.rawRecords.find((x) => x.rowIndex === r.rowIndex)!;
      const normEmail = normalizeEmail(rec.raw[this.mapping.email] ?? '');
      const normPhone = normalizePhone(rec.raw[this.mapping.phone] ?? '');
      const dest =
        this.destinations.find((d) => d.stageId === r.stage) ?? this.destinations[0];

      return {
        transactionId: r.leadId,
        destinationAction: dest.googleConversionActionName,
        eventTimeIso: r.eventTime,
        valueSgd: r.value,
        hashedEmailSha256: normEmail ? sha256Hex(normEmail) : null,
        hashedPhoneSha256: normPhone ? sha256Hex(normPhone) : null,
        gclid: r.gclid || null,
        consentAdUserData: 'GRANTED' as const,
      };
    });

    const dryRun: DryRunSummary = {
      ranAt: new Date().toISOString(),
      totalRows: rows.length,
      eligibleDeltaRows: eligibleRows.length,
      skippedAlreadySent,
      quarantinedRows,
      issueBreakdown,
      hashedPayloadSamples,
      passed: eligibleRows.length > 0 && this.googleConnection.connected,
    };

    this.lastDryRun = dryRun;
    this.addAudit(
      'ops@coolcare.sg',
      'Ran Dry-Run Validation (validateOnly: true)',
      `Validated ${rows.length} rows without uploading: ${eligibleRows.length} delta-ready, ${quarantinedRows} quarantined, ${skippedAlreadySent} already sent skipped.`,
      'validation'
    );

    return { workspace: this.getWorkspaceState(), dryRun };
  }

  public approveFirstLiveRun(approvedBy: string) {
    if (!this.lastDryRun) {
      this.runDryValidation();
    }
    this.ownerApproved = true;
    this.approvedBy = approvedBy || 'Wei Jun Lim (Workspace Owner)';
    this.approvedAt = new Date().toISOString();
    this.addAudit(
      this.approvedBy,
      'Approved First Live Conversion Run',
      'Owner/Admin explicitly reviewed dry-run hashed payloads, quarantine blocks, and bidding destinations.',
      'approval'
    );
    return this.getWorkspaceState();
  }

  public executeLiveRun(trigger: UploadRunRecord['trigger'] = 'manual_first_live') {
    if (!this.googleConnection.connected) {
      throw new Error('Google Data Manager OAuth connection is not active.');
    }
    if (!this.ownerApproved) {
      throw new Error('Owner/Admin approval is required before executing the first live run.');
    }
    if (this.scheduler.paused && trigger === 'scheduled_delta') {
      throw new Error('Scheduler is currently paused. Resume before running scheduled batches.');
    }

    const evaluated = this.evaluateRows();
    const readyRows = evaluated.filter((r) => r.status === 'ready');
    const quarantinedRows = evaluated.filter((r) => r.status === 'quarantined');
    const skippedDuplicates = evaluated.filter(
      (r) => r.alreadySent && !r.isCorrected
    ).length;

    if (readyRows.length === 0) {
      throw new Error('No new or deliberately corrected delta events are ready to submit. Historical rows are never replayed.');
    }

    let submitted = 0;
    let processed = 0;
    let attributed = 0;

    readyRows.forEach((row) => {
      const rec = this.rawRecords.find((x) => x.rowIndex === row.rowIndex);
      if (!rec) return;
      submitted += 1;
      rec.alreadySent = true;
      rec.isCorrected = false;
      this.sentTransactionIds.add(row.leadId);

      // Google accepting a request !== processed !== attributed
      // Realistic funnel: events with GCLID + email/phone attribute quickly; email-only enhanced leads process and enter attribution window
      if (row.gclid && (row.hasEmail || row.hasPhone)) {
        rec.deliveryStage = 'attributed';
        processed += 1;
        attributed += 1;
      } else if (row.hasEmail || row.hasPhone) {
        rec.deliveryStage = 'processed';
        processed += 1;
      } else {
        rec.deliveryStage = 'submitted';
      }
    });

    const runId = `run_${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
    const runRecord: UploadRunRecord = {
      runId,
      startedAt: new Date().toISOString(),
      trigger,
      cadence: this.scheduler.cadence,
      submitted,
      processed,
      attributed,
      rejected: quarantinedRows.length,
      skippedDuplicates,
      status: quarantinedRows.length > 0 ? 'partial_warnings' : 'completed',
    };

    this.runs.unshift(runRecord);
    this.scheduler.lastRunAt = runRecord.startedAt;

    // Refresh diagnostics with truthful Submitted vs Processed vs Attributed separation
    const nextDiagnostics: DiagnosticItem[] = [];
    if (processed > attributed) {
      nextDiagnostics.push({
        id: `diag_lag_${Date.now()}`,
        code: 'ATTRIBUTION_LAG_WINDOW',
        severity: 'info',
        title: `${processed - attributed} processed conversion(s) pending click attribution`,
        detail:
          'Enhanced conversions without GCLID matched via hashed first-party identifiers; Google Ads attribution typically settles within 24–72 hours.',
        affectedCount: processed - attributed,
        timestamp: new Date().toISOString(),
      });
    }
    if (quarantinedRows.length > 0) {
      nextDiagnostics.push({
        id: `diag_quar_${Date.now()}`,
        code: 'PARTIAL_FAILURE_QUARANTINED',
        severity: 'warning',
        title: `${quarantinedRows.length} invalid or unconsented row(s) held in quarantine`,
        detail:
          'Quarantined records were withheld by Zura before hitting Google Data Manager events:ingest to protect match quality and consent compliance.',
        affectedCount: quarantinedRows.length,
        timestamp: new Date().toISOString(),
      });
    }
    if (!this.googleConnection.websiteTagVerified) {
      nextDiagnostics.push({
        id: `diag_tag_${Date.now()}`,
        code: 'WEBSITE_TAG_REQUIRED',
        severity: 'error',
        title: 'Website Google tag unverified for Enhanced Conversions for Leads',
        detail:
          'Google OAuth does not install website tagging automatically. Verify Google Tag Manager first-party identifier collection on your enquiry form.',
        affectedCount: submitted,
        timestamp: new Date().toISOString(),
      });
    }
    if (attributed > 0) {
      nextDiagnostics.push({
        id: `diag_ok_${Date.now()}`,
        code: 'ENHANCED_MATCH_RATE_OPTIMAL',
        severity: 'info',
        title: `Data Manager events:ingest accepted ${submitted} delta event(s)`,
        detail: `${processed} processed cleanly and ${attributed} immediately attributed via GCLID + SHA-256 identifiers. ${skippedDuplicates} previously sent rows skipped.`,
        affectedCount: attributed,
        timestamp: new Date().toISOString(),
      });
    }

    this.diagnostics = nextDiagnostics;

    this.addAudit(
      trigger === 'manual_first_live' ? (this.approvedBy ?? 'ops@coolcare.sg') : `scheduler:${this.scheduler.cadence}`,
      `Executed Live Delta Batch (${runId})`,
      `Submitted ${submitted} new/corrected events (${processed} processed, ${attributed} attributed, ${quarantinedRows.length} quarantined, ${skippedDuplicates} historical skipped).`,
      'upload'
    );

    return this.getWorkspaceState();
  }

  public updateSchedule(patch: { cadence?: ScheduleCadence; paused?: boolean; safeRetryEnabled?: boolean }) {
    if (patch.cadence) this.scheduler.cadence = patch.cadence;
    if (patch.paused !== undefined) this.scheduler.paused = patch.paused;
    if (patch.safeRetryEnabled !== undefined) this.scheduler.safeRetryEnabled = patch.safeRetryEnabled;

    this.addAudit(
      'ops@coolcare.sg',
      patch.paused !== undefined
        ? patch.paused
          ? 'Paused Conversion Scheduler'
          : 'Resumed Conversion Scheduler'
        : `Updated Schedule Cadence to ${this.scheduler.cadence}`,
      `Delta-only mode enforced. Safe retry guardrails=${this.scheduler.safeRetryEnabled}.`,
      'scheduler'
    );
    return this.getWorkspaceState();
  }

  public advanceWhatsAppLead(
    leadId: string,
    nextStage: FunnelStageId,
    valueSgd?: number,
    repName = 'Rachel Tan (Sales Rep)'
  ) {
    const lead = this.salesLeadsInternal.find((l) => l.leadId === leadId);
    if (!lead) throw new Error(`WhatsApp lead ${leadId} not found.`);

    const allowed: FunnelStageId[] = ['qualified_lead', 'converted_lead', 'completed_sale'];
    if (!allowed.includes(nextStage)) {
      throw new Error(`Invalid target stage: ${nextStage}`);
    }

    const actualValue =
      nextStage === 'completed_sale'
        ? valueSgd !== undefined && valueSgd > 0
          ? valueSgd
          : lead.quotedValueSgd
        : nextStage === 'converted_lead'
          ? valueSgd !== undefined && valueSgd >= 0
            ? valueSgd
            : lead.quotedValueSgd
          : 0;

    lead.currentStage = nextStage;
    if (nextStage === 'completed_sale') {
      lead.finalInvoiceSgd = actualValue;
    } else if (valueSgd !== undefined && valueSgd > 0) {
      lead.quotedValueSgd = valueSgd;
    }
    lead.updatedAt = new Date().toISOString();

    if (!lead.syncedStages.includes(nextStage)) {
      lead.syncedStages.push(nextStage);
    }

    // Generate a unique stage-scoped transaction/event ID so advancing stages never collides with adjustment semantics
    const stageSuffix =
      nextStage === 'qualified_lead' ? 'QL' : nextStage === 'converted_lead' ? 'CL' : 'SALE';
    const eventTxId = `${lead.leadId}-${stageSuffix}`;

    this.ingestApiEvent(this.scopedKeyFull, {
      leadId: eventTxId,
      email: lead.rawEmail,
      phone: lead.rawPhone,
      gclid: lead.gclid,
      eventTime: new Date().toISOString().replace('Z', '+08:00'),
      timezone: this.timezone,
      value: actualValue,
      currency: this.currency,
      consentStatus: lead.consentStatus,
      stage: nextStage,
    });

    this.addAudit(
      repName,
      `Confirmed ${nextStage.replace('_', ' ')} for ${lead.customerName} (${lead.leadId})`,
      `Queued event ${eventTxId} (${this.currency} ${actualValue}) into Zura conversion pipeline via WhatsApp Lead Desk.`,
      'sales'
    );

    return this.getWorkspaceState();
  }

  public createWhatsAppLead(payload: {
    customerName?: string;
    propertyArea?: string;
    serviceRequest?: string;
    email?: string;
    phone?: string;
    gclid?: string;
    quotedValueSgd?: number;
    consentStatus?: 'GRANTED' | 'DENIED';
  }) {
    const num = 9206 + this.salesLeadsInternal.length;
    const leadId = `SG-LEAD-${num}`;
    const rawEmail = (payload.email || `customer.${num}@example.sg`).trim();
    const rawPhone = (payload.phone || `+659${Math.floor(1000000 + Math.random() * 8999999)}`).trim();

    const newLead = {
      leadId,
      customerName: (payload.customerName || 'New Homeowner').trim(),
      propertyArea: (payload.propertyArea || 'Clementi HDB (S120311)').trim(),
      serviceRequest: (payload.serviceRequest || 'Aircon servicing enquiry').trim(),
      rawEmail,
      rawPhone,
      emailMasked: maskEmail(rawEmail),
      phoneMasked: maskPhone(rawPhone),
      gclid: (payload.gclid ?? `EAIaIQobChMI_SG_${num}`).trim(),
      adCampaign: 'SG Search — Aircon Servicing',
      consentStatus: (payload.consentStatus === 'DENIED' ? 'DENIED' : 'GRANTED') as 'GRANTED' | 'DENIED',
      currentStage: 'new_enquiry' as LeadDeskStage,
      quotedValueSgd: Number(payload.quotedValueSgd) > 0 ? Number(payload.quotedValueSgd) : 320,
      finalInvoiceSgd: null,
      lastMessagePreview: 'Website enquiry bridged to WhatsApp with stable Lead ID.',
      updatedAt: new Date().toISOString(),
      syncedStages: [] as FunnelStageId[],
    };

    this.salesLeadsInternal.unshift(newLead);
    this.addAudit(
      'whatsapp-lead-bridge',
      `Captured New Website → WhatsApp Lead (${leadId})`,
      `Linked ${newLead.customerName} (${newLead.propertyArea}) with stable Lead ID ${leadId} and consent=${newLead.consentStatus}.`,
      'sales'
    );
    return this.getWorkspaceState();
  }

  public syncCustomerMatchAudience(addedCount: number, actor = 'ops@coolcare.sg') {
    const safeDelta = Math.max(1, Math.min(500, Math.round(addedCount)));
    this.customerMatchAudienceCount += safeDelta;
    this.addAudit(
      actor,
      `Synced ${safeDelta} Hashed Records to Google Audiences (Customer Match)`,
      `Updated SG_Annual_Servicing_CRM_Audience (total ${this.customerMatchAudienceCount}). Audience upload only — zero sales or conversions reported.`,
      'upload'
    );
    return this.getWorkspaceState();
  }

  // Strictly PII-free snapshots for the scoped Gemini tools!
  public getSanitizedToolContext() {
    const state = this.getWorkspaceState();
    const issueCounts: Record<string, number> = {};
    const sampleIssueRules: Array<{ rowIndex: number; leadId: string; stage: string; issues: string[] }> = [];

    for (const r of state.ingestion.rows) {
      if (r.issues.length > 0) {
        for (const iss of r.issues) {
          issueCounts[iss.code] = (issueCounts[iss.code] || 0) + 1;
        }
        sampleIssueRules.push({
          rowIndex: r.rowIndex,
          leadId: r.leadId,
          stage: r.stage,
          issues: r.issues.map((i) => `${i.code}: ${i.message}`),
        });
      }
    }

    return {
      workspaceId: state.workspaceId,
      businessName: state.businessName,
      region: state.region,
      connection: state.googleConnection,
      destinations: state.destinations.map((d) => ({
        stage: d.stageLabel,
        googleFunction: d.googleFunction,
        actionName: d.googleConversionActionName,
        biddingInfluence: d.biddingInfluence,
        enabled: d.enabled,
      })),
      csvHeadersOnly: state.ingestion.csvHeaders,
      currentMapping: state.ingestion.mapping,
      suggestedMapping: autoSuggestMapping(state.ingestion.csvHeaders),
      validationSummary: {
        totalRows: state.ingestion.rows.length,
        pendingReady: state.metrics.pending,
        quarantined: state.metrics.quarantined,
        issueCounts,
        anonymizedRowIssues: sampleIssueRules,
        lastDryRunPassed: state.validation.lastDryRun?.passed ?? null,
        ownerApproved: state.validation.ownerApproved,
      },
      metrics: state.metrics,
      scheduler: state.scheduler,
      diagnostics: state.diagnostics,
      recentRuns: state.runs.slice(0, 5),
    };
  }
}

export const conversionService = new ZuraConversionService();
