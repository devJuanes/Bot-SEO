import { cn } from '../../lib/cn';

function renderInline(text: string, linkClassName?: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {match[1]}
        </strong>,
      );
    } else if (match[2] && match[3]) {
      nodes.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'font-medium underline-offset-2 hover:underline',
            linkClassName ?? 'text-brand-600',
          )}
        >
          {match[2]}
        </a>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : [text];
}

export function ChatMarkdown({
  content,
  className,
  linkClassName,
}: {
  content: string;
  className?: string;
  linkClassName?: string;
}) {
  const blocks = content.split(/\n\n+/);

  return (
    <div className={cn('space-y-2.5 text-sm leading-relaxed', className)}>
      {blocks.map((block, blockIndex) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const listLines = trimmed.split('\n').filter((line) => /^[-*•]\s/.test(line.trim()));
        if (listLines.length > 0 && listLines.length === trimmed.split('\n').length) {
          return (
            <ul key={blockIndex} className="list-disc space-y-1.5 pl-5">
              {listLines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(line.replace(/^[-*•]\s+/, ''), linkClassName)}
                </li>
              ))}
            </ul>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={blockIndex} className="text-sm font-semibold text-ink">
              {renderInline(trimmed.slice(4), linkClassName)}
            </h4>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={blockIndex} className="text-base font-semibold text-ink">
              {renderInline(trimmed.slice(3), linkClassName)}
            </h3>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {trimmed.split('\n').map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line, linkClassName)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
