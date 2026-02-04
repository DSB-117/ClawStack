"use client";

import { useMemo } from "react";

interface ArticleContentProps {
  content: string;
}

/**
 * Renders markdown content as HTML.
 * Uses a simple regex-based parser for basic markdown support.
 * In production, consider using a library like react-markdown.
 */
export function ArticleContent({ content }: ArticleContentProps) {
  const htmlContent = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className="prose prose-slate dark:prose-invert max-w-none
        prose-headings:font-bold prose-headings:tracking-tight
        prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4
        prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
        prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
        prose-p:text-base prose-p:leading-7 prose-p:mb-4
        prose-a:text-claw-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:font-semibold
        prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
        prose-blockquote:border-l-claw-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1
        prose-ul:my-4 prose-ol:my-4
        prose-li:my-1
        prose-hr:border-border prose-hr:my-8
        prose-table:border prose-table:border-border
        prose-th:bg-muted prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:border prose-th:border-border
        prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-border"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

/**
 * Simple markdown parser for basic formatting.
 * Handles: headings, bold, italic, code, links, lists, blockquotes, hr, tables
 */
function parseMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first (basic XSS prevention)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (must be done before other transformations)
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_, lang, code) =>
      `<pre><code class="language-${lang || "text"}">${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr>");
  html = html.replace(/^\*\*\*$/gm, "<hr>");

  // Tables (simple implementation)
  html = html.replace(
    /^\|(.+)\|$/gm,
    (match, content) => {
      const cells = content.split("|").map((c: string) => c.trim());
      // Check if this is a separator row
      if (cells.every((c: string) => /^[-:]+$/.test(c))) {
        return ""; // Skip separator rows
      }
      const isHeader = cells.some((c: string) => c.includes("**"));
      const tag = isHeader ? "th" : "td";
      const cellsHtml = cells
        .map((c: string) => `<${tag}>${c.replace(/\*\*/g, "")}</${tag}>`)
        .join("");
      return `<tr>${cellsHtml}</tr>`;
    }
  );

  // Wrap tables
  html = html.replace(
    /(<tr>[\s\S]*?<\/tr>)+/g,
    (match) => `<table>${match}</table>`
  );

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (match) => {
    if (!match.includes("<ol>") && !match.includes("<table>")) {
      return `<ul>${match}</ul>`;
    }
    return match;
  });

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Paragraphs (wrap remaining text blocks)
  html = html
    .split("\n\n")
    .map((block) => {
      block = block.trim();
      if (
        !block ||
        block.startsWith("<h") ||
        block.startsWith("<pre") ||
        block.startsWith("<ul") ||
        block.startsWith("<ol") ||
        block.startsWith("<blockquote") ||
        block.startsWith("<table") ||
        block.startsWith("<hr")
      ) {
        return block;
      }
      // Don't wrap if it's already wrapped
      if (block.startsWith("<p>")) {
        return block;
      }
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n\n");

  return html;
}
