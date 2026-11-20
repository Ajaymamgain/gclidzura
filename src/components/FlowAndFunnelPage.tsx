import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import type { WorkspaceState } from '../types/zura.ts';

interface FlowAndFunnelPageProps {
  workspace: WorkspaceState | null;
  onAskAssistant: (prompt: string) => void;
}

type SqlTargetId =
  | 'meeting_booked'
  | 'meeting_held'
  | 'proposal_sent'
  | 'wait_closed_won';

type PresetId =
  | 'sql_meeting_held'
  | 'enhanced_no_gclid'
  | 'ecl_expired_63_lost'
  | 'ecl_expired_63_saved_by_gclid'
  | 'long_cycle_120_day'
  | 'blind_no_conversion'
  | 'customer_match';

type FlowNodeId =
  | 'ad_click'
  | 'website_tag'
  | 'sales_outcome'
  | 'zura_ingest'
  | 'privacy_gate'
  | 'data_manager'
  | 'attribution_core'
  | 'quarantine_bay'
  | 'audience_silo'
  | 'blind_bidding';

interface FlowNodeDef {
  id: FlowNodeId;
  x: number;
  y: number;
  w: number;
  h: number;
  stepTag: string;
  title: string;
  subtitle: string;
  tone: 'default' | 'teal' | 'emerald' | 'rose' | 'indigo' | 'amber';
  description: string;
}

interface FlowEdgeDef {
  id: string;
  from: FlowNodeId;
  to: FlowNodeId;
  d: string;
  label?: string;
  labelX?: number;
  labelY?: number;
  tone: 'main' | 'quarantine' | 'audience' | 'blind';
}

interface DynamicStep {
  nodeId: FlowNodeId;
  edgeFromPrev?: string;
  headline: string;
  detail: string;
  funnelStageIdx: number;
}

interface SimControls {
  gclidPresent: boolean;
  daysSinceClick: number;
  consentGranted: boolean;
  sendConversionApi: boolean;
  audienceOnly: boolean;
}

const FLOW_NODES: FlowNodeDef[] = [
  {
    id: 'ad_click',
    x: 96,
    y: 98,
    w: 158,
    h: 76,
    stepTag: '01',
    title: 'Google Ad Click',
    subtitle: 'Digital Receipt (GCLID)',
    tone: 'default',
    description:
      'Prospect clicks your Google Ad. Google attaches a GCLID receipt and starts both expiry clocks: 63 days for Enhanced Conversions for Leads (ECL) and 90 days for GCLID.',
  },
  {
    id: 'website_tag',
    x: 294,
    y: 98,
    w: 162,
    h: 76,
    stepTag: '02',
    title: 'Website Inquiry',
    subtitle: 'Captures GCLID + Contact',
    tone: 'default',
    description:
      'Your website form captures GCLID and consented email/phone via Google Tag. Raw forms are tracked only—not used as a Primary bidding goal.',
  },
  {
    id: 'sales_outcome',
    x: 498,
    y: 98,
    w: 168,
    h: 76,
    stepTag: '03',
    title: 'Sales SQL Milestone',
    subtitle: 'Meeting Booked / Held',
    tone: 'teal',
    description:
      'Because final sales take 2–5 months (past Google’s expiry windows), Sales logs a short-term SQL milestone (like Discovery Meeting Held) in Days 6–14 with an expected proxy SGD value.',
  },
  {
    id: 'zura_ingest',
    x: 704,
    y: 98,
    w: 164,
    h: 76,
    stepTag: '04',
    title: 'Zura Auto-Sync API',
    subtitle: 'Streams Only New SQLs',
    tone: 'default',
    description:
      'When Sales updates a lead to SQL in the CRM, an automated API event queues only the new milestone—no manual uploads and no duplicates.',
  },
  {
    id: 'privacy_gate',
    x: 924,
    y: 98,
    w: 188,
    h: 76,
    stepTag: '05',
    title: 'Privacy & 63d/90d Gate',
    subtitle: 'SHA-256 · Consent · Expiry',
    tone: 'teal',
    description:
      'Backend scrambles email/phone (SHA-256), verifies customer consent, and checks Google’s official deadlines (63 days for ECL without GCLID; 90 days with GCLID).',
  },
  {
    id: 'blind_bidding',
    x: 126,
    y: 318,
    w: 204,
    h: 78,
    stepTag: 'NO API',
    title: 'Blind Form Bidding',
    subtitle: 'Google Never Sees SQLs',
    tone: 'amber',
    description:
      'If SQLs are not sent back, Google optimizes only for raw website form fills—buying cheap clicks, spam, and no-shows that waste Sales’ calendar.',
  },
  {
    id: 'quarantine_bay',
    x: 368,
    y: 318,
    w: 200,
    h: 78,
    stepTag: 'HELD',
    title: 'Blocked (Past 63d/90d)',
    subtitle: 'Expired or Consent Denied',
    tone: 'rose',
    description:
      'Events past Google’s 63-day ECL or 90-day GCLID limits—or with denied consent—stop safely here. This is why waiting 2–5 months for Closed-Won loses attribution.',
  },
  {
    id: 'audience_silo',
    x: 604,
    y: 318,
    w: 198,
    h: 78,
    stepTag: 'LIST',
    title: 'Customer Match List',
    subtitle: 'Audiences Only (0 SQLs)',
    tone: 'indigo',
    description:
      'Customer Match updates targeting or exclusion audiences across Search, YouTube, and Display. It never reports an SQL or sale to Smart Bidding.',
  },
  {
    id: 'data_manager',
    x: 876,
    y: 224,
    w: 196,
    h: 68,
    stepTag: '06',
    title: 'Sent to Google Ads',
    subtitle: 'Hourly Data Manager API',
    tone: 'default',
    description:
      'Hourly API sync sends approved SQL milestones and their expected SGD proxy value into Google Ads Data Manager.',
  },
  {
    id: 'attribution_core',
    x: 876,
    y: 342,
    w: 214,
    h: 72,
    stepTag: '07',
    title: 'Google Finds More SQLs',
    subtitle: 'Sent → Matched → Credited',
    tone: 'emerald',
    description:
      'Google matches the SQL back to the ad click, credits expected pipeline value, and trains Smart Bidding to find more qualified sales meetings.',
  },
];

const FLOW_EDGES: FlowEdgeDef[] = [
  { id: 'ad_to_tag', from: 'ad_click', to: 'website_tag', d: 'M 175 98 L 213 98', tone: 'main' },
  { id: 'tag_to_sales', from: 'website_tag', to: 'sales_outcome', d: 'M 375 98 L 414 98', tone: 'main' },
  { id: 'sales_to_ingest', from: 'sales_outcome', to: 'zura_ingest', d: 'M 582 98 L 622 98', tone: 'main' },
  { id: 'ingest_to_gate', from: 'zura_ingest', to: 'privacy_gate', d: 'M 786 98 L 830 98', tone: 'main' },
  {
    id: 'sales_to_blind',
    from: 'sales_outcome',
    to: 'blind_bidding',
    d: 'M 498 136 C 498 216, 126 206, 126 279',
    label: 'No SQL Sent (Blind)',
    labelX: 256,
    labelY: 212,
    tone: 'blind',
  },
  {
    id: 'gate_to_quarantine',
    from: 'privacy_gate',
    to: 'quarantine_bay',
    d: 'M 880 136 C 880 210, 368 202, 368 279',
    label: 'Expired (>63d/90d) or Denied',
    labelX: 432,
    labelY: 256,
    tone: 'quarantine',
  },
  {
    id: 'gate_to_audience',
    from: 'privacy_gate',
    to: 'audience_silo',
    d: 'M 914 136 C 914 212, 604 208, 604 279',
    label: 'Audience Only',
    labelX: 626,
    labelY: 256,
    tone: 'audience',
  },
  {
    id: 'gate_to_dm',
    from: 'privacy_gate',
    to: 'data_manager',
    d: 'M 946 136 C 946 170, 876 160, 876 190',
    label: 'SQL Approved',
    labelX: 966,
    labelY: 168,
    tone: 'main',
  },
  {
    id: 'dm_to_attr',
    from: 'data_manager',
    to: 'attribution_core',
    d: 'M 876 258 L 876 306',
    tone: 'main',
  },
];

const PRESETS: Array<{
  id: PresetId;
  label: string;
  controls: SimControls;
}> = [
  {
    id: 'sql_meeting_held',
    label: 'SQL Meeting Held (Day 10)',
    controls: {
      gclidPresent: true,
      daysSinceClick: 10,
      consentGranted: true,
      sendConversionApi: true,
      audienceOnly: false,
    },
  },
  {
    id: 'enhanced_no_gclid',
    label: 'ECL Backup (Day 14)',
    controls: {
      gclidPresent: false,
      daysSinceClick: 14,
      consentGranted: true,
      sendConversionApi: true,
      audienceOnly: false,
    },
  },
  {
    id: 'ecl_expired_63_lost',
    label: 'Day 72 · ECL Expired (>63d)',
    controls: {
      gclidPresent: false,
      daysSinceClick: 72,
      consentGranted: true,
      sendConversionApi: true,
      audienceOnly: false,
    },
  },
  {
    id: 'ecl_expired_63_saved_by_gclid',
    label: 'Day 72 · GCLID Saves (≤90d)',
    controls: {
      gclidPresent: true,
      daysSinceClick: 72,
      consentGranted: true,
      sendConversionApi: true,
      audienceOnly: false,
    },
  },
  {
    id: 'long_cycle_120_day',
    label: 'Closed-Won (Day 120 · Lost)',
    controls: {
      gclidPresent: true,
      daysSinceClick: 120,
      consentGranted: true,
      sendConversionApi: true,
      audienceOnly: false,
    },
  },
  {
    id: 'blind_no_conversion',
    label: 'No Signal (Blind)',
    controls: {
      gclidPresent: true,
      daysSinceClick: 10,
      consentGranted: true,
      sendConversionApi: false,
      audienceOnly: false,
    },
  },
  {
    id: 'customer_match',
    label: 'Audience List (0 SQLs)',
    controls: {
      gclidPresent: false,
      daysSinceClick: 12,
      consentGranted: true,
      sendConversionApi: true,
      audienceOnly: true,
    },
  },
];

function buildDynamicRoute(controls: SimControls): {
  tone: 'emerald' | 'sky' | 'rose' | 'indigo' | 'amber';
  statusText: string;
  steps: DynamicStep[];
} {
  if (controls.audienceOnly) {
    return {
      tone: 'indigo',
      statusText: 'Audience List Only · 0 SQLs Reported',
      steps: [
        {
          nodeId: 'zura_ingest',
          headline: 'Account list sent to Customer Match (not Conversions)',
          detail:
            'Marketer syncs existing customer records for retargeting or excluding accounts from search spend.',
          funnelStageIdx: -1,
        },
        {
          nodeId: 'privacy_gate',
          edgeFromPrev: 'ingest_to_gate',
          headline: 'Emails & phones scrambled (SHA-256) + consent checked',
          detail:
            'Customer identifiers are hashed safely and routed strictly to Google Audiences.',
          funnelStageIdx: -1,
        },
        {
          nodeId: 'audience_silo',
          edgeFromPrev: 'gate_to_audience',
          headline: 'Updated Customer Match list (0 SQL conversions added)',
          detail:
            'Audience targeting updates cleanly without altering Smart Bidding conversion counts.',
          funnelStageIdx: -1,
        },
      ],
    };
  }

  const eclExpired = controls.daysSinceClick > 63;
  const gclidExpired = controls.daysSinceClick > 90;
  const isHardExpired = controls.gclidPresent ? gclidExpired : eclExpired;
  const isLongWait = controls.daysSinceClick > 63;

  const step1: DynamicStep = {
    nodeId: 'ad_click',
    headline: controls.gclidPresent
      ? 'Prospect clicks your Google Ad (GCLID receipt saved)'
      : 'Prospect switches devices (GCLID lost — will use ECL)',
    detail: controls.gclidPresent
      ? 'Google issues a Click ID and starts two clocks: 63 days for Enhanced Conversions for Leads (ECL) and 90 days for GCLID.'
      : 'Without GCLID, attribution relies on Enhanced Conversions for Leads, which expires strictly at 63 days.',
    funnelStageIdx: 0,
  };

  const step2: DynamicStep = {
    nodeId: 'website_tag',
    edgeFromPrev: 'ad_to_tag',
    headline: controls.consentGranted
      ? 'Website inquiry captured + Consent GRANTED'
      : 'Website inquiry records Consent DENIED',
    detail: controls.consentGranted
      ? 'Site saves GCLID + consented email/phone. Raw form fills are tracked only so junk leads never train bidding.'
      : 'Prospect declined ad data sharing; Zura enforces Consent = DENIED automatically.',
    funnelStageIdx: 1,
  };

  const step3: DynamicStep = {
    nodeId: 'sales_outcome',
    edgeFromPrev: 'tag_to_sales',
    headline: isLongWait
      ? `Day ${controls.daysSinceClick}: Team waited for Closed-Won Sale`
      : `Day ${controls.daysSinceClick}: Sales confirms SQL (Meeting Held)`,
    detail: isLongWait
      ? `Waiting ${controls.daysSinceClick} days (2–5 months) for final signature pushes the event past Google’s short attribution window.`
      : `Sales completes the discovery meeting on Day ${controls.daysSinceClick} and logs a qualified SQL with its expected SGD value.`,
    funnelStageIdx: isLongWait ? 4 : 3,
  };

  if (!controls.sendConversionApi) {
    return {
      tone: 'amber',
      statusText: 'Blind Bidding · Google Only Sees Raw Forms',
      steps: [
        step1,
        step2,
        step3,
        {
          nodeId: 'blind_bidding',
          edgeFromPrev: 'sales_to_blind',
          headline: 'Loop broken — Google never learns which leads booked meetings',
          detail:
            'Smart Bidding optimizes for cheap website forms instead of qualified sales meetings, flooding reps with low-intent leads.',
          funnelStageIdx: -1,
        },
      ],
    };
  }

  const step4: DynamicStep = {
    nodeId: 'zura_ingest',
    edgeFromPrev: 'sales_to_ingest',
    headline: 'CRM automatically streams the confirmed milestone to Zura API',
    detail: 'Only this newly confirmed CRM update enters the hourly delta queue.',
    funnelStageIdx: isLongWait ? 4 : 3,
  };

  if (!controls.consentGranted) {
    return {
      tone: 'rose',
      statusText: 'Blocked · Consent Denied',
      steps: [
        step1,
        step2,
        step3,
        step4,
        {
          nodeId: 'privacy_gate',
          edgeFromPrev: 'ingest_to_gate',
          headline: 'Privacy gate stops event (Consent Denied)',
          detail: 'Zura never sends customer identifiers without valid ad consent.',
          funnelStageIdx: -1,
        },
        {
          nodeId: 'quarantine_bay',
          edgeFromPrev: 'gate_to_quarantine',
          headline: 'Held safely (0 unconsented records uploaded)',
          detail: 'Protected automatically for compliance.',
          funnelStageIdx: -1,
        },
      ],
    };
  }

  if (isHardExpired) {
    return {
      tone: 'rose',
      statusText: controls.gclidPresent
        ? `Lost · Day ${controls.daysSinceClick} (>90d Limit)`
        : `ECL Lost · Day ${controls.daysSinceClick} (>63d Limit)`,
      steps: [
        step1,
        step2,
        step3,
        step4,
        {
          nodeId: 'privacy_gate',
          edgeFromPrev: 'ingest_to_gate',
          headline: controls.gclidPresent
            ? `Day ${controls.daysSinceClick}: Both ECL (63d) & GCLID (90d) expired`
            : `Day ${controls.daysSinceClick}: ECL 63-day limit expired (no GCLID)`,
          detail: controls.gclidPresent
            ? `Waiting ${controls.daysSinceClick} days misses Google’s 90-day GCLID and 63-day ECL limits—Google will not import it.`
            : `Enhanced Conversions for Leads expires on Day 63. Without GCLID, Day ${controls.daysSinceClick} is permanently dropped.`,
          funnelStageIdx: 4,
        },
        {
          nodeId: 'quarantine_bay',
          edgeFromPrev: 'gate_to_quarantine',
          headline: 'Blocked — bid on short-term SQL (Day 6–14) instead',
          detail:
            'Optimizing Google Ads on Meeting Booked or Meeting Held captures 100% of attribution well before Day 63.',
          funnelStageIdx: 4,
        },
      ],
    };
  }

  const gclidOnlyAfter63 = controls.gclidPresent && eclExpired && !gclidExpired;
  const eclBackupOnly = !controls.gclidPresent && !eclExpired;

  return {
    tone: eclBackupOnly || gclidOnlyAfter63 ? 'sky' : 'emerald',
    statusText: gclidOnlyAfter63
      ? `Saved by GCLID · Day ${controls.daysSinceClick} (ECL >63d)`
      : eclBackupOnly
        ? `Matched via ECL · Day ${controls.daysSinceClick} (≤63d)`
        : `SQL Credited · Day ${controls.daysSinceClick} (Dual Match)`,
    steps: [
      step1,
      step2,
      step3,
      step4,
      {
        nodeId: 'privacy_gate',
        edgeFromPrev: 'ingest_to_gate',
        headline: gclidOnlyAfter63
          ? `Day ${controls.daysSinceClick}: ECL passed 63d, GCLID still saves it (≤90d)`
          : eclBackupOnly
            ? `Day ${controls.daysSinceClick} ≤ 63d: ECL hashed email/phone recovers match`
            : `Day ${controls.daysSinceClick} ≤ 63d: Both GCLID + ECL ready`,
        detail: gclidOnlyAfter63
          ? 'GCLID keeps matching up to Day 90, though sending SQL earlier (Days 6–14) protects cross-device ECL matches too.'
          : eclBackupOnly
            ? 'Because Sales logged the SQL inside 63 days, hashed first-party contact info recovers the cross-device click.'
            : 'Fast SQL reporting beats both Google deadlines and feeds Smart Bidding fresh revenue-weighted signals.',
        funnelStageIdx: 3,
      },
      {
        nodeId: 'data_manager',
        edgeFromPrev: 'gate_to_dm',
        headline: 'Sent via hourly API to Google Ads Data Manager',
        detail:
          'Verified SQL milestone + expected SGD proxy value delivered cleanly to Primary Bidding.',
        funnelStageIdx: 3,
      },
      {
        nodeId: 'attribution_core',
        edgeFromPrev: 'dm_to_attr',
        headline: 'SQL credited — Google optimizes for more qualified meetings',
        detail:
          'Smart Bidding shifts budget toward searches producing real sales meetings while contracts close over the next 2–5 months.',
        funnelStageIdx: 3,
      },
    ],
  };
}

export function FlowAndFunnelPage({
  workspace,
  onAskAssistant,
}: FlowAndFunnelPageProps) {
  // Interactive Report & Funnel State
  const [adSpend, setAdSpend] = useState<number>(8000);
  const [monthlyInquiries, setMonthlyInquiries] = useState<number>(200);
  const [avgDealValue, setAvgDealValue] = useState<number>(12000);
  const [salesCycleDays, setSalesCycleDays] = useState<number>(120);
  const [sqlTarget, setSqlTarget] = useState<SqlTargetId>('meeting_held');
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(3);

  // Interactive Flowchart State
  const [controls, setControls] = useState<SimControls>(PRESETS[0].controls);
  const [activePreset, setActivePreset] = useState<PresetId | null>('sql_meeting_held');
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState<number>(1350);
  const [selectedNodeId, setSelectedNodeId] = useState<FlowNodeId>('ad_click');

  const [tokenPoint, setTokenPoint] = useState<{ x: number; y: number } | null>(null);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const flowchartRef = useRef<HTMLElement | null>(null);

  // Demand Waterfall Math
  const report = useMemo(() => {
    const inquiries = monthlyInquiries;
    const mqls = Math.round(inquiries * 0.55);
    const sals = Math.round(inquiries * 0.35);
    const meetingBooked = Math.round(inquiries * 0.24);
    const meetingHeld = Math.round(inquiries * 0.17);
    const proposalSent = Math.round(inquiries * 0.1);
    const closedWon = Math.max(1, Math.round(inquiries * 0.04));

    const goalOptions: Record<
      SqlTargetId,
      {
        id: SqlTargetId;
        shortLabel: string;
        stageTitle: string;
        avgDays: number;
        signals: number;
        winRatePct: number;
        proxyValue: number;
        eclSafe: boolean;
        gclidSafe: boolean;
        hits30: boolean;
        summary: string;
      }
    > = {
      meeting_booked: {
        id: 'meeting_booked',
        shortLabel: 'SQL · Meeting Booked',
        stageTitle: 'SQL — Meeting Booked',
        avgDays: 6,
        signals: meetingBooked,
        winRatePct: Math.round((closedWon / Math.max(1, meetingBooked)) * 100),
        proxyValue: Math.round((closedWon / Math.max(1, meetingBooked)) * avgDealValue),
        eclSafe: true,
        gclidSafe: true,
        hits30: meetingBooked >= 30,
        summary:
          'Highest monthly signal volume inside 6 days. Good for smaller budgets, though includes some meeting no-shows.',
      },
      meeting_held: {
        id: 'meeting_held',
        shortLabel: 'SQL · Meeting Held',
        stageTitle: 'SQL — Meeting Held',
        avgDays: 11,
        signals: meetingHeld,
        winRatePct: Math.round((closedWon / Math.max(1, meetingHeld)) * 100),
        proxyValue: Math.round((closedWon / Math.max(1, meetingHeld)) * avgDealValue),
        eclSafe: true,
        gclidSafe: true,
        hits30: meetingHeld >= 30,
        summary:
          'Recommended short-term goal: filters out no-shows, hits ~30+ signals/mo, and lands 52 days before Google’s 63-day ECL cutoff.',
      },
      proposal_sent: {
        id: 'proposal_sent',
        shortLabel: 'SQL · Proposal Sent',
        stageTitle: 'SQL — Proposal Sent',
        avgDays: 24,
        signals: proposalSent,
        winRatePct: Math.round((closedWon / Math.max(1, proposalSent)) * 100),
        proxyValue: Math.round((closedWon / Math.max(1, proposalSent)) * avgDealValue),
        eclSafe: true,
        gclidSafe: true,
        hits30: proposalSent >= 30,
        summary:
          'Strong buying intent inside 24 days, but may fall under ~30 signals/month unless inquiry volume is higher.',
      },
      wait_closed_won: {
        id: 'wait_closed_won',
        shortLabel: 'Closed-Won Sale',
        stageTitle: 'Closed-Won Sale',
        avgDays: salesCycleDays,
        signals: closedWon,
        winRatePct: 100,
        proxyValue: avgDealValue,
        eclSafe: salesCycleDays <= 63,
        gclidSafe: salesCycleDays <= 90,
        hits30: closedWon >= 30,
        summary:
          salesCycleDays > 90
            ? `At ${salesCycleDays} days (${(salesCycleDays / 30).toFixed(1)} mo), both ECL (63d) and GCLID (90d) expire—Google drops these conversions completely.`
            : `Only ${closedWon} signals/month is far below Google’s ~30/mo learning threshold.`,
      },
    };

    const active = goalOptions[sqlTarget];
    const sqlCount = sqlTarget === 'wait_closed_won' ? meetingHeld : active.signals;
    const sqlLabel =
      sqlTarget === 'wait_closed_won' ? 'SQL — Meeting Held' : active.stageTitle;
    const sqlDay = sqlTarget === 'wait_closed_won' ? 11 : active.avgDays;

    const pipelineValue = active.signals * active.proxyValue;
    const costPerSignal = active.signals > 0 ? Math.round(adSpend / active.signals) : 0;
    const roas = adSpend > 0 ? pipelineValue / adSpend : 0;

    // 5 Actual Report Funnel Tiers
    const tiers = [
      {
        idx: 0,
        code: 'Inquiry',
        title: 'Website Inquiries',
        count: inquiries,
        pctOfTop: 100,
        stepConvPct: 100,
        dayLabel: 'Day 0',
        roleLabel: 'Track Only',
        roleKind: 'muted' as const,
        fill: '#334155',
        fillHover: '#1E293B',
        preset: 'blind_no_conversion' as PresetId,
        explanation:
          'All ad clicks that submit a form. Captures GCLID + consented email/phone, but never set as Primary Bidding or Google chases low-intent clicks.',
      },
      {
        idx: 1,
        code: 'MQL',
        title: 'Marketing Qualified',
        count: mqls,
        pctOfTop: Math.round((mqls / inquiries) * 100),
        stepConvPct: Math.round((mqls / inquiries) * 100),
        dayLabel: 'Day 1–2',
        roleLabel: 'Secondary',
        roleKind: 'muted' as const,
        fill: '#0284C7',
        fillHover: '#0369A1',
        preset: 'enhanced_no_gclid' as PresetId,
        explanation:
          'Leads matching territory, budget fit, and service criteria. Tracked as Secondary observation so you can measure funnel health without double-counting.',
      },
      {
        idx: 2,
        code: 'SAL',
        title: 'Sales Accepted',
        count: sals,
        pctOfTop: Math.round((sals / inquiries) * 100),
        stepConvPct: Math.round((sals / Math.max(1, mqls)) * 100),
        dayLabel: 'Day 3–5',
        roleLabel: 'Secondary',
        roleKind: 'muted' as const,
        fill: '#0D9488',
        fillHover: '#0F766E',
        preset: 'sql_meeting_held' as PresetId,
        explanation:
          'Sales accepts the lead and begins booking a discovery call. Kept as Secondary observation until the SQL milestone happens.',
      },
      {
        idx: 3,
        code: 'SQL',
        title: sqlLabel,
        count: sqlCount,
        pctOfTop: Math.round((sqlCount / inquiries) * 100),
        stepConvPct: Math.round((sqlCount / Math.max(1, sals)) * 100),
        dayLabel: `~Day ${sqlDay}`,
        roleLabel:
          sqlTarget === 'wait_closed_won'
            ? 'Skipped'
            : `Primary · SGD ${active.proxyValue.toLocaleString()}`,
        roleKind: sqlTarget === 'wait_closed_won' ? ('amber' as const) : ('primary' as const),
        fill: sqlTarget === 'wait_closed_won' ? '#D97706' : '#059669',
        fillHover: sqlTarget === 'wait_closed_won' ? '#B45309' : '#047857',
        preset: 'sql_meeting_held' as PresetId,
        explanation:
          sqlTarget === 'wait_closed_won'
            ? 'Skipped when waiting for Closed-Won. Switching Primary Bidding back here gives Google clean signals inside 1–2 weeks.'
            : `${active.summary} Sent via hourly API with Proxy Value = ${active.winRatePct}% win rate × SGD ${avgDealValue.toLocaleString()} avg deal.`,
      },
      {
        idx: 4,
        code: 'Closed-Won',
        title: `Closed-Won (${(salesCycleDays / 30).toFixed(1)} mo)`,
        count: closedWon,
        pctOfTop: Math.max(1, Math.round((closedWon / inquiries) * 100)),
        stepConvPct: Math.round((closedWon / Math.max(1, sqlCount)) * 100),
        dayLabel: `Day ${salesCycleDays}`,
        roleLabel:
          salesCycleDays > 90
            ? 'Expired (>90d)'
            : salesCycleDays > 63
              ? 'ECL Expired (>63d)'
              : 'Low Volume',
        roleKind: 'danger' as const,
        fill: sqlTarget === 'wait_closed_won' ? '#DC2626' : '#94A3B8',
        fillHover: sqlTarget === 'wait_closed_won' ? '#B91C1C' : '#64748B',
        preset: 'long_cycle_120_day' as PresetId,
        explanation: `Final signed revenue at Day ${salesCycleDays}. Bypassed for real-time Google Ads bidding because it crosses Google’s 63d ECL / 90d GCLID windows—instead, its win rate prices your SQL above.`,
      },
    ];

    return {
      goalOptions,
      active,
      tiers,
      pipelineValue,
      costPerSignal,
      roas,
    };
  }, [adSpend, monthlyInquiries, avgDealValue, salesCycleDays, sqlTarget]);

  const selectedTier = report.tiers[selectedStageIdx] ?? report.tiers[3];

  // Flowchart route & animation
  const route = useMemo(() => buildDynamicRoute(controls), [controls]);
  const safeStepIdx = Math.min(stepIdx, route.steps.length - 1);
  const currentStep = route.steps[safeStepIdx];

  useEffect(() => {
    setSelectedNodeId(currentStep.nodeId);
  }, [currentStep.nodeId]);

  useEffect(() => {
    const edgeId = currentStep.edgeFromPrev;
    if (!edgeId) {
      const node = FLOW_NODES.find((n) => n.id === currentStep.nodeId);
      setTokenPoint(node ? { x: node.x, y: node.y } : null);
      return;
    }

    const pathEl = pathRefs.current[edgeId];
    if (!pathEl) return;

    const totalLen = pathEl.getTotalLength();
    const duration = Math.min(580, speedMs * 0.44);
    const start = performance.now();
    let raf = 0;

    const animate = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const pt = pathEl.getPointAtLength(eased * totalLen);
      setTokenPoint({ x: pt.x, y: pt.y });
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [currentStep, speedMs]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => {
      if (safeStepIdx < route.steps.length - 1) {
        setStepIdx((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, speedMs);
    return () => window.clearTimeout(timer);
  }, [isPlaying, safeStepIdx, route.steps.length, speedMs]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset.id);
    setControls(preset.controls);
    setStepIdx(0);
    setIsPlaying(true);
  };

  const playPresetById = (presetId: PresetId) => {
    const found = PRESETS.find((p) => p.id === presetId);
    if (found) applyPreset(found);
    flowchartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateControl = (patch: Partial<SimControls>) => {
    setActivePreset(null);
    setControls((prev) => ({
      ...prev,
      ...patch,
      audienceOnly: patch.audienceOnly ?? false,
    }));
    setStepIdx(0);
    setIsPlaying(true);
  };

  const handleSelectGoal = (id: SqlTargetId) => {
    setSqlTarget(id);
    setSelectedStageIdx(id === 'wait_closed_won' ? 4 : 3);
  };

  const visitedNodeIds = useMemo(() => {
    const set = new Set<FlowNodeId>();
    for (let i = 0; i <= safeStepIdx && i < route.steps.length; i++) {
      set.add(route.steps[i].nodeId);
    }
    return set;
  }, [route.steps, safeStepIdx]);

  const visitedEdgeIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i <= safeStepIdx && i < route.steps.length; i++) {
      const e = route.steps[i].edgeFromPrev;
      if (e) set.add(e);
    }
    return set;
  }, [route.steps, safeStepIdx]);

  const inspectedNode =
    FLOW_NODES.find((n) => n.id === selectedNodeId) ?? FLOW_NODES[0];

  const tokenColor =
    route.tone === 'rose'
      ? '#DC2626'
      : route.tone === 'indigo'
        ? '#4F46E5'
        : route.tone === 'amber'
          ? '#D97706'
          : route.tone === 'sky'
            ? '#0284C7'
            : '#0D9488';

  // True Centered Trapezoid Geometry for the 5-Tier Report Funnel SVG
  // Widths smoothly taper from 340px (top) down to 108px (bottom) while staying proportional & legible
  const funnelGeometry = useMemo(() => {
    const cx = 364;
    const minW = 104;
    const maxW = 340;
    const topPct = report.tiers.map((t, idx) => {
      if (idx === 0) return maxW;
      // Blend true conversion ratio with clean geometric taper so small percentages stay readable
      const scaled = minW + Math.pow(t.pctOfTop / 100, 0.58) * (maxW - minW);
      return Math.round(Math.max(minW, Math.min(maxW - idx * 24, scaled)));
    });

    const rowH = 62;
    const gap = 8;
    const cutoffGap = 38; // Extra vertical room for the dashed 63d/90d cutoff wall before Closed-Won

    return report.tiers.map((tier, idx) => {
      const yTop = 18 + idx * (rowH + gap) + (idx === 4 ? cutoffGap : 0);
      const yBot = yTop + rowH;
      const wTop = topPct[idx];
      const wBot = idx < report.tiers.length - 1 ? topPct[idx + 1] : Math.max(82, wTop - 22);
      const x1 = cx - wTop / 2;
      const x2 = cx + wTop / 2;
      const x3 = cx + wBot / 2;
      const x4 = cx - wBot / 2;
      return {
        tier,
        yTop,
        yBot,
        yMid: (yTop + yBot) / 2,
        cx,
        points: `${x1},${yTop} ${x2},${yTop} ${x3},${yBot} ${x4},${yBot}`,
      };
    });
  }, [report.tiers]);

  const cutoffY = funnelGeometry[3].yBot + 23;

  return (
    <div className="space-y-6">
      {/* Page Title & Live Workspace Context */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{workspace?.businessName ?? 'CoolCare Aircon & Home Services'}</span>
            <span aria-hidden="true">·</span>
            <span>Demand Waterfall Report</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">API Auto-Sync</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            SQL Demand Funnel &amp; Conversion Flow
          </h1>
        </div>

        {/* Short-Term Bidding Goal Segmented Picker */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
          {(
            ['meeting_booked', 'meeting_held', 'proposal_sent', 'wait_closed_won'] as const
          ).map((id) => {
            const opt = report.goalOptions[id];
            const active = sqlTarget === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectGoal(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? id === 'wait_closed_won'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Report Filters + 4-Column Dashboard KPI Strip */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Compact Interactive Sliders Row */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Monthly Ad Spend</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                SGD {adSpend.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={30000}
              step={1000}
              value={adSpend}
              onChange={(e) => setAdSpend(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Monthly Inquiries</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {monthlyInquiries} / mo
              </span>
            </div>
            <input
              type="range"
              min={60}
              max={500}
              step={20}
              value={monthlyInquiries}
              onChange={(e) => setMonthlyInquiries(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Avg Closed-Won Deal</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                SGD {avgDealValue.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={50000}
              step={1000}
              value={avgDealValue}
              onChange={(e) => setAvgDealValue(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Sales Closing Cycle</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  salesCycleDays > 90
                    ? 'text-rose-700'
                    : salesCycleDays > 63
                      ? 'text-amber-700'
                      : 'text-teal-700'
                }`}
              >
                {salesCycleDays}d ({(salesCycleDays / 30).toFixed(1)} mo)
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              value={salesCycleDays}
              onChange={(e) => setSalesCycleDays(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Clean 4-Column Executive KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-200">
          <div className="px-5 py-4">
            <div className="text-xs text-slate-500">Signals Sent / Month</div>
            <div
              className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                report.active.hits30 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {report.active.signals}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {report.active.hits30
                ? 'Meets 30+ Smart Bidding target'
                : 'Below 30/mo learning zone'}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="text-xs text-slate-500">Time to Signal</div>
            <div
              className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                report.active.eclSafe
                  ? 'text-emerald-700'
                  : report.active.gclidSafe
                    ? 'text-amber-700'
                    : 'text-rose-700'
              }`}
            >
              Day {report.active.avgDays}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {report.active.eclSafe
                ? 'Inside 63d ECL & 90d GCLID'
                : report.active.gclidSafe
                  ? 'ECL expired (>63d) · GCLID only'
                  : 'Expired (>90d) · Google drops'}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="text-xs text-slate-500">Proxy Value / Signal</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
              SGD {report.active.proxyValue.toLocaleString()}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              {report.active.winRatePct}% win × SGD {avgDealValue.toLocaleString()}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="text-xs text-slate-500">Expected Pipeline ROAS</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-teal-700">
              {report.roas.toFixed(1)}x
            </div>
            <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              Cost / SQL: SGD {report.costPerSignal.toLocaleString()}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: ACTUAL REPORT-STYLE FUNNEL CHART */}
      <section
        id="funnel"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden scroll-mt-20"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Demand Waterfall Funnel
            </h2>
            <p className="text-xs text-slate-500">
              Click any funnel stage to inspect its conversion rate, timing, and Google Ads bidding role.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span>ECL Limit: 63d</span>
            <span aria-hidden="true">·</span>
            <span>GCLID Limit: 90d</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left (8 cols): Actual Centered SVG Trapezoid Funnel Report */}
          <div className="lg:col-span-8 p-5 overflow-x-auto">
            <svg
              viewBox="0 0 740 416"
              className="w-full min-w-[620px] h-auto select-none"
              role="img"
              aria-label="Demand Waterfall Funnel from Inquiries to Closed-Won Sale"
            >
              {/* Subtle column headers like a BI report */}
              <text x={14} y={10} fontSize={10} fontWeight={600} fill="#64748B">
                STAGE
              </text>
              <text
                x={364}
                y={10}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="#64748B"
              >
                MONTHLY VOLUME &amp; % OF INQUIRIES
              </text>
              <text x={556} y={10} fontSize={10} fontWeight={600} fill="#64748B">
                STEP CONV. · GOOGLE ROLE
              </text>

              {/* Dashed Google Expiry Cutoff Line between SQL and Closed-Won */}
              <g>
                <line
                  x1={12}
                  y1={cutoffY}
                  x2={728}
                  y2={cutoffY}
                  stroke="#E11D48"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                />
                <rect
                  x={194}
                  y={cutoffY - 11}
                  width={340}
                  height={22}
                  rx={4}
                  fill="#FFF1F2"
                  stroke="#FECDD3"
                  strokeWidth={1}
                />
                <text
                  x={364}
                  y={cutoffY + 3.5}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="JetBrains Mono, monospace"
                  fill="#BE123C"
                >
                  GOOGLE EXPIRY CUTOFF · ECL 63d · GCLID 90d
                </text>
              </g>

              {/* Funnel Trapezoids */}
              {funnelGeometry.map(({ tier, yMid, cx, points }) => {
                const isSelected = selectedStageIdx === tier.idx;
                const isActiveFlow = currentStep.funnelStageIdx === tier.idx;
                const isPrimaryGoal =
                  (tier.idx === 3 && sqlTarget !== 'wait_closed_won') ||
                  (tier.idx === 4 && sqlTarget === 'wait_closed_won');

                return (
                  <g
                    key={tier.code}
                    onClick={() => setSelectedStageIdx(tier.idx)}
                    className="cursor-pointer group"
                  >
                    {/* Subtle row highlight when selected */}
                    {isSelected && (
                      <rect
                        x={6}
                        y={yMid - 34}
                        width={728}
                        height={68}
                        rx={8}
                        fill="#F8FAFC"
                        stroke="#CBD5E1"
                        strokeWidth={1}
                      />
                    )}

                    {/* Left Label: Stage Name & Timing */}
                    <text
                      x={16}
                      y={yMid - 4}
                      fontSize={12.5}
                      fontWeight={700}
                      fill={isPrimaryGoal ? '#0F172A' : '#1E293B'}
                    >
                      {tier.title}
                    </text>
                    <text
                      x={16}
                      y={yMid + 14}
                      fontSize={11}
                      fontFamily="JetBrains Mono, monospace"
                      fill="#64748B"
                    >
                      {tier.code} · {tier.dayLabel}
                    </text>

                    {/* Center Actual Funnel Trapezoid */}
                    <polygon
                      points={points}
                      fill={isSelected ? tier.fillHover : tier.fill}
                      stroke={
                        isActiveFlow
                          ? '#0F172A'
                          : isPrimaryGoal
                            ? '#047857'
                            : 'none'
                      }
                      strokeWidth={isActiveFlow ? 2.5 : isPrimaryGoal ? 1.5 : 0}
                      opacity={tier.idx === 4 && sqlTarget !== 'wait_closed_won' ? 0.72 : 1}
                    />

                    {/* Crisp Metric Inside Trapezoid */}
                    <text
                      x={cx}
                      y={yMid - 2}
                      textAnchor="middle"
                      fontSize={16}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                      fill="#FFFFFF"
                    >
                      {tier.count}
                    </text>
                    <text
                      x={cx}
                      y={yMid + 15}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontFamily="JetBrains Mono, monospace"
                      fill="rgba(255,255,255,0.88)"
                    >
                      {tier.pctOfTop}% of inquiries
                    </text>

                    {/* Right Column: Step-to-Step Conversion & Google Ads Role */}
                    <text
                      x={556}
                      y={yMid - 4}
                      fontSize={11.5}
                      fontWeight={600}
                      fontFamily="JetBrains Mono, monospace"
                      fill="#334155"
                    >
                      {tier.idx === 0 ? '100% baseline' : `${tier.stepConvPct}% from prev`}
                    </text>
                    <text
                      x={556}
                      y={yMid + 14}
                      fontSize={11}
                      fontWeight={tier.roleKind === 'primary' || tier.roleKind === 'danger' ? 700 : 500}
                      fill={
                        tier.roleKind === 'primary'
                          ? '#047857'
                          : tier.roleKind === 'danger'
                            ? '#BE123C'
                            : tier.roleKind === 'amber'
                              ? '#B45309'
                              : '#64748B'
                      }
                    >
                      {tier.roleLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right (4 cols): Clean Selected Stage Inspector + Verified Google Rules */}
          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 p-6 flex flex-col justify-between gap-6 bg-slate-50/40">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  <span>{selectedTier.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedTier.dayLabel}</span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900">
                  {selectedTier.title}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-200 font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Monthly Volume</div>
                  <div className="mt-0.5 text-lg font-bold text-slate-900">
                    {selectedTier.count} / mo
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Google Ads Role</div>
                  <div
                    className={`mt-0.5 text-xs font-bold leading-snug ${
                      selectedTier.roleKind === 'primary'
                        ? 'text-emerald-700'
                        : selectedTier.roleKind === 'danger'
                          ? 'text-rose-700'
                          : 'text-slate-700'
                    }`}
                  >
                    {selectedTier.roleLabel}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedTier.explanation}
              </p>

              <button
                type="button"
                onClick={() => playPresetById(selectedTier.preset)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Play This Stage in Flowchart</span>
                <ArrowDownRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact Verified Google Rules Reference */}
            <div className="pt-4 border-t border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-900">
                Verified Google Attribution Windows
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Enhanced Conversions (ECL)</span>
                <span className="font-mono font-semibold text-slate-900">63 days</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>GCLID Offline Import</span>
                <span className="font-mono font-semibold text-slate-900">90 days</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Customer Match List</span>
                <span className="font-mono text-slate-500">Audiences only</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onAskAssistant(
                    `Explain our Demand Waterfall funnel (${monthlyInquiries} inquiries/mo, ${salesCycleDays}-day closing cycle, SGD ${avgDealValue} avg deal) and why focusing on ${report.active.stageTitle} beats waiting for Closed-Won.`
                  )
                }
                className="pt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI to explain this funnel</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: INTERACTIVE PLAYABLE FLOWCHART */}
      <section
        id="flowchart"
        ref={flowchartRef}
        className="bg-white border border-slate-200 rounded-xl overflow-hidden scroll-mt-20"
      >
        {/* Toolbar: Play Controls + Scenarios */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                } else {
                  if (safeStepIdx >= route.steps.length - 1) setStepIdx(0);
                  setIsPlaying(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {safeStepIdx >= route.steps.length - 1 ? 'Replay Flow' : 'Play Flow'}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStepIdx((prev) => (prev < route.steps.length - 1 ? prev + 1 : 0));
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Step</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStepIdx(0);
              }}
              aria-label="Reset flowchart"
              className="p-2 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setSpeedMs((s) => (s === 1350 ? 750 : 1350))}
              className="px-2.5 py-2 text-xs font-mono font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {speedMs === 1350 ? '1x' : '2x'}
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg overflow-x-auto max-w-full">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activePreset === preset.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Parameter Controls Strip */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateControl({ gclidPresent: !controls.gclidPresent })}
              className={`px-2.5 py-1.5 font-medium rounded-md border transition-colors whitespace-nowrap ${
                controls.gclidPresent
                  ? 'bg-teal-50 border-teal-300 text-teal-900'
                  : 'bg-sky-50 border-sky-300 text-sky-900'
              }`}
            >
              GCLID: {controls.gclidPresent ? 'Saved' : 'Missing (ECL Backup)'}
            </button>

            <button
              type="button"
              onClick={() => updateControl({ consentGranted: !controls.consentGranted })}
              className={`px-2.5 py-1.5 font-medium rounded-md border transition-colors whitespace-nowrap ${
                controls.consentGranted
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              Consent: {controls.consentGranted ? 'Granted' : 'Denied'}
            </button>

            <button
              type="button"
              onClick={() => updateControl({ sendConversionApi: !controls.sendConversionApi })}
              className={`px-2.5 py-1.5 font-medium rounded-md border transition-colors whitespace-nowrap ${
                controls.sendConversionApi
                  ? 'bg-teal-50 border-teal-300 text-teal-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              API Sync: {controls.sendConversionApi ? 'On' : 'Off (Blind)'}
            </button>
          </div>

          {/* Days From Click Slider */}
          <div className="flex items-center gap-3 min-w-[260px]">
            <span className="text-slate-600 whitespace-nowrap">Days to Signal:</span>
            <input
              type="range"
              min={1}
              max={150}
              value={controls.daysSinceClick}
              onChange={(e) => updateControl({ daysSinceClick: Number(e.target.value) })}
              className="w-32 accent-teal-700 cursor-pointer"
            />
            <span
              className={`font-mono font-semibold tabular-nums whitespace-nowrap ${
                controls.daysSinceClick > 90
                  ? 'text-rose-700'
                  : controls.daysSinceClick > 63
                    ? 'text-amber-700'
                    : 'text-emerald-700'
              }`}
            >
              Day {controls.daysSinceClick}
            </span>
          </div>
        </div>

        {/* SVG Flowchart Canvas */}
        <div className="p-4 overflow-x-auto bg-white">
          <svg
            viewBox="0 0 1080 408"
            className="w-full min-w-[840px] h-auto select-none"
            role="img"
            aria-label="Interactive API conversion flowchart"
          >
            <defs>
              <pattern id="flowGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="0.9" fill="#E2E8F0" />
              </pattern>
              <marker
                id="arrow-muted"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#CBD5E1" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill={tokenColor} />
              </marker>
            </defs>

            <rect x="0" y="0" width="1080" height="408" fill="url(#flowGrid)" rx="10" />

            {/* Edges */}
            {FLOW_EDGES.map((edge) => {
              const isVisited = visitedEdgeIds.has(edge.id);
              const isCurrent = currentStep.edgeFromPrev === edge.id;
              return (
                <g key={edge.id}>
                  <path
                    ref={(el) => {
                      pathRefs.current[edge.id] = el;
                    }}
                    d={edge.d}
                    fill="none"
                    stroke={isVisited ? tokenColor : '#CBD5E1'}
                    strokeWidth={isCurrent ? 3 : isVisited ? 2.4 : 1.75}
                    strokeDasharray={edge.tone === 'main' ? undefined : '5 4'}
                    markerEnd={isVisited ? 'url(#arrow-active)' : 'url(#arrow-muted)'}
                  />
                  {edge.label && edge.labelX && edge.labelY && (
                    <text
                      x={edge.labelX}
                      y={edge.labelY}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={isVisited ? 700 : 500}
                      fill={isVisited ? tokenColor : '#64748B'}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {FLOW_NODES.map((node) => {
              const isActive = currentStep.nodeId === node.id;
              const isVisited = visitedNodeIds.has(node.id);
              const isSelected = selectedNodeId === node.id;

              const left = node.x - node.w / 2;
              const top = node.y - node.h / 2;

              let fill = '#FFFFFF';
              let stroke = '#CBD5E1';
              let tagColor = '#64748B';

              if (node.tone === 'teal') {
                fill = isVisited ? '#F0FDFA' : '#FFFFFF';
                stroke = isVisited ? '#0D9488' : '#CBD5E1';
                tagColor = '#0F766E';
              } else if (node.tone === 'emerald') {
                fill = isVisited ? '#ECFDF5' : '#FFFFFF';
                stroke = isVisited ? '#059669' : '#CBD5E1';
                tagColor = '#047857';
              } else if (node.tone === 'rose') {
                fill = isVisited ? '#FFF1F2' : '#FFFFFF';
                stroke = isVisited ? '#E11D48' : '#CBD5E1';
                tagColor = '#BE123C';
              } else if (node.tone === 'indigo') {
                fill = isVisited ? '#EEF2FF' : '#FFFFFF';
                stroke = isVisited ? '#4F46E5' : '#CBD5E1';
                tagColor = '#4338CA';
              } else if (node.tone === 'amber') {
                fill = isVisited ? '#FFFBEB' : '#FFFFFF';
                stroke = isVisited ? '#D97706' : '#CBD5E1';
                tagColor = '#B45309';
              } else if (isVisited) {
                fill = '#F8FAFC';
                stroke = tokenColor;
              }

              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="cursor-pointer"
                >
                  {isActive && (
                    <rect
                      x={left - 4}
                      y={top - 4}
                      width={node.w + 8}
                      height={node.h + 8}
                      rx={13}
                      fill="none"
                      stroke={tokenColor}
                      strokeWidth={2}
                      opacity={0.35}
                    />
                  )}
                  <rect
                    x={left}
                    y={top}
                    width={node.w}
                    height={node.h}
                    rx={10}
                    fill={fill}
                    stroke={isActive ? tokenColor : isSelected ? '#0F172A' : stroke}
                    strokeWidth={isActive ? 2.4 : isSelected ? 2 : 1.4}
                  />
                  <text
                    x={left + 12}
                    y={top + 19}
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                    fill={tagColor}
                  >
                    {node.stepTag}
                  </text>
                  <text
                    x={left + 12}
                    y={top + 40}
                    fontSize={12.5}
                    fontWeight={700}
                    fill="#0F172A"
                  >
                    {node.title}
                  </text>
                  <text x={left + 12} y={top + 58} fontSize={10.5} fill="#64748B">
                    {node.subtitle}
                  </text>
                </g>
              );
            })}

            {/* Moving Flow Token */}
            {tokenPoint && (
              <g pointerEvents="none">
                <circle cx={tokenPoint.x} cy={tokenPoint.y} r={10} fill={tokenColor} opacity={0.2} />
                <circle
                  cx={tokenPoint.x}
                  cy={tokenPoint.y}
                  r={5.5}
                  fill={tokenColor}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        </div>

        {/* Clean Bottom Step Narration Strip */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/70 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-8 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="font-bold text-slate-900">
                Step {safeStepIdx + 1} / {route.steps.length}
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span
                className={`font-semibold ${
                  route.tone === 'rose'
                    ? 'text-rose-700'
                    : route.tone === 'amber'
                      ? 'text-amber-700'
                      : route.tone === 'indigo'
                        ? 'text-indigo-700'
                        : route.tone === 'sky'
                          ? 'text-sky-700'
                          : 'text-emerald-700'
                }`}
              >
                {route.statusText}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">{currentStep.headline}</div>
            <p className="text-xs text-slate-600 leading-relaxed">{currentStep.detail}</p>
          </div>

          <div className="lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-4 space-y-1">
            <div className="text-[11px] font-mono text-slate-500">
              Selected Node · {inspectedNode.title}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{inspectedNode.description}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
