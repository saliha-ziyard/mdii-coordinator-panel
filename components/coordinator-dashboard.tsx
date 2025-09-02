"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Users, FileText, AlertCircle } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { ApiConfiguration } from "@/components/api-configuration"
import { KoboApiClient, type KoboFormData } from "@/lib/kobo-api"

const BASE_URL = "https://kf.kobotoolbox.org/api/v2"
const TOOL_ID_FIELD = "ID"
const MATURITY_FIELD = "tool_maturity"
const MAIN_FORM_ID = "aJn2DsjpAeJjrB6VazHjtz"

// Form IDs for different user types and maturity levels
const FORM_IDS = {
  direct: {
    advance: "aFfhFi5vpsierwc3b5SNvc",
    early: "aCAhpbKYdsMbnGcWo4yR42",
  },
  indirect: {
    advance: "aU5LwrZps9u7Yt7obeShjv",
    early: "aKhnEosysRHsrUKxanCSKc",
  },
}

interface FormData {
  userType: "direct" | "indirect"
  maturityLevel: "advance" | "early"
  data: any[]
  formId: string
  error?: string
}

export function CoordinatorDashboard() {
  const [toolId, setToolId] = useState("")
  const [loading, setLoading] = useState(false)
  const [maturityLevel, setMaturityLevel] = useState<"advanced" | "early" | null>(null)
  const [formData, setFormData] = useState<KoboFormData[]>([])
  const [error, setError] = useState<string | null>(null)
  // Initialize API client directly with the token
  const [apiClient] = useState<KoboApiClient>(() => new KoboApiClient())


  const handleSearch = async () => {
    if (!toolId.trim()) {
      setError("Please enter a Tool ID")
      return
    }

    setLoading(true)
    setError(null)
    setFormData([])
    setMaturityLevel(null)

    try {
      console.log("[v0] Fetching maturity level for tool ID:", toolId)

      // Step 1: Get maturity level
      const maturity = await apiClient.getToolMaturity(toolId)
      setMaturityLevel(maturity)
      console.log("[v0] Found maturity level:", maturity)

      // Step 2: Fetch survey data with the tool ID
      const results = await apiClient.getAllFormData(maturity, toolId)
      setFormData(results)
      console.log("[v0] Successfully fetched all form data")
    } catch (err) {
      console.error("[v0] Error in handleSearch:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-card-foreground">MDII Coordinator Panel</h1>
        <p className="text-muted-foreground">Enter a Tool ID to view user responses across different tools</p>
      </div>

      {/* Tool ID Input */}
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Tool ID Search
          </CardTitle>
          <CardDescription>Enter the Tool ID to fetch and display related form data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Tool ID (e.g., MDII-test1-310725)..."
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading} className="px-6">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maturity Level Display */}
      {maturityLevel && (
        <div className="text-center">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            Maturity Level: {maturityLevel.charAt(0).toUpperCase() + maturityLevel.slice(1)}
          </Badge>
        </div>
      )}

      {/* Data Tables */}
      {formData.length > 0 && (
        <div className="space-y-6">
          {formData.map((form, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {form.userType === "usertype3" ? <Users className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  {form.userType === "usertype3" ? "UserType III (Direct Users)" : "UserType IV (Indirect Users)"}
                  <Badge variant="outline">
                    {form.maturityLevel} - {form.data.length} responses
                  </Badge>
                  {form.error && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Form ID: {form.formId}
                  {form.error && <span className="text-destructive ml-2">- {form.error}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {form.data.length > 0 ? (
                  <DataTable data={form.data} questions={form.questions || []} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {form.error ? "Failed to load data" : "No matching responses found for this tool ID"}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Fetching data from Kobo forms...</p>
        </div>
      )}
    </div>
  )
}