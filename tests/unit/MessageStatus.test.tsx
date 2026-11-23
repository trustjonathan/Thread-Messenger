import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageStatus } from '../../src/components/chat/MessageStatus';

const states = ['sending', 'failed', 'sent', 'delivered', 'read'] as const;
const labels: Record<string, string> = {
  sending: 'Sending',
  failed: 'Not sent',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

describe('MessageStatus', () => {
  for (const s of states) {
    it(`renders ${s} with aria-label ${labels[s]}`, () => {
      const html = renderToStaticMarkup(<MessageStatus state={s} onRetry={() => {}} />);
      expect(html).toContain(`aria-label="${labels[s]}"`);
    });
  }
  it('failed includes retry text', () => {
    const html = renderToStaticMarkup(<MessageStatus state="failed" onRetry={() => {}} />);
    expect(html).toContain('Not sent · Tap to retry');
  });
});
