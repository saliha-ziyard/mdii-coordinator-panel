// app/api/kobo/route.ts
import { NextRequest, NextResponse } from 'next/server'

const API_TOKEN = "fc37a9329918014ef595b183adcef745a4beb217"
const BASE_URL = "https://kf.kobotoolbox.org/api/v2"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const formId = searchParams.get('formId')
  
  if (!formId) {
    return NextResponse.json({ error: 'Missing formId parameter' }, { status: 400 })
  }

  const url = `${BASE_URL}/assets/${formId}/data.json`
  
  try {
    console.log(`Server: Fetching data from: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Token ${API_TOKEN}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      // Add timeout
      signal: AbortSignal.timeout(45000), // Increased to 45 seconds for multiple form fetches
    })

    console.log(`Server: Status: ${response.status} for form: ${formId}`)

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      if (response.status === 401) {
        errorMessage = "Authentication failed. Check your API token."
      } else if (response.status === 403) {
        errorMessage = `Access forbidden. Check permissions for form ID: ${formId}`
      } else if (response.status === 404) {
        errorMessage = `Form not found. Check form ID: ${formId}`
      } else {
        try {
          const errorText = await response.text()
          errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 200)}...`
        } catch {
          // Keep default error message if we can't read the response
        }
      }
      
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const data = await response.json()
    const results = data.results || []
    
    console.log(`Server: SUCCESS! Found ${results.length} records for form ${formId}`)
    
    return NextResponse.json({
      results,
      count: data.count || results.length,
      next: data.next,
      previous: data.previous,
    })

  } catch (error) {
    console.error(`Server: Network error for form ${formId}:`, error)
    
    let errorMessage = 'Network error occurred'
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out'
      } else {
        errorMessage = `Network error: ${error.message}`
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}