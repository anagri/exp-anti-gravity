import { useState } from 'react';
import type { SearchResult } from '@/contexts/VectorDBContext';

interface CitationPart {
  text: string;
  citationIndex?: number;
}

function parseCitations(messageContent: string): CitationPart[] {
  const parts: CitationPart[] = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(messageContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: messageContent.substring(lastIndex, match.index) });
    }

    parts.push({
      text: `[${match[1]}]`,
      citationIndex: parseInt(match[1], 10),
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < messageContent.length) {
    parts.push({ text: messageContent.substring(lastIndex) });
  }

  return parts;
}

interface CitationMarkerProps {
  index: number;
  source?: SearchResult;
}

function CitationMarker({ index, source }: CitationMarkerProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        data-citation-index={index}
        className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full cursor-help hover:bg-blue-200 transition-colors"
      >
        {index}
      </span>
      {showTooltip && source && (
        <div
          data-citation-tooltip
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50"
        >
          <div className="font-semibold mb-1">{source.filename}</div>
          {source.heading && (
            <div className="text-gray-300 mb-1 text-xs">{source.heading}</div>
          )}
          <div className="text-gray-200 line-clamp-3">{source.content}</div>
          <div className="text-gray-400 mt-1 text-xs">
            Similarity: {(source.similarity * 100).toFixed(1)}%
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  );
}

interface SourceCitationsProps {
  content: string;
  sources: SearchResult[];
}

export function SourceCitations({ content, sources }: SourceCitationsProps) {
  const parsedContent = parseCitations(content);

  return (
    <div>
      {/* Parsed content with citation markers */}
      <div className="whitespace-pre-wrap">
        {parsedContent.map((part, index) => {
          if (part.citationIndex !== undefined) {
            return (
              <CitationMarker
                key={index}
                index={part.citationIndex}
                source={sources[part.citationIndex - 1]}
              />
            );
          }
          return <span key={index}>{part.text}</span>;
        })}
      </div>

      {/* Sources footer */}
      {sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-2">Sources</div>
          <div className="space-y-2">
            {sources.map((source, idx) => (
              <div
                key={source.chunkId}
                data-source-index={idx + 1}
                data-source-filename={source.filename}
                className="text-xs text-gray-600"
              >
                <span className="font-medium text-blue-600">[{idx + 1}]</span>{' '}
                <span className="font-medium">{source.filename}</span>
                {source.heading && (
                  <span className="text-gray-500"> - {source.heading}</span>
                )}
                <span className="text-gray-400 ml-2">
                  ({(source.similarity * 100).toFixed(0)}% match)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
