"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Users, FileText, AlertCircle, CheckCircle, XCircle, UserCheck, Briefcase, GraduationCap } from "lucide-react"
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
  // 'economics': 'Economics', 
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

        // Parse domain categories from group_individualinfo/Q_22300000
        const categorySubmissions = new Map<string, number>()
        
        matchingRecords.forEach(record => {
          // Get the expertise string like "ce data econ gesi hcd ict"
          const expertiseString = String(
            // record["group_individualinfo/Q_22300000"] || 
            record["group_individual/Q_22300000"] ||
            record["group_intro_001/Q_22300000"] ||
            // record["Q_22300000"] ||
            ""
          ).trim().toLowerCase()
          
          console.log(`Found expertise string: '${expertiseString}'`)
          
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
    if (hasError) return <XCircle className="h-4 w-4 text-destructive" />
    return submitted ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-red-600" />
  }

  const getStatusBadge = (submitted: boolean, count: number, hasError?: boolean) => {
    if (hasError) return <Badge variant="destructive">Error</Badge>
    return submitted ? 
      <Badge variant="default" className="bg-green-600">{count} submitted</Badge> : 
      <Badge variant="secondary">Not submitted</Badge>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-card-foreground">MDII Coordinator Panel</h1>
        <p className="text-muted-foreground">Comprehensive tracking of all submissions for a Tool ID</p>
      </div>

      {/* Tool ID Input */}
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Tool ID Search
          </CardTitle>
          <CardDescription>Enter the Tool ID to fetch and display all related form submissions</CardDescription>
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

      {/* Innovators Status */}
      {overallStatus.innovators.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Innovators Team Status
            </CardTitle>
            <CardDescription>Leadership, Technical Lead, and Project Manager submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {overallStatus.loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking innovators status...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {overallStatus.innovators.map((innovator) => (
                  <div key={innovator.role} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(innovator.submitted, !!innovator.error)}
                      <span className="font-medium">{innovator.role}</span>
                    </div>
                    {getStatusBadge(innovator.submitted, innovator.submissionCount, !!innovator.error)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Domain Experts Status */}
      {overallStatus.domainExperts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Domain Experts Status ({maturityLevel?.charAt(0).toUpperCase()}{maturityLevel?.slice(1)})
            </CardTitle>
            <CardDescription>Expert submissions by domain category</CardDescription>
          </CardHeader>
          <CardContent>
            {overallStatus.loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking domain experts status...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overallStatus.domainExperts.map((expert) => (
                  <div key={expert.category} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(expert.submitted)}
                      <span className="font-medium text-sm">{expert.category}</span>
                    </div>
                    {getStatusBadge(expert.submitted, expert.submissionCount)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Survey Data Tables */}
      {formData.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">User Survey Responses</h2>
            <p className="text-muted-foreground">Direct and Indirect user feedback for the tool</p>
          </div>
          
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
          <p className="text-muted-foreground">Fetching comprehensive data from all Kobo forms...</p>
        </div>
      )}

      {/* Summary Stats */}
      {(overallStatus.innovators.length > 0 || overallStatus.domainExperts.length > 0 || formData.length > 0) && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Submission Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {overallStatus.innovators.filter(i => i.submitted).length}/{overallStatus.innovators.length}
                </div>
                <div className="text-sm text-muted-foreground">Innovators</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {overallStatus.domainExperts.filter(e => e.submitted).length}/{overallStatus.domainExperts.length}
                </div>
                <div className="text-sm text-muted-foreground">Domain Experts</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {formData.reduce((sum, form) => sum + form.data.length, 0)}
                </div>
                <div className="text-sm text-muted-foreground">User Responses</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {overallStatus.innovators.filter(i => i.submitted).length + 
                   overallStatus.domainExperts.filter(e => e.submitted).length + 
                   formData.reduce((sum, form) => sum + form.data.length, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Submissions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}