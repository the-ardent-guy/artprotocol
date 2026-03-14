"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

export default function MarkdownViewer({ content }: Props) {
  // Fall back to pre-formatted text if content has no markdown markers
  const hasMarkdown = /[#*`\[\]>-]/.test(content);

  if (!hasMarkdown) {
    return (
      <pre className="font-mono text-sm text-[#ccc] whitespace-pre-wrap leading-relaxed">
        {content}
      </pre>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-semibold text-white mt-8 mb-4 pb-2 border-b border-[#2a2a2a]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-amber-400 mt-6 mb-3">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-[#ccc] mt-4 mb-2">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-[#bbb] mb-3 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-3 space-y-1 text-[#bbb]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-3 space-y-1 text-[#bbb]">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-[#bbb] leading-relaxed">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="text-white font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-[#999] italic">{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block bg-[#111] border border-[#2a2a2a] rounded p-4 font-mono text-sm text-[#ccc] overflow-x-auto">
                {children}
              </code>
            );
          }
          return (
            <code className="font-mono text-xs bg-[#1e1e1e] text-amber-400 px-1.5 py-0.5 rounded">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4 mb-4 overflow-x-auto font-mono text-sm text-[#ccc]">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-amber-500 pl-4 my-3 text-[#888] italic">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="border-none border-t border-[#2a2a2a] my-6" />
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 underline transition-colors"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[#161616]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left text-[#999] font-medium border-b border-[#2a2a2a]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-[#bbb] border-b border-[#1a1a1a]">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
