import React from 'react';

/**
 * Renders a policy's Markdown. Only a small, safe part of Markdown is understood: "#"/"##"
 * headings, "###" subheadings, "-" and "1." lists, paragraphs, **bold** and [links](url). Everything
 * else shows as plain text, and nothing is ever inserted as HTML, so a policy can't carry a script.
 */

type Block =
  | { kind: 'h2' | 'h3' | 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] };

export function parsePolicy(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: heading[1].length === 3 ? 'h3' : 'h2', text: heading[2] });
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      const text = (bullet ?? numbered)![1];
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) last.items.push(text);
      else blocks.push({ kind, items: [text] });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** The text without Markdown marks */
function plain(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');
}

/** Gives each heading an id, so sections can be linked to; repeats get "-2", "-3" */
function headingIds() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = plain(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count + 1}` : base;
  };
}

/** The policy's main sections, for a table of contents; ids match the rendered headings */
export function policySections(source: string): { id: string; title: string }[] {
  const idFor = headingIds();
  return parsePolicy(source).flatMap((b) => {
    if (b.kind !== 'h2' && b.kind !== 'h3') return [];
    const id = idFor(b.text); // subheadings take ids too, so the numbering matches
    return b.kind === 'h2' ? [{ id, title: plain(b.text) }] : [];
  });
}

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

/** **bold** and [text](url); anything else is text */
function inline(text: string, key = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={k} className="font-semibold text-km-heading">{inline(m[1], k)}</strong>);
    } else if (SAFE_URL.test(m[3])) {
      const external = /^https?:/i.test(m[3]);
      out.push(
        <a key={k} href={m[3]} className="font-medium text-km-link underline underline-offset-2 hover:no-underline"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[2]}
        </a>,
      );
    } else {
      out.push(m[0]);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function PolicyContent({ source, className = '' }: { source: string; className?: string }) {
  const blocks = parsePolicy(source);
  const idFor = headingIds();
  return (
    <div className={`space-y-4 text-[15px] leading-relaxed text-km-text-primary ${className}`}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h2':
            return <h2 key={i} id={idFor(b.text)} className="scroll-mt-24 pt-4 text-xl font-semibold text-km-heading">{inline(b.text)}</h2>;
          case 'h3':
            return <h3 key={i} id={idFor(b.text)} className="scroll-mt-24 pt-2 text-base font-semibold text-km-heading">{inline(b.text)}</h3>;
          case 'ul':
            return <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-km-text-muted">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
          case 'ol':
            return <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:text-km-text-muted">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>;
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}
