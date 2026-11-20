import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  KeyRound,
  Lock,
  Play,
  Send,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import type {
  ColumnMapping,
  ConversionDestination,
  FunnelStageId,
  ScheduleCadence,
  UserRole,
  WorkspaceState,
} from '../types/zura.ts';

interface SetupWizardProps {
  workspace: WorkspaceState;
  role: UserRole;
  activeStep: number;
  busy: boolean;
  onStepChange: (step: number) => void;
  onSwitchRole: (role: UserRole) => void;
  onUpdateConnection: (patch: Partial<WorkspaceState['googleConnection']>) => Promise<void>;
  onUpdateDestination: (id: string, patch: Partial<ConversionDestination>) => Promise<void>;
  onIngestApiEvent: (payload: {
    leadId: string;
    email: string;
    phone: string;
    gclid: string;
    eventTime: string;
    value: number;
    stage: FunnelStageId;
    consentStatus: string;
  }) => Promise<void>;
  onUpdateMapping: (mapping: ColumnMapping) => Promise<void>;
  onFixRow: (
    rowIndex: number,
    fixes: {
      leadId?: string;
      email?: string;
      phone?: string;
      eventTime?: string;
      value?: string;
      consentStatus?: string;
    }
  ) => Promise<void>;
  onRunDryValidation: () => Promise<void>;
  onApproveFirstLive: (approvedBy: string) => Promise<void>;
  onExecuteLiveRun: () => Promise<void>;
  onUpdateSchedule: (patch: {
    cadence?: ScheduleCadence;
    paused?: boolean;
    safeRetryEnabled?: boolean;
  }) => Promise<void>;
  onOpenMonitor: () => void;
  onAskAssistant: (prompt: string) => void;
}

const STEP_META = [
  { step: 1, label: '1. Connect Google' },
  { step: 2, label: '2. Destinations' },
  { step: 3, label: '3. Ingestion API' },
  { step: 4, label: '4. Schema & Preview' },
  { step: 5, label: '5. Validate & Approve' },
  { step: 6, label: '6. Schedule' },
];

export function SetupWizardDrawer({
  workspace,
  role,
  activeStep,
  busy,
  onStepChange,
  onSwitchRole,
  onUpdateConnection,
  onUpdateDestination,
  onIngestApiEvent,
  onUpdateMapping,
  onFixRow,
  onRunDryValidation,
  onApproveFirstLive,
  onExecuteLiveRun,
  onUpdateSchedule,
  onOpenMonitor,
  onAskAssistant,
}: SetupWizardProps) {
  const [approverName, setApproverName] = useState('Wei Jun Lim (Workspace Owner — CoolCare SG)');
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const [apiLeadId, setApiLeadId] = useState(
    () => `SG-LEAD-${Math.floor(9300 + Math.random() * 600)}`
  );
  const [apiEmail, setApiEmail] = useState('hannah.tan@example.sg');
  const [apiPhone, setApiPhone] = useState('+6591882450');
  const [apiGclid, setApiGclid] = useState('EAIaIQobChMI9a7x_SG_LIVE');
  const [apiEventTime, setApiEventTime] = useState('2026-11-18T16:40:00+08:00');
  const [apiValue, setApiValue] = useState('720');
  const [apiStage, setApiStage] = useState<FunnelStageId>('completed_sale');
  const [apiConsent, setApiConsent] = useState<'GRANTED' | 'DENIED'>('GRANTED');
  const [apiFeedback, setApiFeedback] = useState<string | null>(null);

  const applyApiPreset = (preset: 'valid_sale' | 'enhanced_no_gclid' | 'expired_90d' | 'denied') => {
    const nextId = `SG-LEAD-${Math.floor(9300 + Math.random() * 600)}`;
    setApiLeadId(nextId);
    setApiFeedback(null);
    if (preset === 'valid_sale') {
      setApiEmail('hannah.tan@example.sg');
      setApiPhone('+6591882450');
      setApiGclid('EAIaIQobChMI9a7x_SG_LIVE');
      setApiEventTime('2026-11-18T16:40:00+08:00');
      setApiValue('720');
      setApiStage('completed_sale');
      setApiConsent('GRANTED');
    } else if (preset === 'enhanced_no_gclid') {
      setApiEmail('farah.aziz@example.sg');
      setApiPhone('+6587421190');
      setApiGclid('');
      setApiEventTime('2026-11-18T14:15:00+08:00');
      setApiValue('480');
      setApiStage('converted_lead');
      setApiConsent('GRANTED');
    } else if (preset === 'expired_90d') {
      setApiEmail('older.deal@example.sg');
      setApiPhone('+6596334022');
      setApiGclid('EAIaIQobChMI9a7x_SG_OLD');
      setApiEventTime('2026-07-05T10:30:00+08:00');
      setApiValue('890');
      setApiStage('completed_sale');
      setApiConsent('GRANTED');
    } else {
      setApiEmail('opted.out@example.sg');
      setApiPhone('+6581229901');
      setApiGclid('EAIaIQobChMI9a7x_SG_OPT');
      setApiEventTime('2026-11-18T15:00:00+08:00');
      setApiValue('560');
      setApiStage('completed_sale');
      setApiConsent('DENIED');
    }
  };

  const handleSendApiEvent = async () => {
    setApiFeedback(null);
    try {
      await onIngestApiEvent({
        leadId: apiLeadId.trim(),
        email: apiEmail.trim(),
        phone: apiPhone.trim(),
        gclid: apiGclid.trim(),
        eventTime: apiEventTime.trim(),
        value: Number(apiValue) || 0,
        stage: apiStage,
        consentStatus: apiConsent,
      });
      setApiFeedback(
        `Queued ${apiLeadId.trim()} via Zura Event-Ingestion API. Check Step 4 to inspect validation.`
      );
      setApiLeadId(`SG-LEAD-${Math.floor(9300 + Math.random() * 600)}`);
    } catch (err) {
      setApiFeedback((err as Error).message);
    }
  };

  const liveCurlSnippet = `curl -X POST ${workspace.ingestion.apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-Zura-Ingestion-Key: ${workspace.ingestion.scopedKeyMasked}" \\
  -d '${JSON.stringify(
    {
      leadId: apiLeadId,
      email: apiEmail,
      phone: apiPhone,
      gclid: apiGclid || undefined,
      eventTime: apiEventTime,
      timezone: workspace.timezone,
      value: Number(apiValue) || 0,
      currency: workspace.currency,
      consentStatus: apiConsent,
      stage: apiStage,
    },
    null,
    2
  )}'`;

  const handleCopyCurl = () => {
    void navigator.clipboard?.writeText(liveCurlSnippet);
    setCopiedCurl(true);
    window.setTimeout(() => setCopiedCurl(false), 1800);
  };

  const mappingFields: Array<{ key: keyof ColumnMapping; label: string }> = [
    { key: 'leadId', label: 'Stable Lead / Tx ID' },
    { key: 'email', label: 'Customer Email (SHA-256)' },
    { key: 'phone', label: 'Contact Phone E.164 (SHA-256)' },
    { key: 'gclid', label: 'Google Click ID (GCLID)' },
    { key: 'eventTime', label: 'Outcome Timestamp (≤90d)' },
    { key: 'timezone', label: 'Timezone' },
    { key: 'value', label: 'Outcome Value (SGD)' },
    { key: 'currency', label: 'Currency Code' },
    { key: 'consentStatus', label: 'ad_user_data Consent' },
    { key: 'stage', label: 'Sales Funnel Stage' },
  ];

  const quarantinedRows = workspace.ingestion.rows.filter((r) => r.status === 'quarantined');
  const canApprove = role === 'owner_admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Google Conversions API</span>
            <span aria-hidden="true">·</span>
            <span>Guided Setup</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{workspace.workspaceId}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            API Conversion Pipeline Setup Wizard
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            onAskAssistant(
              activeStep === 4
                ? 'Review our API payload schema field mapping and explain all quarantined validation errors including 90-day window expirations.'
                : activeStep === 6
                  ? 'Propose the right hourly vs daily API delta schedule cadence so deals never miss the 90-day conversion window.'
                  : 'Check our Google Data Manager API connection, website tag readiness, and conversion destinations.'
            )
          }
          className="px-3.5 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap"
        >
          Ask Assistant About Step {activeStep}
        </button>
      </div>

      {/* 6-Step Horizontal Stepper */}
      <div className="flex items-center gap-1 p-1.5 bg-slate-200/70 rounded-xl overflow-x-auto">
        {STEP_META.map((item) => {
          const isActive = item.step === activeStep;
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => onStepChange(item.step)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Main Step Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        {/* STEP 1: CONNECT GOOGLE */}
        {activeStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                Google Data Manager OAuth &amp; Account Isolation
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Authorize the customer&apos;s own Google Ads account using the narrow{' '}
                <code className="font-mono text-xs text-teal-800 bg-teal-50 px-1 py-0.5 rounded">
                  datamanager
                </code>{' '}
                scope for{' '}
                <code className="font-mono text-xs text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
                  events:ingest
                </code>
                . This does not grant campaign-management access or modify account permissions.
              </p>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-slate-50/50 text-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-500">Customer Account ID</span>
                  <span className="font-mono font-medium text-slate-900">
                    {workspace.googleConnection.customerAccountId}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-500">Authorized Identity</span>
                  <span className="text-slate-900">{workspace.googleConnection.accountEmail}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-500">Verified Scope</span>
                  <span className="font-mono text-xs text-teal-800">
                    auth/datamanager (events:ingest)
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-500">Campaign Management Access</span>
                  <span className="text-slate-700 font-medium">Not Requested (Blocked)</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onUpdateConnection({ connected: !workspace.googleConnection.connected })
                  }
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    workspace.googleConnection.connected
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-teal-700 hover:bg-teal-800 text-white'
                  }`}
                >
                  {workspace.googleConnection.connected
                    ? 'OAuth Verified — Toggle Connection'
                    : 'Authorize Google Data Manager'}
                </button>
                <span className="text-xs text-slate-500">
                  {workspace.googleConnection.connected ? 'Connected' : 'Disconnected'} · Encrypted
                  credentials isolated to workspace
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                Website Tagging &amp; Enhanced Conversions Prerequisites
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Google OAuth does not install website tagging automatically. Enhanced Conversions
                for Leads requires first-party data capture through the Google tag or Tag Manager
                and a stable Lead ID that persists from website enquiry through CRM sale.
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={workspace.googleConnection.websiteTagVerified}
                    onChange={(e) =>
                      onUpdateConnection({ websiteTagVerified: e.target.checked })
                    }
                    className="mt-1 accent-teal-700"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-slate-900">
                      Google Tag / Tag Manager captures GCLID &amp; first-party identifiers
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Retains GCLID/GBRAID/WBRAID click parameters and consented customer email or
                      phone on the enquiry form.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={workspace.googleConnection.gtmEnhancedLeadsEnabled}
                    onChange={(e) =>
                      onUpdateConnection({ gtmEnhancedLeadsEnabled: e.target.checked })
                    }
                    className="mt-1 accent-teal-700"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-slate-900">
                      Enhanced Conversions for Leads enabled in Google Ads
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Customer terms accepted inside account{' '}
                      <span className="font-mono">
                        {workspace.googleConnection.customerAccountId}
                      </span>
                      .
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={workspace.googleConnection.whatsappLeadBridgeEnabled}
                    onChange={(e) =>
                      onUpdateConnection({ whatsappLeadBridgeEnabled: e.target.checked })
                    }
                    className="mt-1 accent-teal-700"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-slate-900">
                      Stable Lead ID links Website Form → CRM / Sales Outcome
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Preserves a persistent{' '}
                      <span className="font-mono text-slate-700">SG-LEAD-*</span> identifier and
                      original click timestamp so outcomes report within the 90-day window.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DESTINATIONS */}
        {activeStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Choose Conversion Destinations &amp; Bidding Influence
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                The business defines what &ldquo;qualified&rdquo; and &ldquo;completed&rdquo; mean.
                Zura maps confirmed API outcomes to Google conversion actions without treating every
                funnel stage as another sale.
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              {workspace.destinations.map((dest) => {
                const isAudience = dest.googleFunction === 'customer_match';
                return (
                  <div
                    key={dest.id}
                    className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                  >
                    <div className="lg:col-span-4 space-y-1">
                      <div className="text-sm font-semibold text-slate-900">{dest.stageLabel}</div>
                      <div className="text-xs text-slate-600 leading-relaxed">
                        {dest.businessDefinition}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Function: {dest.googleFunction.replace(/_/g, ' ')}
                      </div>
                    </div>

                    <div className="lg:col-span-4 space-y-1">
                      <label className="block text-xs font-medium text-slate-500">
                        Google Ads Conversion Action / User List
                      </label>
                      <input
                        type="text"
                        value={dest.googleConversionActionName}
                        onChange={(e) =>
                          onUpdateDestination(dest.id, {
                            googleConversionActionName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-teal-600"
                      />
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        {dest.googleConversionActionId}
                      </div>
                    </div>

                    <div className="lg:col-span-4 flex items-center lg:justify-end">
                      {isAudience ? (
                        <span className="text-xs font-medium text-indigo-700">
                          Audience Only · Excluded from Sales Bidding
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateDestination(dest.id, {
                                biddingInfluence: 'primary_bidding',
                              })
                            }
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                              dest.biddingInfluence === 'primary_bidding'
                                ? 'bg-teal-700 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Primary Bidding
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateDestination(dest.id, {
                                biddingInfluence: 'secondary_observation',
                              })
                            }
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                              dest.biddingInfluence === 'secondary_observation'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Secondary Only
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: CONNECT ZURA EVENT-INGESTION API (100% API-ONLY) */}
        {activeStep === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: API Contract & Live cURL Example */}
            <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/40 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-teal-700" />
                    <h2 className="text-sm font-semibold text-slate-900">
                      Zura Event-Ingestion API Contract
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {workspace.ingestion.rows.length} API events staged
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Push confirmed sales outcomes directly from your CRM, backend webhook, or booking
                  system. Raw PII is SHA-256 hashed in backend code before reaching Google Data
                  Manager API.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-white border border-slate-200">
                    <span className="text-slate-500">Endpoint</span>
                    <span className="font-mono font-semibold text-slate-900">
                      POST {workspace.ingestion.apiEndpoint}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-white border border-slate-200">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Scoped Workspace Key</span>
                    </span>
                    <span className="font-mono text-slate-900">
                      {workspace.ingestion.scopedKeyMasked}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-white border border-slate-200">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-teal-700" />
                      <span>Attribution Cutoff Enforced</span>
                    </span>
                    <span className="font-mono text-slate-900">≤ 90 Days (ISO +08:00)</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">Live JSON Webhook Example</span>
                    <button
                      type="button"
                      onClick={handleCopyCurl}
                      className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto leading-relaxed">
                    {liveCurlSnippet}
                  </pre>
                </div>
              </div>
            </div>

            {/* Right: Interactive Live API Event Tester */}
            <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/40">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Interactive API Event Tester
                </h2>
                <span className="text-xs font-mono text-teal-700">Delta-Only Queue</span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500">
                  Load a test payload to see how Zura validates it in Step 4:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyApiPreset('valid_sale')}
                    className="px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-300 hover:border-teal-600 text-slate-700 rounded-md"
                  >
                    Valid Sale + GCLID
                  </button>
                  <button
                    type="button"
                    onClick={() => applyApiPreset('enhanced_no_gclid')}
                    className="px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-300 hover:border-sky-600 text-slate-700 rounded-md"
                  >
                    Enhanced Lead (No GCLID)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyApiPreset('expired_90d')}
                    className="px-2.5 py-1 text-[11px] font-medium bg-white border border-rose-300 hover:border-rose-600 text-rose-700 rounded-md"
                  >
                    Test &gt;90-Day Gap
                  </button>
                  <button
                    type="button"
                    onClick={() => applyApiPreset('denied')}
                    className="px-2.5 py-1 text-[11px] font-medium bg-white border border-amber-300 hover:border-amber-600 text-amber-800 rounded-md"
                  >
                    Test Denied Consent
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Lead / Event ID</label>
                  <input
                    value={apiLeadId}
                    onChange={(e) => setApiLeadId(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Confirmed Stage</label>
                  <select
                    value={apiStage}
                    onChange={(e) => setApiStage(e.target.value as FunnelStageId)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900"
                  >
                    <option value="qualified_lead">Qualified Lead</option>
                    <option value="converted_lead">Converted Lead</option>
                    <option value="completed_sale">Completed Sale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Customer Email</label>
                  <input
                    value={apiEmail}
                    onChange={(e) => setApiEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Contact Phone (E.164)
                  </label>
                  <input
                    value={apiPhone}
                    onChange={(e) => setApiPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    GCLID (Optional if ECL)
                  </label>
                  <input
                    value={apiGclid}
                    placeholder="Leave blank to test Enhanced Leads"
                    onChange={(e) => setApiGclid(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Outcome Timestamp (ISO)
                  </label>
                  <input
                    value={apiEventTime}
                    onChange={(e) => setApiEventTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">SGD Value</label>
                  <input
                    type="number"
                    value={apiValue}
                    onChange={(e) => setApiValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 font-mono bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    ad_user_data Consent
                  </label>
                  <select
                    value={apiConsent}
                    onChange={(e) => setApiConsent(e.target.value as 'GRANTED' | 'DENIED')}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900"
                  >
                    <option value="GRANTED">GRANTED</option>
                    <option value="DENIED">DENIED</option>
                  </select>
                </div>
              </div>

              {apiFeedback && (
                <div className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
                  {apiFeedback}
                </div>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSendApiEvent()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>POST Test Event to Ingestion API</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SCHEMA MAP & PREVIEW */}
        {activeStep === 4 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  API Payload Schema Mapping &amp; Pre-Flight Quarantine Preview
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Surface missing identifiers, expired &gt;90-day timestamps, duplicate transaction
                  IDs, and consent blocks before anything reaches Google Data Manager.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-teal-700 font-semibold">
                  {workspace.metrics.pending} Delta-Ready
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-rose-700 font-semibold">
                  {workspace.metrics.quarantined} Quarantined
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-500">{workspace.metrics.submitted} Already Sent</span>
              </div>
            </div>

            {/* Schema Mapper Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 rounded-lg border border-slate-200 bg-slate-50/70">
              {mappingFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                    {field.label}
                  </label>
                  <select
                    value={workspace.ingestion.mapping[field.key]}
                    onChange={(e) =>
                      onUpdateMapping({
                        ...workspace.ingestion.mapping,
                        [field.key]: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-600"
                  >
                    <option value="">(Unmapped)</option>
                    {workspace.ingestion.csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Quarantined Rows Resolution Panel */}
            {quarantinedRows.length > 0 && (
              <div className="p-4 rounded-lg border border-amber-300 bg-amber-50/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-900 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {quarantinedRows.length} Quarantined API Event(s) — Blocked Before Upload
                    </span>
                  </div>
                  <span className="text-xs text-amber-800">
                    Protects against 90-day drops, consent violations &amp; adjustment replays
                  </span>
                </div>

                <div className="space-y-2">
                  {quarantinedRows.map((row) => (
                    <div
                      key={row.rowIndex}
                      className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-md bg-white border border-amber-200 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-mono font-semibold text-slate-900">
                          Event #{row.rowIndex} · {row.leadId} · {row.stage}
                        </div>
                        {row.issues.map((iss, idx) => (
                          <div key={idx} className="text-rose-700">
                            {iss.code}: {iss.message}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {row.issues.some((i) => i.code === 'MISSING_IDENTIFIER') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onFixRow(row.rowIndex, {
                                email: `recovered.${row.rowIndex}@example.sg`,
                                phone: `+65980010${row.rowIndex}`,
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
                          >
                            Attach Verified Contact
                          </button>
                        )}
                        {row.issues.some((i) => i.code === 'INVALID_TIMESTAMP') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onFixRow(row.rowIndex, {
                                eventTime: '2026-11-18T17:45:00+08:00',
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
                          >
                            Normalize ISO +08:00
                          </button>
                        )}
                        {row.issues.some((i) => i.code === 'EXPIRED_90_DAY_WINDOW') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onFixRow(row.rowIndex, {
                                eventTime: '2026-11-15T11:00:00+08:00',
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
                          >
                            Update Within 90-Day Window
                          </button>
                        )}
                        {row.issues.some((i) => i.code === 'DUPLICATE_TRANSACTION_ID') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onFixRow(row.rowIndex, {
                                leadId: `${row.leadId}-REV2`,
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
                          >
                            Assign Unique ID
                          </button>
                        )}
                        {row.issues.some((i) => i.code === 'CONSENT_DENIED_OR_MISSING') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onFixRow(row.rowIndex, {
                                consentStatus: 'GRANTED',
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
                          >
                            Record Granted Consent
                          </button>
                        )}
                        {row.issues.some((i) => i.code === 'MISSING_VALUE_FOR_SALE') && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onFixRow(row.rowIndex, {
                                value: '540',
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
                          >
                            Enter Invoice SGD 540
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Masked Data Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-2.5 px-3 font-semibold">Event</th>
                    <th className="py-2.5 px-3 font-semibold">Source</th>
                    <th className="py-2.5 px-3 font-semibold">Lead / Tx ID</th>
                    <th className="py-2.5 px-3 font-semibold">Masked 1P Identifiers</th>
                    <th className="py-2.5 px-3 font-semibold">Stage</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Value</th>
                    <th className="py-2.5 px-3 font-semibold">Consent</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  {workspace.ingestion.rows.map((r) => (
                    <tr key={r.rowIndex} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500">#{r.rowIndex}</td>
                      <td className="py-2.5 px-3 font-sans uppercase text-[11px] text-teal-700 font-medium">
                        API
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{r.leadId}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {r.emailMasked} / {r.phoneMasked}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-700">{r.stage}</td>
                      <td className="py-2.5 px-3 text-right text-slate-900">
                        {r.value !== null ? `${r.currency} ${r.value.toLocaleString()}` : '—'}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-medium ${
                          r.consentStatus === 'GRANTED' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {r.consentStatus}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-sans font-semibold ${
                          r.status === 'quarantined'
                            ? 'text-rose-700'
                            : r.status === 'ready'
                              ? 'text-teal-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {r.status === 'ready'
                          ? r.isCorrected
                            ? 'Ready (Corrected)'
                            : 'Ready (Delta)'
                          : r.status === 'quarantined'
                            ? 'Quarantined'
                            : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 5: VALIDATE & APPROVE */}
        {activeStep === 5 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    1. Dry-Run Validation (Zero Upload)
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-500">validateOnly: true</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Runs deterministic backend SHA-256 hashing, 90-day attribution window checks,
                consent enforcement, and delta deduplication without sending records to Google Data
                Manager.
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={onRunDryValidation}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Run Dry-Run Validation</span>
              </button>

              {workspace.validation.lastDryRun && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="grid grid-cols-3 gap-3 text-center font-mono tabular-nums">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <div className="text-lg font-semibold text-teal-700">
                        {workspace.validation.lastDryRun.eligibleDeltaRows}
                      </div>
                      <div className="text-[11px] font-sans text-slate-500">Delta Ready</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <div className="text-lg font-semibold text-rose-700">
                        {workspace.validation.lastDryRun.quarantinedRows}
                      </div>
                      <div className="text-[11px] font-sans text-slate-500">Quarantined</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <div className="text-lg font-semibold text-slate-700">
                        {workspace.validation.lastDryRun.skippedAlreadySent}
                      </div>
                      <div className="text-[11px] font-sans text-slate-500">Already Sent</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-700">
                      SHA-256 Hashed API Payload Preview (PII Never Sent Raw)
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-52">
                      {JSON.stringify(
                        workspace.validation.lastDryRun.hashedPayloadSamples.slice(0, 2),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 p-5 rounded-lg border border-slate-200 bg-slate-50/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    2. Owner / Admin Approval &amp; First Live Run
                  </h2>
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {workspace.validation.ownerApproved ? 'Approved' : 'Awaiting Approval'}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                The first live API run into Google Ads requires explicit Owner/Admin approval after
                reviewing destinations, bidding roles, and dry-run SHA-256 payloads.
              </p>

              {!canApprove && !workspace.validation.ownerApproved && (
                <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-900 space-y-2">
                  <div>
                    You are currently viewing as{' '}
                    <strong>{role === 'marketer' ? 'Marketer' : 'Sales Rep'}</strong>. Owner/Admin
                    permission is required to sign off on the first live API run.
                  </div>
                  <button
                    type="button"
                    onClick={() => onSwitchRole('owner_admin')}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Switch to Owner / Admin View to Approve
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Approving Owner / Admin
                  </label>
                  <input
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    disabled={workspace.validation.ownerApproved || !canApprove}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspace.validation.ownerApproved || approvalChecked}
                    disabled={workspace.validation.ownerApproved || !canApprove}
                    onChange={(e) => setApprovalChecked(e.target.checked)}
                    className="mt-0.5 accent-teal-700"
                  />
                  <span>
                    I confirm that conversion stages, bidding influence settings, 90-day window
                    enforcement, consent gating, and delta-only API deduplication are verified for
                    live Google Data Manager delivery.
                  </span>
                </label>

                {!workspace.validation.ownerApproved ? (
                  <button
                    type="button"
                    disabled={busy || !canApprove || !approvalChecked}
                    onClick={() => onApproveFirstLive(approverName)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-45 rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve First Live Run</span>
                  </button>
                ) : (
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <div className="text-xs font-medium text-emerald-700">
                      Approved by {workspace.validation.approvedBy}
                    </div>
                    <button
                      type="button"
                      disabled={busy || workspace.metrics.pending === 0}
                      onClick={async () => {
                        await onExecuteLiveRun();
                        onOpenMonitor();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 rounded-lg transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        Submit {workspace.metrics.pending} Delta Event(s) to Google Data Manager
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: SCHEDULE */}
        {activeStep === 6 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Delta-Only API Delivery Schedule
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Only new or deliberately corrected API events are dispatched—preventing accidental
                  replays and keeping every deal comfortably inside the 90-day conversion window.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenMonitor}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Open Monitor &amp; Diagnostics
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  {
                    id: 'hourly',
                    title: 'Hourly (Recommended Default)',
                    desc: 'Best for ongoing API lead outcomes so Smart Bidding receives fresh confirmed conversions well within the 90-day attribution window.',
                  },
                  {
                    id: 'daily',
                    title: 'Daily Batch',
                    desc: 'Suitable for businesses updating CRM or invoice records once per day at 09:00 SGT.',
                  },
                  {
                    id: 'monthly',
                    title: 'Monthly Reconciliation',
                    desc: 'Useful for month-end audits; not recommended as default because slow reporting risks crossing Google Ads 90-day attribution limits.',
                  },
                ] as const
              ).map((opt) => {
                const selected = workspace.scheduler.cadence === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onUpdateSchedule({ cadence: opt.id })}
                    className={`text-left p-4 rounded-lg border transition-colors ${
                      selected
                        ? 'border-teal-600 bg-teal-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{opt.title}</div>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50/60">
              <div className="space-y-0.5 text-xs">
                <div className="text-slate-900 font-semibold">
                  Scheduler Status: {workspace.scheduler.paused ? 'Paused' : 'Active (Delta-Only)'}
                </div>
                <div className="text-slate-500 font-mono">
                  Next Run: {workspace.scheduler.nextRunAt}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUpdateSchedule({ paused: !workspace.scheduler.paused })}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg transition-colors"
                >
                  {workspace.scheduler.paused ? 'Resume Scheduler' : 'Pause Scheduler'}
                </button>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspace.scheduler.safeRetryEnabled}
                    onChange={(e) => onUpdateSchedule({ safeRetryEnabled: e.target.checked })}
                    className="accent-teal-700"
                  />
                  <span>Controlled Retries (No Blind Replay)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            disabled={activeStep <= 1}
            onClick={() => onStepChange(activeStep - 1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-35 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous Step</span>
          </button>

          <span className="text-xs font-mono text-slate-500">Step {activeStep} of 6</span>

          {activeStep < 6 ? (
            <button
              type="button"
              onClick={() => onStepChange(activeStep + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <span>Next Step</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenMonitor}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              <span>Open Live Monitor</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
