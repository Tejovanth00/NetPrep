"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto"><table className="min-w-full border-collapse text-sm">{children}</table></div>
        ),
        th: ({ children }) => <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left">{children}</th>,
        td: ({ children }) => <td className="border border-slate-300 px-3 py-2">{children}</td>,
        pre: ({ children }) => <pre className="my-3 max-w-full overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-50">{children}</pre>,
        code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-sm">{children}</code>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
