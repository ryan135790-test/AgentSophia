import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Linkedin, CheckCircle, AlertCircle } from "lucide-react";
import { initiateLinkedInOAuth, getLinkedInConnection, disconnectLinkedIn, isLinkedInTokenExpired } from "@/lib/linkedin-oauth";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LinkedInConnectButtonProps {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showStatus?: boolean;
  workspaceId?: string;
}

export function LinkedInConnectButton({ 
  variant = "default", 
  size = "default",
  showStatus = true,
  workspaceId: propWorkspaceId
}: LinkedInConnectButtonProps) {
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  
  const workspaceId = propWorkspaceId || currentWorkspace?.id;

  useEffect(() => {
    loadConnection();
  }, [workspaceId]);

  const loadConnection = async () => {
    setLoading(true);
    const conn = await getLinkedInConnection(workspaceId);
    setConnection(conn);
    setLoading(false);
  };

  const handleConnect = () => {
    try {
      if (!workspaceId) {
        toast({
          title: "No Workspace Selected",
          description: "Please select a workspace before connecting LinkedIn.",
          variant: "destructive",
        });
        return;
      }
      initiateLinkedInOAuth(workspaceId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectLinkedIn(workspaceId);
      setConnection(null);
      setShowDisconnectDialog(false);
      toast({
        title: "LinkedIn Disconnected",
        description: "Your LinkedIn account has been disconnected successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled data-testid="button-linkedin-loading">
        <Linkedin className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  const isExpired = connection && isLinkedInTokenExpired(connection);

  if (connection && !isExpired) {
    return (
      <>
        <div className="flex items-center gap-2">
          {showStatus && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>
                Connected as <span className="font-medium">{connection.account_name}</span>
              </span>
            </div>
          )}
          <Button 
            variant="outline" 
            size={size}
            onClick={() => setShowDisconnectDialog(true)}
            data-testid="button-disconnect-linkedin"
          >
            Disconnect
          </Button>
        </div>

        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect LinkedIn?</AlertDialogTitle>
              <AlertDialogDescription>
                This will disconnect your LinkedIn account ({connection.account_name}). 
                You'll need to reconnect to use LinkedIn features.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect}>
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (connection && isExpired) {
    return (
      <div className="flex items-center gap-2">
        {showStatus && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Token expired</span>
          </div>
        )}
        <Button 
          variant={variant} 
          size={size}
          onClick={handleConnect}
          data-testid="button-reconnect-linkedin"
        >
          <Linkedin className="h-4 w-4 mr-2" />
          Reconnect LinkedIn
        </Button>
      </div>
    );
  }

  return (
    <Button 
      variant={variant} 
      size={size}
      onClick={handleConnect}
      data-testid="button-connect-linkedin"
    >
      <Linkedin className="h-4 w-4 mr-2" />
      Connect LinkedIn
    </Button>
  );
}
