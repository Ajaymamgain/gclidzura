import { runZuraAssistantChat } from '../../server/geminiAssistant.ts';

interface VercelRequestLike {
  method?: string;
  body?: unknown;
}

interface VercelResponseLike {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const rawBody =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as Record<string, unknown>)
        : ((req.body as Record<string, unknown> | undefined) ?? {});

    const message = typeof rawBody.message === 'string' ? rawBody.message.trim() : '';
    const history = Array.isArray(rawBody.history)
      ? (rawBody.history as Array<{ role: 'user' | 'assistant'; content: string }>)
      : [];

    if (!message) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    const result = await runZuraAssistantChat(message, history);
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assistant request failed.';
    res.status(502).json({ error: message });
  }
}
