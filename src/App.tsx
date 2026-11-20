/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AssistantDrawer } from './components/AssistantDrawer.tsx';
import { FlowAndFunnelPage } from './components/FlowAndFunnelPage.tsx';
import type { AssistantMessage, WorkspaceState } from './types/zura.ts';

const INITIAL_ASSISTANT_MESSAGE: AssistantMessage = {
  id: 'welcome_1',
  role: 'assistant',
  content:
    'Hi! Ask me anything in plain English about your Demand Waterfall funnel, short-term SQL bidding (Meeting Booked vs Meeting Held), Google’s 63-day ECL vs 90-day GCLID limits, or your live signal volume.',
  timestamp: new Date().toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }),
};

async function safeParseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (text.trimStart().startsWith('<')) {
      throw new Error(
        `The server returned an unexpected page (HTTP ${res.status}) instead of JSON. Please try again.`
      );
    }
    throw new Error(`Invalid response from server (HTTP ${res.status}).`);
  }
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [assistantSending, setAssistantSending] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch('/api/workspace');
      const data = await safeParseJson(res);
      if (res.ok && data.workspace) {
        setWorkspace(data.workspace as WorkspaceState);
      }
    } catch {
      // Keep interactive report working smoothly even if workspace metadata is still warming up
    }
  }, []);

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  const handleSendAssistant = async (text: string) => {
    const nowLabel = new Date().toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const userMsg: AssistantMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: nowLabel,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setAssistantSending(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(String(data.error || 'Assistant request failed.'));
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: String(data.reply ?? ''),
          toolCalls: Array.isArray(data.toolCalls) ? data.toolCalls : undefined,
          timestamp: new Date().toLocaleTimeString('en-SG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: (err as Error).message,
          error: true,
          timestamp: new Date().toLocaleTimeString('en-SG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
        },
      ]);
    } finally {
      setAssistantSending(false);
    }
  };

  const openAssistantWithPrompt = (prompt: string) => {
    setAssistantOpen(true);
    void handleSendAssistant(prompt);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 h-[60px] bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
        <a
          href="#funnel"
          className="text-base font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          Zura Conversions
        </a>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#funnel"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Demand Funnel
          </a>
          <a
            href="#flowchart"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Interactive Flowchart
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </div>
      </header>

      {/* Single-Page Executive Report & Flowchart */}
      <main className="flex-1 px-6 py-7">
        <div className="max-w-[1200px] mx-auto">
          <FlowAndFunnelPage
            workspace={workspace}
            onAskAssistant={openAssistantWithPrompt}
          />
        </div>
      </main>

      {/* Slide-Over AI Assistant Drawer */}
      {assistantOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close AI assistant overlay"
            onClick={() => setAssistantOpen(false)}
            className="flex-1 bg-slate-900/35"
          />
          <aside className="w-full max-w-[440px] h-full border-l border-slate-200 shadow-2xl">
            <AssistantDrawer
              messages={messages}
              sending={assistantSending}
              onSend={handleSendAssistant}
              onClose={() => setAssistantOpen(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
