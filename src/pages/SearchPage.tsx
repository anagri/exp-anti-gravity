import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { useVectorDB } from '@/contexts/VectorDBContext'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchResult {
  chunkId: string
  documentId: string
  filename: string
  content: string
  heading: string | null
  chunkIndex: number
  score?: number
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedKBId, setSelectedKBId] = useState<string>('')

  const { searchBM25, lunrReady, knowledgeBases } = useVectorDB()
  const debouncedQuery = useDebounce(query, 300)

  // Auto-search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim() && selectedKBId && lunrReady) {
      handleSearch()
    }
  }, [debouncedQuery, selectedKBId])

  const handleSearch = async () => {
    if (!query.trim() || !selectedKBId) return

    setIsSearching(true)
    setHasSearched(false)

    try {
      const searchResults = await searchBM25(query, 10, selectedKBId)
      setResults(searchResults)
      setHasSearched(true)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
      setHasSearched(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setHasSearched(false)
  }

  const highlightQuery = (text: string, query: string): string => {
    if (!query.trim()) return DOMPurify.sanitize(text)

    const words = query.toLowerCase().split(/\s+/)
    let highlightedText = text

    words.forEach(word => {
      if (word.length < 2) return

      const regex = new RegExp(`(${word})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>')
    })

    return DOMPurify.sanitize(highlightedText)
  }

  return (
    <div className="container mx-auto max-w-4xl p-6" data-lunr-ready={lunrReady ? 'true' : 'false'}>
      <h1 className="text-3xl font-bold mb-6">Search Documents</h1>

      {/* KB Selector */}
      <div className="mb-4">
        <label htmlFor="kb-selector" className="block text-sm font-medium text-gray-700 mb-2">
          Select Knowledge Base
        </label>
        <select
          id="kb-selector"
          value={selectedKBId}
          onChange={(e) => setSelectedKBId(e.target.value)}
          data-testid="select-kb-search"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a Knowledge Base --</option>
          {knowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            data-testid="input-search-query"
            data-searching={isSearching ? 'true' : 'false'}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim() || !selectedKBId}
            data-testid="button-search"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          {query && (
            <button
              onClick={handleClear}
              data-testid="button-clear-search"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div data-testid="div-search-results">
        {isSearching && (
          <div className="text-center py-8 text-gray-600">
            Searching...
          </div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div data-testid="div-search-empty" className="text-center py-8 text-gray-600">
            No results found for "{query}"
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Found {results.length} result{results.length === 1 ? '' : 's'}
            </div>

            {results.map((result) => (
              <div
                key={result.chunkId}
                data-testid={`div-search-result-${result.chunkId}`}
                data-result-score={result.score?.toFixed(3) || '0'}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                {/* File and heading */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-blue-600">
                    📄 {result.filename}
                  </span>
                  {result.heading && (
                    <span className="text-sm text-gray-500">
                      → {result.heading}
                    </span>
                  )}
                </div>

                {/* Content preview */}
                <div
                  data-testid="text-result-content"
                  className="text-sm text-gray-700 mb-2 line-clamp-3"
                  dangerouslySetInnerHTML={{
                    __html: highlightQuery(result.content, query)
                  }}
                />

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Score: {result.score?.toFixed(3) || 'N/A'}</span>
                  <span>Chunk #{result.chunkIndex + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
