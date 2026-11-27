import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '@/features/landing/LandingPage';
import TermsPage from '@/features/legal/TermsPage';
import PrivacyPage from '@/features/legal/PrivacyPage';
import HelpPage from '@/features/public/HelpPage';
import ContactPage from '@/features/public/ContactPage';

function render(page: React.ReactElement) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      {page}
    </MemoryRouter>
  );
}

describe('Public website', () => {
  it('renders the landing page for visitors with exactly one h1', () => {
    const html = render(<LandingPage />);
    expect(html).toContain('Text messaging, made clear.');
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });

  it('promotes Thread Chat with a direct Android download and more information', () => {
    const html = render(<LandingPage />);
    expect(html).toContain('Meet Thread Chat');
    expect(html).toContain(
      'href="https://github.com/trustjonathan/Thread-Messenger/releases/latest/download/app-universal-debug.apk"'
    );
    expect(html).toContain('href="/t-chat"');
  });

  it.each([
    ['/terms', <TermsPage />],
    ['/privacy', <PrivacyPage />],
    ['/help', <HelpPage />],
    ['/contact', <ContactPage />],
  ])('renders %s without login and with exactly one h1', (_path, page) => {
    const html = render(page);
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });

  it('includes all footer links and the exact not-end-to-end-encrypted sentence', () => {
    const html = render(<LandingPage />);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/help"');
    expect(html).toContain('href="/contact"');
    expect(html).toContain("Messages aren&#x27;t end-to-end encrypted.");
  });

  it('renders Terms and Privacy without bracket placeholders', () => {
    const html = `${render(<TermsPage />)}${render(<PrivacyPage />)}`;
    expect(html).not.toMatch(/\[(?:PLACEHOLDER|BRACKET|TODO)[^\]]*\]/i);
    expect(html).not.toMatch(/\bTODO\b/i);
    expect(html).not.toMatch(/\bDRAFT\b/i);
  });
});
