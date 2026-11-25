import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';

export function normalizeMathMarkdown(text: string): string {
  // Unwrap **$...$** -> $...$ so remark-math always parses inline math cleanly
  return text.replace(/\*\*(\$[^$\n]+?\$)\*\*/g, '$1');
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  // Extract raw string text from children
  const extractText = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      return extractText((node as { props?: { children?: React.ReactNode } }).props?.children);
    }
    return '';
  };

  const rawCode = extractText(children).replace(/\n$/, '');

  const handleCopy = async () => {
    const res = await copyTextToClipboard(rawCode);
    if (res.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden bg-thread-surface border border-thread-border text-thread-text group">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-thread-soft/50 border-b border-thread-border text-xs text-thread-muted font-mono">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-thread-muted hover:text-thread-text hover:bg-thread-soft transition-colors focus:outline-none focus:ring-1 focus:ring-thread-accent"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed">
        <pre className="!bg-transparent !p-0 !m-0">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </div>
  );
}

export const MessageRenderer = memo(function MessageRenderer({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const cleaned = normalizeMathMarkdown(content);

  return (
    <div className="thread-ai-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-thread-soft text-thread-text font-mono text-[0.9em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-thread-border max-w-full">
                <table className="min-w-full divide-y divide-thread-border text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-thread-soft text-thread-text font-semibold">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-thread-border bg-transparent">{children}</tbody>;
          },
          tr({ children }) {
            return <tr>{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-sm text-thread-text whitespace-nowrap sm:whitespace-normal">{children}</td>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 pl-4 border-l-4 border-thread-accent text-thread-muted italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            // Sanitize external links
            const isSafe = href?.startsWith('http://') || href?.startsWith('https://') || href?.startsWith('mailto:');
            return (
              <a
                href={isSafe ? href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-thread-accent underline hover:opacity-80 transition-opacity"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {cleaned}
      </ReactMarkdown>
      {isStreaming && (
        <span
          className="inline-block w-2 h-4 ml-0.5 bg-thread-accent animate-pulse align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
});
