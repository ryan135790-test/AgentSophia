import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SetupAdmin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    checkAdminExists();
  }, []);

  const checkAdminExists = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (error) throw error;
      setAdminExists(data && data.length > 0);
    } catch (error) {
      console.error('Error checking admin:', error);
      toast({
        title: 'Error',
        description: 'Failed to check admin status',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const claimAdmin = async () => {
    if (!user) return;

    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc('claim_admin_role' as any) as { 
        data: { success: boolean; message: string } | null; 
        error: any 
      };

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to claim admin role');
      }

      toast({
        title: 'Success!',
        description: 'You are now an admin. Redirecting...',
      });

      setTimeout(() => {
        navigate('/');
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Error claiming admin:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to claim admin role',
        variant: 'destructive',
      });
    } finally {
      setClaiming(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Login Required
            </CardTitle>
            <CardDescription>
              You must be logged in to set up admin access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Admin Already Exists
            </CardTitle>
            <CardDescription>
              An admin user has already been set up for this application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                If you need admin access, please contact the existing administrator.
              </AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/')} className="w-full mt-4">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Claim Admin Access
          </CardTitle>
          <CardDescription>
            No admin user exists yet. You can claim admin privileges now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              As the first admin, you'll have full access to all administrative features of the platform.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Logged in as: <span className="font-medium">{user.email}</span>
            </p>
          </div>
          <Button
            onClick={claimAdmin}
            disabled={claiming}
            className="w-full"
            data-testid="button-claim-admin"
          >
            {claiming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Claiming Admin...
              </>
            ) : (
              'Claim Admin Role'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
