import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = language || 'code';

  return (
    <div className="zovo-code-block relative my-4 min-w-0 rounded-xl overflow-hidden border border-[var(--zovo-border)] bg-[var(--zovo-surface)] text-[var(--zovo-text)] text-sm font-mono">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--zovo-border)] text-xs text-[var(--zovo-muted)]">
        <span className="font-medium">
          {displayLang}
        </span>
        <button
          onClick={handleCopy}
          className="flex min-h-9 items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--zovo-hover)] text-[var(--zovo-muted)] hover:text-[var(--zovo-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zovo-muted)] transition-colors cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="m-0 leading-relaxed font-mono text-[var(--zovo-text)]">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
}
