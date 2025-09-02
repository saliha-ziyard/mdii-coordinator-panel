"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, Search } from "lucide-react"

interface DataTableProps {
  data: any[]
}

export function DataTable({ data }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Get all unique columns from the data
  const columns = useMemo(() => {
    if (!data || data.length === 0) return []

    const allKeys = new Set<string>()
    data.forEach((row) => {
      Object.keys(row).forEach((key) => allKeys.add(key))
    })

    return Array.from(allKeys).filter(
      (key) =>
        !key.startsWith("_") && // Filter out internal fields
        key !== "__version__" &&
        key !== "formhub/uuid",
    )
  }, [data])

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data

    // Apply search filter
    if (searchTerm) {
      filtered = data.filter((row) =>
        Object.values(row).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]

        if (aVal === bVal) return 0

        const comparison = aVal < bVal ? -1 : 1
        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return filtered
  }, [data, searchTerm, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return "-"
    if (typeof value === "object") return JSON.stringify(value)
    if (typeof value === "boolean") return value ? "Yes" : "No"
    return String(value)
  }

  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No data available</div>
  }

  return (
    <div className="space-y-4">
      {/* Search and Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {processedData.length} of {data.length} records
          </Badge>
          <Badge variant="outline">{columns.length} columns</Badge>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column} className="min-w-32">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort(column)}
                    >
                      <span className="truncate max-w-32" title={column}>
                        {column.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      {sortColumn === column &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="ml-1 h-3 w-3" />
                        ))}
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.map((row, index) => (
                <TableRow key={index} className="hover:bg-muted/30">
                  {columns.map((column) => (
                    <TableCell key={column} className="max-w-48">
                      <div className="truncate" title={formatCellValue(row[column])}>
                        {formatCellValue(row[column])}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {processedData.length === 0 && searchTerm && (
        <div className="text-center py-8 text-muted-foreground">No results found for "{searchTerm}"</div>
      )}
    </div>
  )
}
