import { createClient } from 'npm:@supabase/supabase-js@2';
import postgres from 'npm:postgres@3.4.5';
import { SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION } from './systemPrompt.ts';

const BASE_ALLOWED_HEADERS =
  'authorization, content-type, apikey, x-client-info, x-supabase-api-version';
const ALLOWED_METHODS = 'POST, OPTIONS';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://thread-messenger.onrender.com',
];

export function normalizeExactOrigin(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.includes('*')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(env: {
  ALLOWED_ORIGINS?: string;
}): Set<string> {
  const configured = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(normalizeExactOrigin)
    .filter((o): o is string => Boolean(o));

  if (configured.length > 0) {
    return new Set(configured);
  }

  return new Set(DEFAULT_ALLOWED_ORIGINS);
}

export function buildCorsHeaders(
  origin: string | null,
  allowedOrigins: Set<string>
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': BASE_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    Vary: 'Origin',
  };

  const normalized = origin ? normalizeExactOrigin(origin) : null;
  if (normalized && allowedOrigins.has(normalized)) {
    headers['Access-Control-Allow-Origin'] = normalized;
  }

  return headers;
}

interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

interface RequestBody {
  prompt?: string;
  history?: Array<{ role?: unknown; text?: unknown }>;
}

export interface QuotaRow {
  allowed?: boolean;
  refunded?: boolean;
  remaining_in_batch: number;
  batch_size: number;
  used_today: number;
  daily_cap: number;
  locked_until: string | null;
  server_now: string;
}

export interface AiChatDeps {
  getEnv: (key: string) => string | undefined;
  verifyUser: (authHeader: string) => Promise<{ id: string } | null>;
  consumeQuota: (userId: string) => Promise<QuotaRow | null>;
  refundQuota: (userId: string) => Promise<QuotaRow | null>;
  fetchFn: typeof fetch;
}

function jsonResponse(
  status: number,
  payload: unknown,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function formatQuota(row: QuotaRow | null) {
  if (!row) return null;
  return {
    remainingInBatch: row.remaining_in_batch,
    batchSize: row.batch_size,
    usedToday: row.used_today,
    dailyCap: row.daily_cap,
    lockedUntil: row.locked_until,
    serverNow: row.server_now,
  };
}

async function runQuotaRpc(
  dbUrl: string,
  userId: string,
  fnName: 'consume_ai_prompt' | 'refund_ai_prompt'
): Promise<QuotaRow | null> {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const rows = await sql.begin(async (tx) => {
      const claims = JSON.stringify({ sub: userId, role: 'service_role' });
      await tx`SELECT set_config('request.jwt.claims', ${claims}, true)`;
      if (fnName === 'consume_ai_prompt') {
        return await tx<QuotaRow[]>`SELECT * FROM public.consume_ai_prompt()`;
      }
      return await tx<QuotaRow[]>`SELECT * FROM public.refund_ai_prompt()`;
    });
    return rows[0] ?? null;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

export function createDefaultDeps(): AiChatDeps {
  const getEnv = (key: string) =>
    typeof Deno !== 'undefined' ? Deno.env.get(key) : undefined;

  return {
    getEnv,
    verifyUser: async (authHeader: string) => {
      const supabaseUrl = getEnv('SUPABASE_URL');
      const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');
      if (!supabaseUrl || !supabaseAnonKey) return null;

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error,
      } = await supabaseUser.auth.getUser();
      if (error || !user) return null;
      return { id: user.id };
    },
    consumeQuota: async (userId: string) => {
      const dbUrl = getEnv('SUPABASE_DB_URL');
      if (!dbUrl) return null;
      return await runQuotaRpc(dbUrl, userId, 'consume_ai_prompt');
    },
    refundQuota: async (userId: string) => {
      const dbUrl = getEnv('SUPABASE_DB_URL');
      if (!dbUrl) return null;
      return await runQuotaRpc(dbUrl, userId, 'refund_ai_prompt');
    },
    fetchFn: fetch,
  };
}

export async function handleAiChatRequest(
  req: Request,
  deps: AiChatDeps = createDefaultDeps()
): Promise<Response> {
  const origin = req.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins({
    ALLOWED_ORIGINS: deps.getEnv('ALLOWED_ORIGINS'),
  });
  const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

  // 1. Answer CORS preflight first, before any auth or body parsing
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      405,
      { error: { code: 'VALIDATION_ERROR', message: 'Method not allowed.' } },
      corsHeaders
    );
  }

  // 2. Verify user JWT for every non-OPTIONS request
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(
      401,
      { error: { code: 'UNAUTHENTICATED', message: 'Missing authorization header.' } },
      corsHeaders
    );
  }

  const user = await deps.verifyUser(authHeader);
  if (!user) {
    return jsonResponse(
      401,
      { error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired session.' } },
      corsHeaders
    );
  }

  // 3. Parse and validate body
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse(
      400,
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON request body.' } },
      corsHeaders
    );
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 1000) {
    console.info('[ai-chat]', { userId: user.id, status: 400, promptVersion: SYSTEM_PROMPT_VERSION });
    return jsonResponse(
      400,
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Prompt must be between 1 and 1000 characters.',
        },
      },
      corsHeaders
    );
  }

  if (body.history !== undefined && !Array.isArray(body.history)) {
    console.info('[ai-chat]', { userId: user.id, status: 400, promptVersion: SYSTEM_PROMPT_VERSION });
    return jsonResponse(
      400,
      { error: { code: 'VALIDATION_ERROR', message: 'History must be an array.' } },
      corsHeaders
    );
  }

  const rawHistory = body.history ?? [];
  for (const turn of rawHistory) {
    if (
      !turn ||
      (turn.role !== 'user' && turn.role !== 'assistant') ||
      typeof turn.text !== 'string'
    ) {
      console.info('[ai-chat]', { userId: user.id, status: 400, promptVersion: SYSTEM_PROMPT_VERSION });
      return jsonResponse(
        400,
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid message role in history. Only "user" and "assistant" are allowed.',
          },
        },
        corsHeaders
      );
    }
  }

  const safeHistory: HistoryTurn[] = rawHistory
    .filter((turn) => (turn.text as string).trim().length > 0)
    .slice(-10)
    .map((turn) => ({
      role: turn.role as 'user' | 'assistant',
      text: (turn.text as string).slice(0, 1000),
    }));

  const geminiApiKey = deps.getEnv('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.info('[ai-chat]', { userId: user.id, status: 500, promptVersion: SYSTEM_PROMPT_VERSION });
    return jsonResponse(
      500,
      {
        error: {
          code: 'OPERATION_FAILED',
          message: 'AI service is not configured (missing GEMINI_API_KEY).',
        },
      },
      corsHeaders
    );
  }

  // 4. Consume quota atomically before calling Gemini
  let consumed = false;
  let quotaRow: QuotaRow | null = null;

  try {
    quotaRow = await deps.consumeQuota(user.id);
    if (quotaRow && quotaRow.allowed === false) {
      console.info('[ai-chat]', { userId: user.id, status: 429, promptVersion: SYSTEM_PROMPT_VERSION });
      return jsonResponse(
        429,
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'AI prompt limit reached. Please wait before trying again.',
            details: formatQuota(quotaRow),
          },
        },
        corsHeaders
      );
    }
    consumed = Boolean(quotaRow?.allowed);
  } catch (err) {
    console.warn('[ai-chat] consume_ai_prompt failed, continuing:', err);
  }

  const contents = [
    ...safeHistory.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  const primaryModel = deps.getEnv('GEMINI_MODEL') || 'gemini-3.6-flash';
  const fallbackModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
  const candidateModels = Array.from(new Set([primaryModel, ...fallbackModels]));

  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      maxOutputTokens: 1800,
    },
  });

  const extractSseText = (line: string): string => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return '';
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr || jsonStr === '[DONE]') return '';
    try {
      const parsed = JSON.parse(jsonStr) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return (
        parsed.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('') ?? ''
      );
    } catch {
      return '';
    }
  };

  try {
    let geminiRes: Response | null = null;
    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(geminiApiKey)}`;
      geminiRes = await deps.fetchFn(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      if (geminiRes.ok) break;
      // Retry with next fallback model on transient 429/503 or deprecated 404
      if (![404, 429, 503].includes(geminiRes.status) || i === candidateModels.length - 1) {
        break;
      }
      console.warn(`[ai-chat] model ${model} returned ${geminiRes.status}, trying fallback`);
    }

    if (!geminiRes || !geminiRes.ok || !geminiRes.body) {
      const errText = geminiRes ? await geminiRes.text() : 'No response';
      console.error('[ai-chat] Gemini error:', geminiRes?.status, errText);
      if (consumed) {
        try {
          quotaRow = await deps.refundQuota(user.id);
        } catch (refundErr) {
          console.error('[ai-chat] refund_ai_prompt failed:', refundErr);
        }
      }
      console.info('[ai-chat]', { userId: user.id, status: 502, promptVersion: SYSTEM_PROMPT_VERSION });
      return jsonResponse(
        502,
        {
          error: {
            code: 'OPERATION_FAILED',
            message: 'Failed to get a response from Gemini.',
          },
        },
        corsHeaders
      );
    }

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    let sseBuffer = '';

    // Wait for the first non-empty text chunk so pre-first-chunk failures
    // can still return a normal JSON error status and refund quota.
    const pendingTexts: string[] = [];
    while (pendingTexts.length === 0) {
      const { done, value } = await reader.read();
      if (done) {
        sseBuffer += decoder.decode();
        if (sseBuffer) {
          for (const line of sseBuffer.split(/\r?\n/)) {
            const t = extractSseText(line);
            if (t.length > 0) pendingTexts.push(t);
          }
          sseBuffer = '';
        }
        break;
      }
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split(/\r?\n/);
      sseBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = extractSseText(line);
        if (t.length > 0) pendingTexts.push(t);
      }
    }

    if (pendingTexts.length === 0) {
      if (consumed) {
        try {
          quotaRow = await deps.refundQuota(user.id);
        } catch (refundErr) {
          console.error('[ai-chat] refund_ai_prompt failed:', refundErr);
        }
      }
      console.info('[ai-chat]', { userId: user.id, status: 502, promptVersion: SYSTEM_PROMPT_VERSION });
      return jsonResponse(
        502,
        {
          error: {
            code: 'OPERATION_FAILED',
            message: 'Gemini returned an empty response.',
          },
        },
        corsHeaders
      );
    }

    console.info('[ai-chat]', { userId: user.id, status: 200, promptVersion: SYSTEM_PROMPT_VERSION });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const text of pendingTexts) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              sseBuffer += decoder.decode();
              if (sseBuffer) {
                for (const line of sseBuffer.split(/\r?\n/)) {
                  const text = extractSseText(line);
                  if (text.length > 0) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                    );
                  }
                }
              }
              controller.enqueue(
                encoder.encode(
                  `event: done\ndata: ${JSON.stringify({ quota: formatQuota(quotaRow) })}\n\n`
                )
              );
              controller.close();
              break;
            }

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split(/\r?\n/);
            sseBuffer = lines.pop() ?? '';
            for (const line of lines) {
              const text = extractSseText(line);
              if (text.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }
            }
          }
        } catch (streamErr) {
          // Error after first chunk: no refund; end stream with final error event.
          console.error('[ai-chat] stream error after first chunk:', streamErr);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                code: 'OPERATION_FAILED',
                message: 'Stream interrupted.',
              })}\n\n`
            )
          );
          controller.close();
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('[ai-chat] fetch failed:', err);
    if (consumed) {
      try {
        quotaRow = await deps.refundQuota(user.id);
      } catch (refundErr) {
        console.error('[ai-chat] refund_ai_prompt failed:', refundErr);
      }
    }
    console.info('[ai-chat]', { userId: user.id, status: 502, promptVersion: SYSTEM_PROMPT_VERSION });
    return jsonResponse(
      502,
      {
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error while contacting Gemini.',
        },
      },
      corsHeaders
    );
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve((req: Request) => handleAiChatRequest(req));
}
