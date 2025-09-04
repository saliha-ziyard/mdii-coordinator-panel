import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Eye, } from 'lucide-react';

// Interface for QuestionLabel (unchanged)
export interface QuestionLabel {
  name: string; // Field name like "Q_13110000" or "group_toolid/Q_13110000"
  label: string; // Human-readable question from Excel column C
  type: string; // Field type
  choices?: Array<{ name: string; label: string }>; // For select questions
}

interface DataTableProps {
  data: any[];
  questions: QuestionLabel[];
}

// Interface for display columns to ensure no null values
interface DisplayColumn {
  key: string;
  label: string;
  type: string;
  choices: { name: string; label: string }[];
}

export function DataTable({ data, questions }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{column: string, direction: 'asc' | 'desc'} | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { displayColumns, tableData } = useMemo(() => {
    if (!data.length) return { displayColumns: [], tableData: [] };

    // Get unique field names in the order they appear in the first record (JSON order)
    const firstRecord = data[0] || {};
    const orderedFields = Object.keys(firstRecord).filter(
      key =>
        !key.startsWith('_') &&
        !key.startsWith('formhub/') &&
        !key.startsWith('meta/') &&
        key !== '__version__'
    );

    // Create display columns only for fields in data that have matching questions in Excel
    const displayColumns: DisplayColumn[] = orderedFields
      .map(fieldName => {
        // Normalize fieldName to match Excel (remove group prefix)
        const normalizedField = fieldName.split('/').pop() || fieldName;
        const question = questions.find(
          q => q.name === normalizedField || q.name === fieldName
        );
        if (!question) return null; // Skip if no matching question in Excel
        return {
          key: fieldName, // Keep original field name for data access
          label: question.label || 'Unknown Question',
          type: question.type || 'text',
          choices: question.choices || []
        };
      })
      .filter((col): col is DisplayColumn => col !== null) // Type guard to exclude null
      .sort((a, b) => {
        // Put tool ID fields first, preserve JSON order for others
        if (a.key.includes('toolid') || a.key.includes('Q_13110000')) return -1;
        if (b.key.includes('toolid') || b.key.includes('Q_13110000')) return 1;
        return 0; // Preserve original JSON order
      });

    // Initialize visible columns if not set
    if (visibleColumns.size === 0) {
      setVisibleColumns(new Set(displayColumns.map(col => col.key)));
    }

    // Process table data with choice labels
    const tableData = data.map(record => {
      const processedRecord: any = {};
      displayColumns.forEach(col => {
        let value = record[col.key];

        // Convert choice values to labels if available
        if (value && col.choices.length > 0) {
          const choice = col.choices.find(c => c.name === value);
          if (choice) {
            value = choice.label;
          }
        }

        // Format datetime fields (start, end, submission_time, etc.)
        if (value && typeof value === 'string' && 
            (col.key.toLowerCase().includes('start') || 
             col.key.toLowerCase().includes('end') || 
             col.key.toLowerCase().includes('time')) &&
            value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
          try {
            const date = new Date(value);
            value = date.toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
          } catch (e) {
            // Keep original value if parsing fails
          }
        }

        processedRecord[col.key] = value ?? '-'; // Use nullish coalescing for undefined/null
      });
      return processedRecord;
    });

    return { displayColumns, tableData };
  }, [data, questions, visibleColumns.size]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = tableData.filter(row =>
      Object.values(row).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = String(a[sortConfig.column] || '');
        const bValue = String(b[sortConfig.column] || '');
        const result = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? result : -result;
      });
    }

    return filtered;
  }, [tableData, searchTerm, sortConfig]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedData, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

  const handleSort = (columnKey: string) => {
    setSortConfig(current => ({
      column: columnKey,
      direction: current?.column === columnKey && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleColumnVisibility = (columnKey: string) => {
    const newVisibleColumns = new Set(visibleColumns);
    if (newVisibleColumns.has(columnKey)) {
      newVisibleColumns.delete(columnKey);
    } else {
      newVisibleColumns.add(columnKey);
    }
    setVisibleColumns(newVisibleColumns);
  };

  const visibleDisplayColumns = displayColumns.filter(col => visibleColumns.has(col.key));

  if (!tableData.length) {
    return (
      <div className="border border-gray-200 rounded bg-white">
        <div className="text-center py-16">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Data Available</h3>
          <p className="text-gray-500">No survey responses to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded">
      {/* Header Controls */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search responses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className='flex justify-center items-center'>
          {/* Column Selector */}
          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Eye className="h-4 w-4 " />
              Columns
              <ChevronDown className={`h-4 w-4 transition-transform ${showColumnSelector ? 'rotate-180' : ''}`} />
            </button>
            
            {showColumnSelector && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColumnSelector(false)} />
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Select Columns</div>
                  </div>
                  {displayColumns.map(col => (
                    <label key={col.key} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumnVisibility(col.key)}
                        className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Results Count */}
          <div className="inline-flex items-center px-4 py-2.5 rounded text-xs font-medium bg-blue-100 text-blue-800 ml-5">
            {filteredAndSortedData.length}{" "}
            {filteredAndSortedData.length === 1 ? "record" : "records"}
          </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {visibleDisplayColumns.map(col => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center justify-between">
                    <span>{col.label}</span>
                    <div className="flex flex-col">
                      {sortConfig?.column === col.key ? (
                        sortConfig.direction === 'asc' ? 
                        <ChevronUp className="h-3 w-3 text-gray-700" /> : 
                        <ChevronDown className="h-3 w-3 text-gray-700" />
                      ) : (
                        <div className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 border-b border-gray-100">
                {visibleDisplayColumns.map(col => (
                  <td key={col.key} className="px-3 py-2 text-sm text-gray-900 border-r border-gray-100 last:border-r-0">
                    <div className="truncate" title={String(row[col.key])}>
                      {String(row[col.key])}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with Pagination */}
      <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} results
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 py-1 text-sm border rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}