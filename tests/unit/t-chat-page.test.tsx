import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TChatPage from '@/features/chat/TChatPage';

describe('T-Chat page', () => {
  it('explains nearby offline messaging and its limits in user-friendly terms', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TChatPage />
      </MemoryRouter>
    );

    expect(html).toContain('Chat nearby, even without internet.');
    expect(html).toContain('uses Bluetooth');
    expect(html).toContain('does not provide unlimited, long-distance coverage');
    expect(html).toContain('Regular chats on the Thread website still need an internet connection.');
  });

  it('links directly to the requested Android APK and release page', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TChatPage />
      </MemoryRouter>
    );

    expect(html).toContain(
      'href="https://github.com/trustjonathan/Thread-Messenger/releases/download/v2.2.0/app-universal-debug.apk"'
    );
    expect(html).toContain(
      'href="https://github.com/trustjonathan/Thread-Messenger/releases/tag/v2.2.0"'
    );
  });
});
