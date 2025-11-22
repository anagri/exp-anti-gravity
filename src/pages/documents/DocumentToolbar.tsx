import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc';
type FilterOption = 'all' | 'markdown' | 'text';

interface DocumentToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  filterOption: FilterOption;
  onFilterChange: (option: FilterOption) => void;
}

export default function DocumentToolbar({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  filterOption,
  onFilterChange,
}: DocumentToolbarProps) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
          data-testid="inp-doc-search"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => onSearchChange('')}
            data-testid="btn-doc-search-clear"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <select
        value={sortOption}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="w-full sm:w-[180px] h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
        data-testid="select-doc-sort"
      >
        <option value="date-desc">Date (Newest)</option>
        <option value="date-asc">Date (Oldest)</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="size-asc">Size (Smallest)</option>
        <option value="size-desc">Size (Largest)</option>
      </select>

      <select
        value={filterOption}
        onChange={(e) => onFilterChange(e.target.value as FilterOption)}
        className="w-full sm:w-[150px] h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
        data-testid="select-doc-filter"
      >
        <option value="all">All Files</option>
        <option value="markdown">Markdown</option>
        <option value="text">Text</option>
      </select>
    </div>
  );
}
