import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TChatPage from '@/features/chat/TChatPage';

describe('T-Chat page', () => {
  it('describes Thread Chat in clear, user-focused language', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TChatPage />
      </MemoryRouter>
    );

    expect(html).toContain('Thread Chat for Android');
    expect(html).toContain('Stay in touch, even when you are offline.');
    expect(html).toContain('Free to download for Android.');
    expect(html).toContain('It is not a replacement for long-distance messaging.');
    expect(html).not.toContain('Bluetooth');
    expect(html).not.toContain('T-Chat');
  });

  it('links to the latest Android app download', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TChatPage />
      </MemoryRouter>
    );

    expect(html).toContain(
      'href="https://github.com/trustjonathan/Thread-Messenger/releases/latest/download/app-universal-debug.apk"'
    );
  });
});
