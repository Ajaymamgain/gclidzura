export type UserRole = 'marketer' | 'sales_rep' | 'owner_admin';

export type ActivePage =
  | 'flow_funnel'
  | 'wizard'
  | 'audiences'
  | 'monitor'
  | 'assistant';

export type GoogleFunctionKind =
  | 'offline_conversions'
  | 'enhanced_conversions_leads'
  | 'customer_match';

export type FunnelStageId =
  | 'qualified_lead'
  | 'converted_lead'
  | 'completed_sale';

export type LeadDeskStage =
  | 'new_enquiry'
  | 'qualified_lead'
  | 'converted_lead'
  | 'completed_sale';

export type ScheduleCadence = 'hourly' | 'daily' | 'monthly';

export type ValidationIssueCode =
  | 'MISSING_IDENTIFIER'
  | 'INVALID_TIMESTAMP'
  | 'EXPIRED_90_DAY_WINDOW'
  | 'DUPLICATE_TRANSACTION_ID'
  | 'CONSENT_DENIED_OR_MISSING'
  | 'MISSING_VALUE_FOR_SALE'
  | 'INVALID_CURRENCY';

export interface WhatsAppLeadRecord {
  leadId: string;
  customerName: string;
  propertyArea: string;
  serviceRequest: string;
  emailMasked: string;
  phoneMasked: string;
  gclid: string;
  adCampaign: string;
  consentStatus: 'GRANTED' | 'DENIED';
  currentStage: LeadDeskStage;
  quotedValueSgd: number;
  finalInvoiceSgd: number | null;
  lastMessagePreview: string;
  updatedAt: string;
  syncedStages: FunnelStageId[];
}

export interface ConversionDestination {
  id: string;
  stageId: FunnelStageId | 'audience_retargeting';
  stageLabel: string;
  businessDefinition: string;
  googleFunction: GoogleFunctionKind;
  googleConversionActionId: string;
  googleConversionActionName: string;
  biddingInfluence: 'primary_bidding' | 'secondary_observation' | 'audience_only';
  enabled: boolean;
}

export interface ColumnMapping {
  leadId: string;
  email: string;
  phone: string;
  gclid: string;
  eventTime: string;
  timezone: string;
  value: string;
  currency: string;
  consentStatus: string;
  stage: string;
}

export interface RowIssue {
  code: ValidationIssueCode;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParsedConversionRow {
  rowIndex: number;
  source: 'csv' | 'api';
  leadId: string;
  emailMasked: string;
  phoneMasked: string;
  hasEmail: boolean;
  hasPhone: boolean;
  gclid: string;
  eventTime: string;
  timezone: string;
  value: number | null;
  currency: string;
  consentStatus: 'GRANTED' | 'DENIED' | 'UNSPECIFIED' | string;
  stage: FunnelStageId | string;
  status: 'ready' | 'quarantined' | 'submitted' | 'processed' | 'attributed';
  issues: RowIssue[];
  isCorrected: boolean;
  alreadySent: boolean;
  emailHashPreview?: string;
  phoneHashPreview?: string;
}

export interface DryRunSummary {
  ranAt: string;
  totalRows: number;
  eligibleDeltaRows: number;
  skippedAlreadySent: number;
  quarantinedRows: number;
  issueBreakdown: Record<ValidationIssueCode, number>;
  hashedPayloadSamples: Array<{
    transactionId: string;
    destinationAction: string;
    eventTimeIso: string;
    valueSgd: number | null;
    hashedEmailSha256: string | null;
    hashedPhoneSha256: string | null;
    gclid: string | null;
    consentAdUserData: 'GRANTED';
  }>;
  passed: boolean;
}

export interface DiagnosticItem {
  id: string;
  code:
    | 'PARTIAL_FAILURE_QUARANTINED'
    | 'ENHANCED_MATCH_RATE_OPTIMAL'
    | 'ATTRIBUTION_LAG_WINDOW'
    | 'DUPLICATE_ADJUSTMENT_PREVENTED'
    | 'WEBSITE_TAG_REQUIRED';
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  affectedCount: number;
  timestamp: string;
}

export interface UploadRunRecord {
  runId: string;
  startedAt: string;
  trigger: 'manual_first_live' | 'scheduled_delta' | 'api_batch';
  cadence: ScheduleCadence;
  submitted: number;
  processed: number;
  attributed: number;
  rejected: number;
  skippedDuplicates: number;
  status: 'completed' | 'partial_warnings' | 'paused';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
  category: 'oauth' | 'config' | 'validation' | 'approval' | 'upload' | 'scheduler' | 'api' | 'sales';
}

export interface WorkspaceState {
  workspaceId: string;
  businessName: string;
  region: string;
  currency: string;
  timezone: string;
  rolloutPhase: string;
  googleConnection: {
    connected: boolean;
    accountEmail: string;
    customerAccountId: string;
    customerAccountName: string;
    oauthScope: string;
    grantsCampaignManagement: false;
    websiteTagVerified: boolean;
    gtmEnhancedLeadsEnabled: boolean;
    whatsappLeadBridgeEnabled: boolean;
    lastVerifiedAt: string;
  };
  destinations: ConversionDestination[];
  salesLeads: WhatsAppLeadRecord[];
  ingestion: {
    sourceMode: 'csv' | 'api' | 'both';
    apiEndpoint: string;
    scopedKeyMasked: string;
    scopedKeyFull: string;
    csvFilename: string;
    csvHeaders: string[];
    mapping: ColumnMapping;
    rows: ParsedConversionRow[];
  };
  validation: {
    lastDryRun: DryRunSummary | null;
    ownerApproved: boolean;
    approvedBy: string | null;
    approvedAt: string | null;
  };
  scheduler: {
    active: boolean;
    paused: boolean;
    cadence: ScheduleCadence;
    deltaOnly: true;
    safeRetryEnabled: boolean;
    lastRunAt: string | null;
    nextRunAt: string;
  };
  metrics: {
    pending: number;
    quarantined: number;
    submitted: number;
    processed: number;
    attributed: number;
    customerMatchAudienceCount: number;
    totalAttributedValueSgd: number;
  };
  runs: UploadRunRecord[];
  diagnostics: DiagnosticItem[];
  auditLog: AuditLogEntry[];
}

export interface AssistantToolCallLog {
  name: string;
  summary: string;
  piiExposed: false;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: AssistantToolCallLog[];
  error?: boolean;
}
