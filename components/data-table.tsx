import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Eye, Users, User } from 'lucide-react';
import { Calendar } from 'lucide-react';

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

// Interface for demographic statistics
interface DemographicStats {
  genderStats: { [key: string]: number };
  ageStats: { [key: string]: number };
  totalResponses: number;
}

export function DataTable({ data, questions }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{column: string, direction: 'asc' | 'desc'} | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showDemographics, setShowDemographics] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const itemsPerPage = 10;
  const [dateFilter, setDateFilter] = useState<{
    startDate: string;
    endDate: string;
    enabled: boolean;
  }>({
    startDate: '',
    endDate: '',
    enabled: false
  });

  // Function to determine user type and maturity level based on available fields
  const getUserTypeAndMaturity = (record: any): { userType: 'direct' | 'indirect', maturity: 'early' | 'advanced' } => {
    // Check for direct user fields
    if (record['group_individualinfo/Q_32120000'] !== undefined || record['group_intro_001/Q_32120000'] !== undefined) {
      // Direct user
      if (record['group_individualinfo/Q_32120000'] !== undefined) {
        return { userType: 'direct', maturity: 'early' };
      } else {
        return { userType: 'direct', maturity: 'advanced' };
      }
    }
    // Check for indirect user fields
    else if (record['group_individualinfo/Q_42120000'] !== undefined || record['Q_individualinfo/Q_42120000'] !== undefined) {
      // Indirect user
      if (record['group_individualinfo/Q_42120000'] !== undefined) {
        return { userType: 'indirect', maturity: 'early' };
      } else {
        return { userType: 'indirect', maturity: 'advanced' };
      }
    }
    
    // Default fallback
    return { userType: 'direct', maturity: 'early' };
  };

  // Function to get gender and age field names based on user type and maturity
  const getDemographicFields = (userType: 'direct' | 'indirect', maturity: 'early' | 'advanced') => {
    const fieldMap = {
      direct: {
        early: {
          gender: 'group_individualinfo/Q_32120000',
          age: 'group_individualinfo/Q_32110000'
        },
        advanced: {
          gender: 'group_intro_001/Q_32120000',
          age: 'group_intro_001/Q_32110000'
        }
      },
      indirect: {
        early: {
          gender: 'group_individualinfo/Q_42120000',
          age: 'group_individualinfo/Q_42110000'
        },
        advanced: {
          gender: 'Q_individualinfo/Q_42120000',
          age: 'Q_individualinfo/Q_32110000'
        }
      }
    };
    
    return fieldMap[userType][maturity];
  };

  const { displayColumns, tableData, demographicStats } = useMemo(() => {
    if (!data.length) return { displayColumns: [], tableData: [], demographicStats: { genderStats: {}, ageStats: {}, totalResponses: 0 } };

    // Apply date filter to raw data FIRST, before processing
    let filteredRawData = data;
    if (dateFilter.enabled && (dateFilter.startDate || dateFilter.endDate)) {
      filteredRawData = data.filter(record => {
        // Look for date fields in the raw record
        const dateFields = Object.keys(record).filter(key => 
          key.toLowerCase().includes('start') || 
          key.toLowerCase().includes('end') || 
          key.toLowerCase().includes('time') ||
          key.toLowerCase().includes('date')
        );

        // Use the first date field found
        let recordDate = null;
        for (const field of dateFields) {
          const value = record[field];
          if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
            recordDate = new Date(value);
            break;
          }
        }

        if (!recordDate) return true; // If no date found, include the record

        const recordDateOnly = recordDate.toISOString().split('T')[0];
        
        if (dateFilter.startDate && recordDateOnly < dateFilter.startDate) {
          return false;
        }
        if (dateFilter.endDate && recordDateOnly > dateFilter.endDate) {
          return false;
        }
        return true;
      });
    }

    // Get unique field names in the order they appear in the first record (JSON order)
    const firstRecord = filteredRawData[0] || {};
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

    // Calculate demographic statistics using filtered data
    const genderStats: { [key: string]: number } = {};
    const ageStats: { [key: string]: number } = {};

    filteredRawData.forEach(record => {
      const { userType, maturity } = getUserTypeAndMaturity(record);
      const fields = getDemographicFields(userType, maturity);
      
      // Log demographic field extraction for debugging
      if (record === filteredRawData[0]) {
        console.log('Detected user type:', userType, 'maturity:', maturity);
        console.log('Looking for fields:', fields);
        console.log('Gender field value:', record[fields.gender]);
        console.log('Age field value:', record[fields.age]);
      }
      
      // Try multiple possible field names for gender
      const possibleGenderFields = [
        fields.gender,
        'group_individualinfo/Q_32120000',
        'group_intro_001/Q_32120000', 
        'group_individualinfo/Q_42120000',
        'Q_individualinfo/Q_42120000',
        // Also try without group prefixes
        'Q_32120000',
        'Q_42120000'
      ];
      
      let genderValue = null;
      let genderFieldUsed = null;
      for (const field of possibleGenderFields) {
        if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
          genderValue = record[field];
          genderFieldUsed = field;
          break;
        }
      }
      
      // Try multiple possible field names for age
      const possibleAgeFields = [
        fields.age,
        'group_individualinfo/Q_32110000',
        'group_intro_001/Q_32110000',
        'group_individualinfo/Q_42110000', 
        'Q_individualinfo/Q_32110000',
        // Also try without group prefixes
        'Q_32110000',
        'Q_42110000'
      ];
      
      let ageValue = null;
      let ageFieldUsed = null;
      for (const field of possibleAgeFields) {
        if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
          ageValue = record[field];
          ageFieldUsed = field;
          break;
        }
      }
      
      if (record === filteredRawData[0]) {
        console.log('Found gender:', genderValue, 'from field:', genderFieldUsed);
        console.log('Found age:', ageValue, 'from field:', ageFieldUsed);
      }
      
      // Extract gender
      if (genderValue) {
        // Find the gender choice label if available
        const genderColumn = displayColumns.find(col => col.key === genderFieldUsed);
        let genderLabel = genderValue;
        if (genderColumn && genderColumn.choices.length > 0) {
          const choice = genderColumn.choices.find(c => c.name === genderValue);
          if (choice) {
            genderLabel = choice.label;
          }
        }
        // If no choice found, use the raw value
        genderStats[genderLabel] = (genderStats[genderLabel] || 0) + 1;
      }
      
      // Extract age
      if (ageValue) {
        // Find the age choice label if available
        const ageColumn = displayColumns.find(col => col.key === ageFieldUsed);
        let ageLabel = ageValue;
        if (ageColumn && ageColumn.choices.length > 0) {
          const choice = ageColumn.choices.find(c => c.name === ageValue);
          if (choice) {
            ageLabel = choice.label;
          }
        }
        // If no choice found, use the raw value
        ageStats[ageLabel] = (ageStats[ageLabel] || 0) + 1;
      }
    });

    // Process table data with choice labels using filtered raw data
    const tableData = filteredRawData.map(record => {
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

    const demographicStats: DemographicStats = {
      genderStats,
      ageStats,
      totalResponses: filteredRawData.length // Use filtered count
    };

    return { displayColumns, tableData, demographicStats };
  }, [data, questions, visibleColumns.size, dateFilter]); // Add dateFilter as dependency

  // Filter and sort data - simplified since date filtering is now handled in the main useMemo
  const filteredAndSortedData = useMemo(() => {
    // Only apply text search filter since date filtering is already done
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
  }, [tableData, searchTerm, sortConfig]); // Remove dateFilter dependency since it's handled earlier

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

  // Early return only if no original data exists
  if (!data.length) {
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
      <div className="border-b border-gray-200 px-3 sm:px-4 py-3">
        {/* Mobile Layout - Stack vertically */}
        <div className="flex flex-col gap-3 sm:hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search responses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Date Filter */}
          <div className="relative">
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Calendar className="h-4 w-4" />
              <span>Date Filter</span>
              {dateFilter.enabled && <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">ON</span>}
              <ChevronDown className={`h-4 w-4 transition-transform ${showDateFilter ? 'rotate-180' : ''}`} />
            </button>
            
            {showDateFilter && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDateFilter(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-20">
                  <div className="p-3">
                    <div className="text-sm font-medium text-gray-900 mb-3">Filter by Date Range</div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={dateFilter.enabled}
                          onChange={(e) => setDateFilter(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Enable date filtering</span>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={dateFilter.startDate}
                          onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                          disabled={!dateFilter.enabled}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                        <input
                          type="date"
                          value={dateFilter.endDate}
                          onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                          disabled={!dateFilter.enabled}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                      
                      <button
                        onClick={() => setDateFilter({ startDate: '', endDate: '', enabled: false })}
                        className="w-full px-2 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Clear Filter
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Demographics Button Row */}
          <div className="relative">
            <button
              onClick={() => setShowDemographics(!showDemographics)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Users className="h-4 w-4" />
              <span>Demographics</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showDemographics ? 'rotate-180' : ''}`} />
            </button>
            
            {showDemographics && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDemographics(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-20">
                  <div className="p-3">
                    <div className="text-sm font-medium text-gray-900 mb-3">Demographics Overview</div>
                    
                    {/* Gender Statistics */}
                    {Object.keys(demographicStats.genderStats).length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Gender Distribution
                        </div>
                        <div className="space-y-1">
                          {Object.entries(demographicStats.genderStats).map(([gender, count]) => (
                            <div key={gender} className="flex justify-between items-center text-sm">
                              <span className="text-gray-700 truncate mr-2">{gender}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-medium text-gray-900">{count}</span>
                                <span className="text-xs text-gray-500">
                                  ({((count / demographicStats.totalResponses) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Age Statistics */}
                    {Object.keys(demographicStats.ageStats).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Age Group Distribution
                        </div>
                        <div className="space-y-1">
                          {Object.entries(demographicStats.ageStats)
                            .sort(([a], [b]) => a.localeCompare(b)) // Sort age groups
                            .map(([ageGroup, count]) => (
                            <div key={ageGroup} className="flex justify-between items-center text-sm">
                              <span className="text-gray-700 truncate mr-2">{ageGroup}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-medium text-gray-900">{count}</span>
                                <span className="text-xs text-gray-500">
                                  ({((count / demographicStats.totalResponses) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.keys(demographicStats.genderStats).length === 0 && Object.keys(demographicStats.ageStats).length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No demographic data available
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Columns Button Row */}
          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Eye className="h-4 w-4" />
              <span>Columns</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showColumnSelector ? 'rotate-180' : ''}`} />
            </button>
            
            {showColumnSelector && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColumnSelector(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-48 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Select Columns</div>
                  </div>
                  {displayColumns.map(col => (
                    <label key={col.key} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumnVisibility(col.key)}
                        className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                      />
                      <span className="text-xs text-gray-700 truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Results Count */}
          <div className="flex justify-center">
            <div className="inline-flex items-center px-3 py-1.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {filteredAndSortedData.length}{" "}
              {filteredAndSortedData.length === 1 ? "record" : "records"}
            </div>
          </div>
        </div>

        {/* Desktop Layout - Keep horizontal */}
        <div className="hidden sm:flex items-center justify-between gap-4">
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

          <div className='flex justify-center items-center gap-3'>
            {/* Date Filter */}
            <div className="relative">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Calendar className="h-4 w-4" />
                Date Filter
                {dateFilter.enabled && <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">ON</span>}
                <ChevronDown className={`h-4 w-4 transition-transform ${showDateFilter ? 'rotate-180' : ''}`} />
              </button>
              
              {showDateFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDateFilter(false)} />
                  <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded shadow-lg z-20">
                    <div className="p-4">
                      <div className="text-sm font-medium text-gray-900 mb-3">Filter by Date Range</div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            checked={dateFilter.enabled}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, enabled: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Enable date filtering</span>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={dateFilter.startDate}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                            disabled={!dateFilter.enabled}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                          <input
                            type="date"
                            value={dateFilter.endDate}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                            disabled={!dateFilter.enabled}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                        
                        <button
                          onClick={() => setDateFilter({ startDate: '', endDate: '', enabled: false })}
                          className="w-full px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Clear Filter
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Demographics Button */}
            <div className="relative">
              <button
                onClick={() => setShowDemographics(!showDemographics)}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Users className="h-4 w-4" />
                Demographics
                <ChevronDown className={`h-4 w-4 transition-transform ${showDemographics ? 'rotate-180' : ''}`} />
              </button>
              
              {showDemographics && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDemographics(false)} />
                  <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded shadow-lg z-20">
                    <div className="p-4">
                      <div className="text-sm font-medium text-gray-900 mb-3">Demographics Overview</div>
                      
                      {/* Gender Statistics */}
                      {Object.keys(demographicStats.genderStats).length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Gender Distribution
                          </div>
                          <div className="space-y-1">
                            {Object.entries(demographicStats.genderStats).map(([gender, count]) => (
                              <div key={gender} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700">{gender}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{count}</span>
                                  <span className="text-xs text-gray-500">
                                    ({((count / demographicStats.totalResponses) * 100).toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Age Statistics */}
                      {Object.keys(demographicStats.ageStats).length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Age Group Distribution
                          </div>
                          <div className="space-y-1">
                            {Object.entries(demographicStats.ageStats)
                              .sort(([a], [b]) => a.localeCompare(b)) // Sort age groups
                              .map(([ageGroup, count]) => (
                              <div key={ageGroup} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700">{ageGroup}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{count}</span>
                                  <span className="text-xs text-gray-500">
                                    ({((count / demographicStats.totalResponses) * 100).toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.keys(demographicStats.genderStats).length === 0 && Object.keys(demographicStats.ageStats).length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No demographic data available
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

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
            <div className="inline-flex items-center px-4 py-2.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
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
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleDisplayColumns.length} className="px-3 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <Search className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm">No records match your search criteria</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or search terms</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50 border-b border-gray-100">
                  {visibleDisplayColumns.map(col => (
                    <td key={col.key} className="px-3 py-2 text-sm text-gray-900 border-r border-gray-100 last:border-r-0">
                      <div className="truncate" title={String(row[col.key])}>
                        {String(row[col.key])}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with Pagination */}
      <div className="border-t border-gray-200 px-3 sm:px-4 py-3">
        {/* Mobile Pagination Layout */}
        <div className="flex flex-col gap-3 sm:hidden">
          {/* Results info */}
          <div className="text-xs text-gray-700 text-center">
            Showing {filteredAndSortedData.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} results
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-2">
              {/* Page info */}
              <div className="text-xs text-gray-500">
                Page {currentPage} of {totalPages}
              </div>
              
              {/* Navigation buttons */}
              <div className="flex items-center justify-center gap-2 w-full">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                >
                  Previous
                </button>
                
                {/* Page numbers - show fewer on mobile */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage <= 2) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 1) {
                      pageNum = totalPages - 2 + i;
                    } else {
                      pageNum = currentPage - 1 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2 py-1 text-xs border rounded min-w-[28px] ${
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
                  className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Pagination Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {filteredAndSortedData.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} results
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
    </div>
  );
}