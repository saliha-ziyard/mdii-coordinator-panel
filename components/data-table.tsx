import React, { useMemo } from 'react';

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

        processedRecord[col.key] = value ?? '-'; // Use nullish coalescing for undefined/null
      });
      return processedRecord;
    });

    return { displayColumns, tableData };
  }, [data, questions]);

  if (!tableData.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
              Response #
            </th>
            {displayColumns.map(column => (
              <th
                key={column.key}
                className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider min-w-[200px]"
                title={column.key} // Show field name on hover
              >
                <div className="space-y-1">
                  <div className="font-semibold">{column.label}</div>
                  <div className="text-xs text-gray-500 normal-case">
                    {column.key}
                  </div>
                  {/* {column.type !== 'text' && (
                    <div className="text-xs text-blue-600 normal-case">
                      {column.type}
                    </div>
                  )} */}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tableData.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                {index + 1}
              </td>
              {displayColumns.map(column => (
                <td
                  key={column.key}
                  className="border border-gray-300 px-3 py-2 text-sm text-gray-900 max-w-xs"
                >
                  <div className="break-words">{row[column.key]}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompactDataTable({ data, questions }: DataTableProps) {
  // Interface for question answers to ensure no null values
  interface QuestionAnswer {
    question: string;
    answer: string;
    fieldName: string;
  }

  const processedData = useMemo(() => {
    if (!data.length) return [];

    // Get unique field names in the order they appear in the first record (JSON order)
    const firstRecord = data[0] || {};
    const orderedFields = Object.keys(firstRecord).filter(
      key =>
        !key.startsWith('_') &&
        !key.startsWith('formhub/') &&
        !key.startsWith('meta/') &&
        key !== '__version__'
    );

    return data.map((record, index) => {
      const questionAnswers: QuestionAnswer[] = orderedFields
        .map(fieldName => {
          // Normalize fieldName to match Excel (remove group prefix)
          const normalizedField = fieldName.split('/').pop() || fieldName;
          const question = questions.find(
            q => q.name === normalizedField || q.name === fieldName
          );
          if (!question) return null; // Skip if no matching question in Excel

          let displayValue = String(record[fieldName] ?? '-');

          // Convert choice values to labels if available
          if (record[fieldName] && question.choices) {
            const choice = question.choices.find(c => c.name === record[fieldName]);
            if (choice) {
              displayValue = choice.label;
            }
          }

          return {
            question: question.label || 'Unknown Question',
            answer: displayValue,
            fieldName
          };
        })
        .filter((qa): qa is QuestionAnswer => qa !== null) // Type guard to exclude null
        .sort((a, b) => {
          // Put tool ID fields first, preserve JSON order for others
          if (a.fieldName.includes('toolid') || a.fieldName.includes('Q_13110000')) return -1;
          if (b.fieldName.includes('toolid') || b.fieldName.includes('Q_13110000')) return 1;
          return 0; // Preserve original JSON order
        });

      return {
        responseNumber: index + 1,
        questionAnswers
      };
    });
  }, [data, questions]);

  if (!processedData.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {processedData.map(response => (
        <div key={response.responseNumber} className="border rounded-lg p-4">
          <h4 className="font-semibold text-lg mb-4 text-blue-600">
            Response #{response.responseNumber}
          </h4>
          <div className="grid gap-3">
            {response.questionAnswers.map((qa, qaIndex) => (
              <div
                key={qaIndex}
                className="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-700">{qa.question}</div>
                <div className="text-gray-900 md:col-span-2">{qa.answer}</div>
                <div className="text-xs text-gray-500 md:col-span-3">
                  Field: {qa.fieldName}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}