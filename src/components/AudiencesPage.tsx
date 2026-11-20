import { useState } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import type { WorkspaceState } from '../types/zura.ts';

interface AudiencesPageProps {
  workspace: WorkspaceState;
  busy: boolean;
  onSyncAudience: (addedCount: number) => Promise<void>;
  onNavigateConversions: () => void;
}

export function AudiencesPage({
  workspace,
  busy,
  onSyncAudience,
  onNavigateConversions,
}: AudiencesPageProps) {
  const [deltaBatch, setDeltaBatch] = useState('35');
  const audienceDest = workspace.destinations.find((d) => d.googleFunction === 'customer_match');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Google Audiences</span>
            <span aria-hidden="true">·</span>
            <span>Customer Match</span>
            <span aria-hidden="true">·</span>
            <span>Strictly Separated from Offline Conversions</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Google Audiences (Customer Match)
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Customer Match adds hashed first-party contacts to Google Ads audiences for seasonal
            reminders or exclusions. Uploading an audience never reports a qualified lead or a
            completed sale.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateConversions}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
        >
          <span>Go to Google Conversions Setup</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Audience Card + Explicit Separation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-indigo-700 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {audienceDest?.googleConversionActionName ?? 'SG_Annual_Servicing_CRM_Audience'}
                </h2>
                <div className="text-xs font-mono text-slate-500 mt-0.5">
                  {audienceDest?.googleConversionActionId}
                </div>
              </div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-2xl font-semibold text-indigo-700">
                {workspace.metrics.customerMatchAudienceCount.toLocaleString()}
              </div>
              <div className="text-xs font-sans text-slate-500">Matched audience members</div>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            {audienceDest?.businessDefinition ??
              'Past annual aircon servicing customers synced to Google Audiences for seasonal reminders.'}
          </p>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                New Consented CRM Contacts to Sync (SHA-256 Hashed)
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={deltaBatch}
                onChange={(e) => setDeltaBatch(e.target.value)}
                className="w-36 px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => onSyncAudience(Number(deltaBatch) || 35)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Audience List Only</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Guardrail: Audience ≠ Conversion
            </h2>
          </div>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              Syncing members here updates your Google Ads{' '}
              <span className="font-mono text-slate-800">userLists</span> resource using the same
              workspace <span className="font-mono text-slate-800">datamanager</span> scope and
              consent gating.
            </p>
            <p>
              It does <strong className="text-slate-900">not</strong> increment Submitted,
              Processed, or Attributed conversion counts, and it does{' '}
              <strong className="text-slate-900">not</strong> report SGD job revenue into Smart
              Bidding.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 font-mono tabular-nums text-xs">
            <div>
              <div className="font-sans text-slate-500">Sales Attributed (Unchanged)</div>
              <div className="mt-0.5 text-base font-semibold text-slate-900">
                {workspace.metrics.attributed}
              </div>
            </div>
            <div>
              <div className="font-sans text-slate-500">Revenue Attributed (Unchanged)</div>
              <div className="mt-0.5 text-base font-semibold text-slate-900">
                SGD {workspace.metrics.totalAttributedValueSgd.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
