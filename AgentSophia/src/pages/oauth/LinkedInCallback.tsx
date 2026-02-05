import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { handleLinkedInCallback } from "@/lib/linkedin-oauth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";

export function LinkedInCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting your LinkedIn account...');
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    const processCallback = async () => {
      const urlParams = new URLSearchParams(location.search);
      
      const result = await handleLinkedInCallback(urlParams);

      if (result.success) {
        setStatus('success');
        setMessage('LinkedIn account connected successfully!');
        setProfileData(result.profile);
        
        // Invalidate the social connections query so the UI refreshes
        queryClient.invalidateQueries({ queryKey: ['/api/social-connections'] });
        
        // Redirect to My Connections page after 2 seconds
        setTimeout(() => {
          navigate('/my-connections');
        }, 2000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Failed to connect LinkedIn account');
      }
    };

    processCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'loading' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting LinkedIn
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Success!
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                Connection Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          
          {profileData && (
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
              {profileData.picture && (
                <img 
                  src={profileData.picture} 
                  alt={profileData.name}
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{profileData.name}</p>
                <p className="text-sm text-muted-foreground">{profileData.email}</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <Button 
              onClick={() => navigate('/my-connections')}
              className="w-full"
              data-testid="button-return-connectors"
            >
              Return to My Connections
            </Button>
          )}

          {status === 'success' && (
            <p className="text-sm text-center text-muted-foreground">
              Redirecting to My Connections...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
