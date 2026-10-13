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
    <div className="relative my-3 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-200 text-sm font-mono">
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-950 border-b border-zinc-800 text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">
          {displayLang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
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
        <pre className="m-0 leading-relaxed font-mono text-zinc-200">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
}
