import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  History,
  Info,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import type { ScheduleCadence, WorkspaceState } from '../types/zura.ts';

interface MonitorProps {
  workspace: WorkspaceState;
  busy: boolean;
  onExecuteLiveRun: () => Promise<void>;
  onUpdateSchedule: (patch: {
    cadence?: ScheduleCadence;
    paused?: boolean;
    safeRetryEnabled?: boolean;
  }) => Promise<void>;
  onAskAssistant: (prompt: string) => void;
  onJumpToStep: (step: number) => void;
}

export function MonitorDrawer({
  workspace,
  busy,
  onExecuteLiveRun,
  onUpdateSchedule,
  onAskAssistant,
  onJumpToStep,
}: MonitorProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'runs' | 'audit'>('overview');

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-SG', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{workspace.businessName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{workspace.scheduler.cadence.toUpperCase()} DELTA</span>
            <span aria-hidden="true">·</span>
            <span>{workspace.scheduler.paused ? 'Scheduler Paused' : 'Scheduler Active'}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Conversion Delivery Monitor & Google Diagnostics
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdateSchedule({ paused: !workspace.scheduler.paused })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            {workspace.scheduler.paused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-700" />
                <span>Resume Scheduler</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-600" />
                <span>Pause Scheduler</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={busy || !workspace.validation.ownerApproved || workspace.metrics.pending === 0}
            onClick={onExecuteLiveRun}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Run Delta Batch ({workspace.metrics.pending})</span>
          </button>
        </div>
      </div>

      {/* Funnel Separation Strip — Submitted != Processed != Attributed */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono tabular-nums">
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-sans text-slate-500">Pending Delta</div>
            <div className="mt-1 text-2xl font-semibold text-sky-700">
              {workspace.metrics.pending}
            </div>
            <div className="mt-1 text-xs font-sans text-slate-500">Queued for next run</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-sans text-slate-500">Quarantined</div>
            <div className="mt-1 text-2xl font-semibold text-rose-700">
              {workspace.metrics.quarantined}
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep(4)}
              className="mt-1 text-xs font-sans font-medium text-rose-700 hover:underline"
            >
              Review & fix rows
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-sans text-slate-500">Submitted</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {workspace.metrics.submitted}
            </div>
            <div className="mt-1 text-xs font-sans text-slate-500">Accepted by API</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-sans text-slate-500">Processed</div>
            <div className="mt-1 text-2xl font-semibold text-teal-700">
              {workspace.metrics.processed}
            </div>
            <div className="mt-1 text-xs font-sans text-slate-500">Matched by Google</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-sans text-slate-500">Attributed</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">
              {workspace.metrics.attributed}
            </div>
            <div className="mt-1 text-xs font-sans text-slate-600">
              SGD {workspace.metrics.totalAttributedValueSgd.toLocaleString()}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-sans text-indigo-700">Customer Match</div>
            <div className="mt-1 text-2xl font-semibold text-indigo-700">
              {workspace.metrics.customerMatchAudienceCount.toLocaleString()}
            </div>
            <div className="mt-1 text-xs font-sans text-slate-500">Audience only (not sales)</div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Google accepting a request (<strong className="text-slate-700">Submitted</strong>) does
          not guarantee every conversion is <strong className="text-slate-700">Processed</strong> or{' '}
          <strong className="text-slate-700">Attributed</strong> to an ad click.
        </p>
      </div>

      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(
            [
              { id: 'overview', label: 'Diagnostics & Schedule' },
              { id: 'runs', label: `Upload Runs (${workspace.runs.length})` },
              { id: 'audit', label: `Audit History (${workspace.auditLog.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            onAskAssistant(
              'Summarize our current upload health across Submitted, Processed, and Attributed conversions and explain any Google diagnostics.'
            )
          }
          className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline whitespace-nowrap"
        >
          Summarize Health with Scoped Assistant
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Google Processing Diagnostics */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Google Data Manager Processing Diagnostics
              </h2>
              <span className="text-xs text-slate-500">
                Last run: {formatTime(workspace.scheduler.lastRunAt)}
              </span>
            </div>

            <div className="space-y-3">
              {workspace.diagnostics.map((diag) => (
                <div
                  key={diag.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    {diag.severity === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    ) : diag.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">{diag.title}</div>
                      <div className="text-xs text-slate-600 leading-relaxed">{diag.detail}</div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                        <span>{diag.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{diag.affectedCount} record(s)</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTime(diag.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAskAssistant(
                        `Explain Google diagnostic ${diag.code} ("${diag.title}") and tell me what action is safe to take.`
                      )
                    }
                    className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Explain
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduler Control Summary */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Schedule & Safety Controls</h2>
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="font-medium text-slate-600">Cadence (Delta-Only)</div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
                  {(['hourly', 'daily', 'monthly'] as const).map((cad) => (
                    <button
                      key={cad}
                      type="button"
                      disabled={busy}
                      onClick={() => onUpdateSchedule({ cadence: cad })}
                      className={`py-1.5 font-medium rounded-md capitalize transition-colors ${
                        workspace.scheduler.cadence === cad
                          ? 'bg-teal-700 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cad}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Last Successful Run</span>
                  <span className="font-mono text-slate-900">
                    {formatTime(workspace.scheduler.lastRunAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Next Scheduled Run</span>
                  <span className="font-mono text-slate-900">
                    {workspace.scheduler.paused
                      ? 'Paused'
                      : formatTime(workspace.scheduler.nextRunAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Owner Approval</span>
                  <span
                    className={
                      workspace.validation.ownerApproved
                        ? 'text-emerald-700 font-semibold'
                        : 'text-amber-700 font-semibold'
                    }
                  >
                    {workspace.validation.ownerApproved ? 'Verified' : 'Pending (Step 5)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Duplicate Protection</span>
                  <span className="text-slate-900 font-medium">Enforced (No Replay)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'runs' && (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 font-semibold">Run ID</th>
                <th className="py-3 px-4 font-semibold">Started</th>
                <th className="py-3 px-4 font-semibold">Trigger / Cadence</th>
                <th className="py-3 px-4 font-semibold text-right">Submitted</th>
                <th className="py-3 px-4 font-semibold text-right">Processed</th>
                <th className="py-3 px-4 font-semibold text-right">Attributed</th>
                <th className="py-3 px-4 font-semibold text-right">Quarantined</th>
                <th className="py-3 px-4 font-semibold text-right">Skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
              {workspace.runs.map((run) => (
                <tr key={run.runId} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{run.runId}</td>
                  <td className="py-3 px-4 text-slate-500">{formatTime(run.startedAt)}</td>
                  <td className="py-3 px-4 font-sans text-slate-700">
                    {run.trigger.replace(/_/g, ' ')} · {run.cadence}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-900">{run.submitted}</td>
                  <td className="py-3 px-4 text-right text-teal-700 font-semibold">
                    {run.processed}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-semibold">
                    {run.attributed}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-700">{run.rejected}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{run.skippedDuplicates}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 bg-white">
          {workspace.auditLog.map((entry) => (
            <div key={entry.id} className="p-4 flex items-start justify-between gap-4 text-xs">
              <div className="flex items-start gap-2.5">
                <History className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">{entry.action}</div>
                  <div className="text-slate-600 mt-0.5">{entry.detail}</div>
                </div>
              </div>
              <div className="text-right font-mono text-[11px] text-slate-500 shrink-0">
                <div>{entry.actor}</div>
                <div>{formatTime(entry.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
