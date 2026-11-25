import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiChat } from '../../src/components/layout/AiChat';
import { MessageRenderer, normalizeMathMarkdown } from '../../src/components/chat/MessageRenderer';
import { sendAiPrompt } from '../../src/lib/api';

describe('AiChat UI', () => {
  it('renders composer and send button in pane variant', () => {
    const html = renderToStaticMarkup(<AiChat variant="pane" onClose={() => {}} />);
    expect(html).toContain('data-testid="ai-pane"');
    expect(html).toContain('id="ai-prompt-input"');
    expect(html).toContain('aria-label="Send prompt"');
    expect(html).toContain('Ask Thread AI');
  });

  it('renders close arrow and dialog role in sheet variant', () => {
    const html = renderToStaticMarkup(<AiChat variant="sheet" onClose={() => {}} />);
    expect(html).toContain('data-testid="ai-sheet"');
    expect(html).toContain('aria-label="Close AI assistant"');
    expect(html).toContain('id="ai-prompt-input"');
  });
});

describe('sendAiPrompt (Supabase Edge Function client)', () => {
  it('invokes the ai-chat edge function and returns reply + quota', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        data: {
          reply: 'Hello from Gemini!',
          quota: {
            remainingInBatch: 4,
            batchSize: 5,
            usedToday: 1,
            dailyCap: 10,
            lockedUntil: null,
            serverNow: '2026-11-25T10:00:00Z',
          },
        },
      },
      error: null,
    });

    const mockClient = { functions: { invoke: mockInvoke } } as unknown as Parameters<
      typeof sendAiPrompt
    >[2];

    const res = await sendAiPrompt('Hi there', [], mockClient);
    expect(mockInvoke).toHaveBeenCalledWith('ai-chat', {
      body: { prompt: 'Hi there', history: [] },
    });
    expect(res.error).toBeNull();
    expect(res.data?.reply).toBe('Hello from Gemini!');
    expect(res.data?.quota?.remainingInBatch).toBe(4);
  });

  it('maps edge function HTTP error payload (e.g. RATE_LIMITED)', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: null,
      error: {
        context: {
          json: async () => ({
            error: {
              code: 'RATE_LIMITED',
              message: 'AI prompt limit reached.',
            },
          }),
        },
      },
    });

    const mockClient = { functions: { invoke: mockInvoke } } as unknown as Parameters<
      typeof sendAiPrompt
    >[2];

    const res = await sendAiPrompt('Hi', [], mockClient);
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe('RATE_LIMITED');
    expect(res.error?.message).toBe('AI prompt limit reached.');
  });
});

describe('MessageRenderer (Markdown + KaTeX)', () => {
  it('renders Markdown headings, bold text, and lists as HTML instead of raw syntax', () => {
    const md = '### **Step 1**\n\n* **Growth:** Mitosis enables growth.\n\n---';
    const html = renderToStaticMarkup(<MessageRenderer content={md} />);
    expect(html).toContain('<h3>');
    expect(html).toContain('<strong>Growth:</strong>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('<hr');
    expect(html).not.toContain('**Growth:**');
  });

  it('normalizes **$...$** and renders inline and block KaTeX math', () => {
    const raw =
      'Factor **$\\frac{3x + 1}{x^2 - 1}$** into:\n\n$$\n\\frac{3x + 1}{(x - 1)(x + 1)}\n$$';
    expect(normalizeMathMarkdown(raw)).not.toContain('**$');
    const html = renderToStaticMarkup(<MessageRenderer content={raw} />);
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
  });
});
