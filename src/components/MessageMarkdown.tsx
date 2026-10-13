import { isValidElement, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock.js';

export function MessageMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          // react-markdown v10 distinguishes fenced code by its parent pre element.
          const child = Array.isArray(children) ? children[0] : children;
          if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
            const language = /language-([^\s]+)/.exec(child.props.className || '')?.[1];
            return <CodeBlock language={language} value={String(child.props.children ?? '').replace(/\n$/, '')} />;
          }
          return <pre>{children}</pre>;
        },
        code({ children, className }) {
          return <code className={className}>{children}</code>;
        },
        table({ children }) {
          return <div className="message-table" role="region" aria-label="Response table" tabIndex={0}><table>{children}</table></div>;
        },
        a({ children, href }) {
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
