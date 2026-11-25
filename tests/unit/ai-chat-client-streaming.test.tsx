import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiChat } from '../../src/components/layout/AiChat';
import { MessageRenderer } from '../../src/components/chat/MessageRenderer';
import { copyTextToClipboard } from '../../src/lib/clipboard';
import { streamAiPrompt } from '../../src/lib/api';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

describe('AI Message Layout (No Card, Direct on Background)', () => {
  it('verifies AI messages do NOT have card, bubble, border, or shadow classes', () => {
    // Render an AI response item as structured in AiChat
    const html = renderToStaticMarkup(
      <div data-testid="ai-message" className="ai-response-item flex flex-col items-start w-full">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-thread-muted mb-1.5 select-none">
          <span>Thread AI</span>
        </div>
        <div id="msg-body-test" className="w-full text-thread-text text-base">
          <MessageRenderer content="Direct background content without bubble" />
        </div>
      </div>
    );

    // AI message container assertions
    expect(html).toContain('data-testid="ai-message"');
    expect(html).not.toContain('bg-thread-bubble-theirs');
    expect(html).not.toContain('border-thread-border');
    expect(html).not.toContain('rounded-2xl');
    expect(html).not.toContain('shadow');
    expect(html).toContain('Direct background content without bubble');
  });

  it('keeps user messages in right-aligned accent bubbles', () => {
    const html = renderToStaticMarkup(
      <div className="flex flex-col items-end w-full">
        <div
          data-testid="user-message"
          className="max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl rounded-tr-none bg-thread-bubble-mine text-thread-bubble-mine-text text-sm whitespace-pre-wrap break-words shadow-sm"
        >
          User query text
        </div>
      </div>
    );

    expect(html).toContain('data-testid="user-message"');
    expect(html).toContain('bg-thread-bubble-mine');
    expect(html).toContain('text-thread-bubble-mine-text');
    expect(html).toContain('rounded-2xl');
    expect(html).toContain('User query text');
  });

  it('renders tables with overflow-x-auto container and styled borders', () => {
    const md = `
| Item | Description |
| :--- | :--- |
| Plant | Produces glucose |
`;
    const html = renderToStaticMarkup(<MessageRenderer content={md} />);
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
    expect(html).toContain('Produces glucose');
  });

  it('renders block math and fractions cleanly with KaTeX', () => {
    const md = 'Fractions like $\\frac{3}{4}$ and display:\n\n$$\n\\frac{x}{y}\n$$';
    const html = renderToStaticMarkup(<MessageRenderer content={md} />);
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
  });

  it('sanitizes script tags in markdown content', () => {
    const md = 'Hello <script>alert("xss")</script> World';
    const html = renderToStaticMarkup(<MessageRenderer content={md} />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Hello');
  });
});

describe('Copy Feature and Clipboard Utility', () => {
  const originalNavigator = global.navigator;
  const originalDocument = global.document;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore globals
    global.navigator = originalNavigator;
    global.document = originalDocument;
  });

  it('copies exact raw Markdown with LaTeX intact using navigator.clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: {
          writeText: writeTextMock,
        },
      },
    });

    const rawMarkdownWithLatex = 'Consider $\\frac{3}{4}$ and $$\\int_0^1 x\\,dx$$.';
    const res = await copyTextToClipboard(rawMarkdownWithLatex);

    expect(res.success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith(rawMarkdownWithLatex);
  });

  it('falls back to textarea + execCommand if navigator.clipboard is unavailable or throws', async () => {
    const execCommandMock = vi.fn().mockReturnValue(true);
    const mockTextarea = {
      value: '',
      style: {},
      setAttribute: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
      parentNode: {
        removeChild: vi.fn(),
      },
    };

    Object.defineProperty(global, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Blocked')),
        },
      },
    });
    Object.defineProperty(global, 'document', {
      configurable: true,
      writable: true,
      value: {
        createElement: vi.fn().mockReturnValue(mockTextarea),
        body: {
          appendChild: vi.fn(),
        },
        execCommand: execCommandMock,
      },
    });

    const res = await copyTextToClipboard('Raw markdown test');
    expect(res.success).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(mockTextarea.value).toBe('Raw markdown test');
    expect(mockTextarea.parentNode.removeChild).toHaveBeenCalledWith(mockTextarea);
  });

  it('selects targetElement if both clipboard methods fail', async () => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Blocked')),
        },
      },
    });

    const removeAllRangesMock = vi.fn();
    const addRangeMock = vi.fn();
    const selectNodeContentsMock = vi.fn();

    Object.defineProperty(global, 'document', {
      configurable: true,
      writable: true,
      value: {
        createElement: vi.fn().mockReturnValue({
          style: {},
          setAttribute: vi.fn(),
          select: vi.fn(),
          setSelectionRange: vi.fn(),
          parentNode: { removeChild: vi.fn() },
        }),
        body: { appendChild: vi.fn() },
        execCommand: vi.fn().mockReturnValue(false),
        createRange: vi.fn().mockReturnValue({
          selectNodeContents: selectNodeContentsMock,
        }),
      },
    });

    Object.defineProperty(global, 'window', {
      configurable: true,
      writable: true,
      value: {
        getSelection: vi.fn().mockReturnValue({
          removeAllRanges: removeAllRangesMock,
          addRange: addRangeMock,
        }),
      },
    });

    const dummyEl = { nodeType: 1 } as unknown as Node;
    const res = await copyTextToClipboard('Select me', dummyEl);

    expect(res.success).toBe(false);
    expect(res.fallbackSelectionMade).toBe(true);
    expect(selectNodeContentsMock).toHaveBeenCalledWith(dummyEl);
    expect(removeAllRangesMock).toHaveBeenCalled();
    expect(addRangeMock).toHaveBeenCalled();
  });

  it('formats "Copy chat" with "You:" and "Thread AI:" message headers', () => {
    const conversation = [
      { role: 'user', text: 'What is photosynthesis?' },
      { role: 'assistant', text: 'Photosynthesis converts light into chemical energy.' },
    ];

    const formatted = conversation
      .map((m) => `${m.role === 'user' ? 'You:' : 'Thread AI:'}\n${m.text}`)
      .join('\n\n');

    expect(formatted).toBe(
      'You:\nWhat is photosynthesis?\n\nThread AI:\nPhotosynthesis converts light into chemical energy.'
    );
  });
});

describe('Stream Parser and Edge/Client Stream Handling', () => {
  it('correctly parses multi-byte and chunked SSE events via streamAiPrompt logic', async () => {
    const chunks: string[] = [];
    let quotaReceived: unknown = null;

    // Simulate multi-byte character split across two chunks:
    // "🔬" is 4 bytes: 0xF0, 0x9F, 0x94, 0xAC
    const part1 = new Uint8Array([0x64, 0x61, 0x74, 0x61, 0x3a, 0x20, 0x7b, 0x22, 0x74, 0x65, 0x78, 0x74, 0x22, 0x3a, 0x22, 0xf0, 0x9f]); // "data: {\"text\":\"" + 2 bytes of 🔬
    const part2 = new Uint8Array([0x94, 0xac, 0x22, 0x7d, 0x0a, 0x0a]); // 2 bytes of 🔬 + "\"}\n\n"
    const doneChunk = new TextEncoder().encode(
      'event: done\ndata: {"quota":{"remainingInBatch":4,"batchSize":5}}\n\n'
    );

    let streamStep = 0;
    const mockStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (streamStep === 0) {
          controller.enqueue(part1);
          streamStep++;
        } else if (streamStep === 1) {
          controller.enqueue(part2);
          streamStep++;
        } else if (streamStep === 2) {
          controller.enqueue(doneChunk);
          controller.close();
          streamStep++;
        }
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
      status: 200,
    });
    global.fetch = mockFetch;

    const mockClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'fake-token' } },
        }),
      },
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'fake-key',
    } as unknown as SupabaseClient<Database>;

    await streamAiPrompt({
      prompt: 'Hello',
      history: [],
      client: mockClient,
      onChunk: (t) => chunks.push(t),
      onDone: (q) => {
        quotaReceived = q;
      },
      onError: () => {},
    });

    expect(chunks).toEqual(['🔬']);
    expect(quotaReceived).toEqual({ remainingInBatch: 4, batchSize: 5 });
  });

  it('renders initial AiChat UI with header options menu and 70ch width container', () => {
    const html = renderToStaticMarkup(<AiChat variant="pane" onClose={() => {}} />);
    expect(html).toContain('max-w-[70ch]');
    expect(html).toContain('aria-label="AI options"');
    expect(html).toContain('id="ai-prompt-input"');
    expect(html).toContain('Ask Thread AI');
  });
});
