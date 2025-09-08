import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest, fetchCsrfToken, apiRequestWithCsrfFallback } from '@/lib/queryClient';

/**
 * CSRF Token Demonstration Component
 * Shows how the CSRF token endpoint and enhanced client functions work
 */
export default function CsrfDemo() {
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [clientName, setClientName] = useState<string>('Test Client');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFetchCsrfToken = async () => {
    setIsLoading(true);
    setStatus('Fetching CSRF token...');
    try {
      const token = await fetchCsrfToken();
      setCsrfToken(token);
      setStatus('✅ CSRF token fetched successfully');
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClientWithManualToken = async () => {
    if (!csrfToken) {
      setStatus('❌ Please fetch CSRF token first');
      return;
    }

    setIsLoading(true);
    setStatus('Creating client with manual CSRF token...');
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          name: clientName,
          company: 'Demo Company',
          email: `${clientName.toLowerCase().replace(/\s+/g, '')}@demo.com`
        })
      });

      if (response.ok) {
        setStatus('✅ Client created successfully with manual CSRF token');
      } else {
        const errorText = await response.text();
        setStatus(`❌ Error: ${response.status} ${errorText}`);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClientWithAutoToken = async () => {
    setIsLoading(true);
    setStatus('Creating client with automatic CSRF handling...');
    try {
      await apiRequestWithCsrfFallback('POST', '/api/clients', {
        name: `${clientName} (Auto)`,
        company: 'Auto Demo Company',
        email: `${clientName.toLowerCase().replace(/\s+/g, '')}auto@demo.com`
      });
      setStatus('✅ Client created successfully with automatic CSRF handling');
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClientOldWay = async () => {
    setIsLoading(true);
    setStatus('Creating client with existing apiRequest (cookie-based)...');
    try {
      await apiRequest('POST', '/api/clients', {
        name: `${clientName} (Cookie)`,
        company: 'Cookie Demo Company',
        email: `${clientName.toLowerCase().replace(/\s+/g, '')}cookie@demo.com`
      });
      setStatus('✅ Client created successfully with cookie-based CSRF');
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>CSRF Token Demonstration</CardTitle>
          <CardDescription>
            This page demonstrates the new CSRF token endpoint and enhanced client-side handling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status display */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2">Status:</h3>
            <div className="text-sm">
              {status || 'Ready to test CSRF functionality'}
            </div>
          </div>

          {/* Current CSRF token display */}
          <div className="space-y-2">
            <h3 className="font-medium">Current CSRF Token:</h3>
            <div className="flex items-center space-x-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                {csrfToken || 'No token fetched yet'}
              </code>
              <Badge variant={csrfToken ? 'default' : 'secondary'}>
                {csrfToken ? 'Available' : 'Not set'}
              </Badge>
            </div>
          </div>

          {/* Client name input */}
          <div className="space-y-2">
            <label htmlFor="clientName" className="font-medium">Test Client Name:</label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name for testing"
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="font-medium">Step 1: Fetch CSRF Token</h3>
              <Button 
                onClick={handleFetchCsrfToken}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Fetching...' : 'Fetch CSRF Token from /api/csrf-token'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Gets the CSRF token from the new endpoint that returns JSON: <code>{"{ token: '...' }"}</code>
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Step 2: Test CSRF Protection</h3>
              <div className="space-y-2">
                <Button 
                  onClick={handleCreateClientWithManualToken}
                  disabled={isLoading || !csrfToken}
                  variant="default"
                  className="w-full"
                >
                  Create Client (Manual CSRF)
                </Button>
                <Button 
                  onClick={handleCreateClientWithAutoToken}
                  disabled={isLoading}
                  variant="secondary"
                  className="w-full"
                >
                  Create Client (Auto CSRF)
                </Button>
                <Button 
                  onClick={handleCreateClientOldWay}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  Create Client (Cookie-based)
                </Button>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Manual CSRF:</strong> Explicitly fetches token from <code>/api/csrf-token</code> and includes it in headers</li>
              <li>• <strong>Auto CSRF:</strong> Uses <code>apiRequestWithCsrfFallback</code> that automatically fetches token if not in cookies</li>
              <li>• <strong>Cookie-based:</strong> Uses existing <code>apiRequest</code> that reads token from cookies (set during login)</li>
              <li>• All approaches should work and pass CSRF validation on the server</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}