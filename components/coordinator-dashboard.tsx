"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Users, FileText, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { KoboApiClient, type KoboFormData } from "@/lib/kobo-api"

// Form IDs for innovators and domain experts
const INNOVATOR_FORMS = {
  leadership: "afiUqEoYaGMS8RaygTPuAR",
  technical: "aqxEbPgQTMQQqe42ZFW2cc",
  projectManager: "auq274db5dfNGasdH4bWdU"
}

const DOMAIN_EXPERT_FORMS = {
  advanced: "ap6dUEDwX7KUsKLFZUD7kb",
  early: "au52CRd6ATzV7S36WcAdDu"
}

// Mapping of domain codes to full names
const DOMAIN_CODE_MAPPING: { [key: string]: string } = {
  'ce': 'Country Expert',
  'country_expert': 'Country Expert',
  'data': 'Data',
  'econ': 'Economics',
  'gesi': 'Gender Equity and Social Inclusion',
  'hcd': 'Human-Centered Design',
  'ict': 'Information and Communication Technologies'
}

const DOMAIN_CATEGORIES = {
  advanced: [
    "Country Expert",
    "Data", 
    "Economics",
    "Gender Equity and Social Inclusion",
    "Human-Centered Design",
    "Information and Communication Technologies"
  ],
  early: [
    "Country Expert",
    "Data",
    "Economics", 
    "Gender Equity and Social Inclusion",
    "Information and Communication Technologies"
  ]
}

interface InnovatorStatus {
  role: string
  formId: string
  submitted: boolean
  submissionCount: number
  error?: string
}

interface DomainExpertStatus {
  category: string
  maturityLevel: "advanced" | "early"
  submitted: boolean
  submissionCount: number
}

interface OverallStatus {
  innovators: InnovatorStatus[]
  domainExperts: DomainExpertStatus[]
  loading: boolean
  error?: string
}

export function CoordinatorDashboard() {
  const [toolId, setToolId] = useState("")
  const [loading, setLoading] = useState(false)
  const [maturityLevel, setMaturityLevel] = useState<"advanced" | "early" | null>(null)
  const [formData, setFormData] = useState<KoboFormData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [overallStatus, setOverallStatus] = useState<OverallStatus>({
    innovators: [],
    domainExperts: [],
    loading: false
  })
  
  const [apiClient] = useState<KoboApiClient>(() => new KoboApiClient())

  // Check innovators and domain experts status
  const checkOverallStatus = async (toolId: string, maturityLevel: "advanced" | "early") => {
    setOverallStatus(prev => ({ ...prev, loading: true, error: undefined }))
    
    try {
      // Check innovators - each form uses group_requester/Q_13110000 for Tool ID
      const innovatorPromises = Object.entries(INNOVATOR_FORMS).map(async ([role, formId]) => {
        try {
          console.log(`Checking ${role} form (${formId}) for Tool ID: ${toolId}`)
          const data = await apiClient.fetchData(formId)
          const matchingRecords = data.results.filter(record => {
            // All innovator forms use group_requester/Q_13110000 for Tool ID
            const recordToolId = String(record["group_requester/Q_13110000"] || "").trim()
            console.log(`${role}: Found Tool ID '${recordToolId}' comparing with '${toolId}'`)
            return recordToolId === String(toolId).trim()
          })
          
          console.log(`${role}: Found ${matchingRecords.length} matching records`)
          
          return {
            role: role === 'projectManager' ? 'Project Manager' : role.charAt(0).toUpperCase() + role.slice(1),
            formId,
            submitted: matchingRecords.length > 0,
            submissionCount: matchingRecords.length
          }
        } catch (err) {
          console.error(`Error checking ${role} form:`, err)
          return {
            role: role === 'projectManager' ? 'Project Manager' : role.charAt(0).toUpperCase() + role.slice(1),
            formId,
            submitted: false,
            submissionCount: 0,
            error: err instanceof Error ? err.message : "Unknown error"
          }
        }
      })

      // Check domain experts
      const domainExpertFormId = DOMAIN_EXPERT_FORMS[maturityLevel]
      let domainExpertStatuses: DomainExpertStatus[] = []
      
      try {
        console.log(`Checking Domain Expert form (${domainExpertFormId}) for maturity: ${maturityLevel}`)
        const data = await apiClient.fetchData(domainExpertFormId)
        
        // Find records with matching Tool ID - domain expert forms use group_intro/Q_13110000
        const matchingRecords = data.results.filter(record => {
          const recordToolId = String(
            record["group_intro/Q_13110000"] || 
            record["group_requester/Q_13110000"] ||
            record["Q_13110000"] || 
            ""
          ).trim()
          console.log(`Domain Expert: Found Tool ID '${recordToolId}' comparing with '${toolId}'`)
          return recordToolId === String(toolId).trim()
        })

        console.log(`Domain Experts: Found ${matchingRecords.length} matching records`)

        // Parse domain categories - different field names for different maturity levels
        const categorySubmissions = new Map<string, number>()
        
        matchingRecords.forEach(record => {
          // Get the expertise string based on maturity level
          const expertiseString = String(
            maturityLevel === 'early' 
              ? record["group_individualinfo/Q_22300000"] || ""
              : record["group_intro_001/Q_22300000"] || ""
          ).trim().toLowerCase()
          
          console.log(`Found expertise string for ${maturityLevel}: '${expertiseString}'`)
          
          if (expertiseString) {
            // Split by spaces and map codes to full names
            const expertiseCodes = expertiseString.split(/\s+/)
            expertiseCodes.forEach(code => {
              const fullName = DOMAIN_CODE_MAPPING[code]
              if (fullName) {
                console.log(`Mapped code '${code}' to category '${fullName}'`)
                categorySubmissions.set(fullName, (categorySubmissions.get(fullName) || 0) + 1)
              }
            })
          }
        })

        domainExpertStatuses = DOMAIN_CATEGORIES[maturityLevel].map(category => ({
          category,
          maturityLevel,
          submitted: categorySubmissions.has(category) && categorySubmissions.get(category)! > 0,
          submissionCount: categorySubmissions.get(category) || 0
        }))
      } catch (err) {
        console.error("Could not fetch domain expert data:", err)
        domainExpertStatuses = DOMAIN_CATEGORIES[maturityLevel].map(category => ({
          category,
          maturityLevel,
          submitted: false,
          submissionCount: 0
        }))
      }

      const innovators = await Promise.all(innovatorPromises)
      
      setOverallStatus({
        innovators,
        domainExperts: domainExpertStatuses,
        loading: false
      })
    } catch (err) {
      setOverallStatus(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error"
      }))
    }
  }

  const handleSearch = async () => {
    if (!toolId.trim()) {
      setError("Please enter a Tool ID")
      return
    }

    setLoading(true)
    setError(null)
    setFormData([])
    setMaturityLevel(null)
    setOverallStatus({ innovators: [], domainExperts: [], loading: false })

    try {
      console.log("[v0] Fetching maturity level for tool ID:", toolId)

      // Step 1: Get maturity level
      const maturity = await apiClient.getToolMaturity(toolId)
      setMaturityLevel(maturity)
      console.log("[v0] Found maturity level:", maturity)

      // Step 2: Check overall status (innovators + domain experts)
      await checkOverallStatus(toolId, maturity)

      // Step 3: Fetch survey data with the tool ID
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

  const getStatusIcon = (submitted: boolean, hasError?: boolean) => {
    if (hasError) return <XCircle className="h-4 w-4 text-red-500" />
    return submitted ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-gray-400" />
  }

  const getStatusText = (submitted: boolean, hasError?: boolean) => {
    if (hasError) return "Error"
    return submitted ? "Submitted" : "Not Submitted"
  }

  const getStatusClass = (submitted: boolean, hasError?: boolean) => {
    if (hasError) return "text-red-600"
    return submitted ? "text-green-600" : "text-gray-500"
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2"><span style={{ color: "#591fd5" }}>MDII</span> <span style={{ color: "#cbced4" }}>|</span> Coordinator Panel</h1>
          <p className="text-gray-600">Track and manage all form submissions for Tool IDs</p>
        </div>

        {/* Search Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Tool ID Search</h2>
          
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Enter Tool ID (e.g., MDII-test1-310725)"
                value={toolId}
                onChange={(e) => setToolId(e.target.value)}
                onKeyPress={handleKeyPress}
                className="h-10"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="h-10 px-6 cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {maturityLevel && (
            <div className="mt-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Maturity Level: {maturityLevel.charAt(0).toUpperCase() + maturityLevel.slice(1)}
              </span>
            </div>
          )}
        </div>

        {/* Team Status Section */}
        {(overallStatus.innovators.length > 0 || overallStatus.domainExperts.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            
            {/* Innovators Team */}
            {overallStatus.innovators.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Innovators Team</h3>
                  <p className="text-sm text-gray-600">Leadership, Technical Lead, and Project Manager</p>
                </div>
                <div className="p-6">
                  {overallStatus.loading ? (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking status...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {overallStatus.innovators.map((innovator) => (
                        <div key={innovator.role} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(innovator.submitted, !!innovator.error)}
                            <span className="text-sm font-medium text-gray-900">{innovator.role}</span>
                          </div>
                          <span className={`text-sm font-medium ${getStatusClass(innovator.submitted, !!innovator.error)}`}>
                            {getStatusText(innovator.submitted, !!innovator.error)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Domain Experts */}
            {overallStatus.domainExperts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Domain Experts</h3>
                  <p className="text-sm text-gray-600">Expert submissions by domain ({maturityLevel})</p>
                </div>
                <div className="p-6">
                  {overallStatus.loading ? (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking status...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {overallStatus.domainExperts.map((expert) => (
                        <div key={expert.category} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(expert.submitted)}
                            <span className="text-sm text-gray-900">{expert.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${getStatusClass(expert.submitted)}`}>
                              {getStatusText(expert.submitted)}
                            </span>
                            {expert.submitted && (
                              <span className="text-xs text-gray-500">({expert.submissionCount})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Survey Data */}
        {formData.length > 0 && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">User Survey Responses</h2>
              <p className="text-gray-600">Direct and Indirect user feedback</p>
            </div>
            
            {formData.map((form, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {form.userType === "usertype3" ? "Direct Users" : "Indirect Users"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Form ID: {form.formId} • {form.data.length} responses
                        {form.error && <span className="text-red-600"> • Error: {form.error}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {form.error && <AlertCircle className="h-5 w-5 text-red-500" />}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {form.data.length > 0 ? (
                    <DataTable data={form.data} questions={form.questions || []} />
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        {form.error ? "Failed to load data" : "No matching responses"}
                      </h3>
                      <p className="text-gray-500">
                        {form.error ? "Please try again later" : "No responses found for this tool ID"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Data</h3>
              <p className="text-gray-600">Fetching comprehensive data from all forms...</p>
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        {(overallStatus.innovators.length > 0 || overallStatus.domainExperts.length > 0 || formData.length > 0) && (
          <div className="bg-white border border-gray-200 rounded-lg mt-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Summary</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
                <div>
                  <div className="text-2xl font-semibold text-gray-900 mb-1">
                    {overallStatus.innovators.filter(i => i.submitted).length}/{overallStatus.innovators.length}
                  </div>
                  <div className="text-sm text-gray-600">Innovators</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900 mb-1">
                    {overallStatus.domainExperts.filter(e => e.submitted).length}/{overallStatus.domainExperts.length}
                  </div>
                  <div className="text-sm text-gray-600">Domain Experts</div>
                </div>
                <div>
                <div className="text-2xl font-semibold text-gray-900 mb-1">
                  {formData
                    .reduce((sum, form) => sum + form.data.length, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Users</div>
                </div>

                <div>
                  <div className="text-2xl font-semibold text-gray-900 mb-1">
                    {formData
                      .filter(form => form.userType !== "usertype3")
                      .reduce((sum, form) => sum + form.data.length, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Indirect Users</div>
                </div>

                <div>
                  <div className="text-2xl font-semibold text-gray-900 mb-1">
                    {formData
                      .filter(form => form.userType === "usertype3")
                      .reduce((sum, form) => sum + form.data.length, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Direct Users</div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}