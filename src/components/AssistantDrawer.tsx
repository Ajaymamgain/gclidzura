import { useEffect, useRef, useState } from 'react';
import { Lock, Send, Wrench, X } from 'lucide-react';
import type { AssistantMessage } from '../types/zura.ts';

interface AssistantDrawerProps {
  messages: AssistantMessage[];
  sending: boolean;
  onSend: (text: string) => Promise<void>;
  onClose?: () => void;
}

const QUICK_PROMPTS = [
  {
    name: 'sqlVsClosedWon',
    label: 'Why SQL instead of Closed-Won?',
    prompt:
      'In plain marketer English, why should we train Google Ads on short-term SQL milestones (like Meeting Held) instead of waiting 2–5 months for Closed-Won sales?',
  },
  {
    name: 'eclVsGclidExpiry',
    label: 'Does ECL expire like GCLID?',
    prompt:
      'Give me the official Google definitions for Enhanced Conversions for Leads and GCLID, and explain why ECL expires at 63 days while GCLID expires at 90 days.',
  },
  {
    name: 'signalsSentBreakdown',
    label: 'How many signals are we sending?',
    prompt:
      'In plain marketer English, how many signals are we sending right now and what is our current attribution health?',
  },
  {
    name: 'campaignTimeline',
    label: 'How long do campaigns run?',
    prompt:
      'How long does a typical Google Ads paid campaign run, and why do we lose out on quality leads if we do not send a quality SQL signal early?',
  },
  {
    name: 'explainBlindBidding',
    label: 'What if we don’t send SQLs?',
    prompt:
      'If we do NOT send SQL conversions back to Google Ads, what kind of leads will we get and how does it hurt revenue?',
  },
];

export function AssistantDrawer({
  messages,
  sending,
  onSend,
  onClose,
}: AssistantDrawerProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setDraft('');
    await onSend(trimmed);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-teal-700" />
            <span>Zero Customer PII Exposed</span>
          </div>
          <h2 className="text-sm font-bold text-slate-900">Google Ads Conversion Assistant</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI assistant"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Questions */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((item) => (
          <button
            key={item.name}
            type="button"
            disabled={sending}
            onClick={() => void onSend(item.prompt)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-teal-600 hover:text-teal-800 disabled:opacity-45 rounded-lg transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : msg.error
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
              }`}
            >
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-2 pb-1.5 border-b border-slate-200 space-y-1">
                  {msg.toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-teal-800"
                    >
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span>{tc.summary}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            <span className="mt-1 text-[10px] font-mono text-slate-400">{msg.timestamp}</span>
          </div>
        ))}

        {sending && (
          <div className="text-xs font-mono text-teal-700">
            Checking workspace metrics &amp; preparing answer…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/70">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about SQL funnel, 63d ECL, or revenue…"
            className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
