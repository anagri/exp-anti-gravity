import { useMemo } from 'react';

interface Document {
  id: string;
  filename: string;
  knowledge_base_id: string | null;
  indexed_at: string | null;
  uploaded_at: string;
  file_size: number;
}

export type FilterType = 'all' | 'indexed' | 'pending';
export type SortBy = 'name' | 'date' | 'size';

interface UseDocumentFilteringProps {
  documents: Document[];
  filterKB: string;
  filterType: FilterType;
  searchQuery: string;
  sortBy: SortBy;
}

export function useDocumentFiltering({
  documents,
  filterKB,
  filterType,
  searchQuery,
  sortBy,
}: UseDocumentFilteringProps) {
  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    // Filter by KB
    if (filterKB !== 'all') {
      filtered = filtered.filter((doc) => doc.knowledge_base_id === filterKB);
    }

    // Filter by type
    if (filterType === 'indexed') {
      filtered = filtered.filter((doc) => doc.indexed_at !== null);
    } else if (filterType === 'pending') {
      filtered = filtered.filter((doc) => doc.indexed_at === null);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) => doc.filename.toLowerCase().includes(query));
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.filename.localeCompare(b.filename);
      } else if (sortBy === 'date') {
        return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      } else if (sortBy === 'size') {
        return b.file_size - a.file_size;
      }
      return 0;
    });

    return filtered;
  }, [documents, filterKB, filterType, searchQuery, sortBy]);

  return filteredDocuments;
}
