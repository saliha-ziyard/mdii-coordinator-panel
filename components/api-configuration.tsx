"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Key, CheckCircle } from "lucide-react"

interface ApiConfigurationProps {
  onApiTokenSet: (token: string) => void
  isTokenSet: boolean
}

export function ApiConfiguration({ onApiTokenSet, isTokenSet }: ApiConfigurationProps) {
  const [apiToken, setApiToken] = useState("")
  const [showToken, setShowToken] = useState(false)

  const handleSetToken = () => {
    if (apiToken.trim()) {
      onApiTokenSet(apiToken.trim())
      setApiToken("")
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Configuration
          {isTokenSet && (
            <Badge variant="secondary" className="ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isTokenSet
            ? "API token is configured. You can now fetch data from Kobo forms."
            : "Enter your Kobo API token to access form data. You can find this in your Kobo account settings."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isTokenSet && (
          <>
            <div className="space-y-2">
              <Label htmlFor="api-token">API Token</Label>
              <div className="flex gap-2">
                <Input
                  id="api-token"
                  type={showToken ? "text" : "password"}
                  placeholder="Enter your Kobo API token..."
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => setShowToken(!showToken)}>
                  {showToken ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
            <Button onClick={handleSetToken} disabled={!apiToken.trim()} className="w-full">
              Set API Token
            </Button>
          </>
        )}

        {isTokenSet && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Ready to fetch data from Kobo forms
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Note:</strong> Your API token is stored locally and not sent to any external servers except Kobo.
          </p>
          <p>To get your API token: Kobo Account → Settings → API Token</p>
        </div>
      </CardContent>
    </Card>
  )
}
