import { Check, ChevronDown, Linkedin, Plus, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLinkedInAccount } from "@/contexts/LinkedInAccountContext";
import { initiateLinkedInOAuth } from "@/lib/linkedin-oauth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

interface LinkedInAccountSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function LinkedInAccountSwitcher({ className, compact = false }: LinkedInAccountSwitcherProps) {
  const { currentAccount, accounts, loading, setCurrentAccount } = useLinkedInAccount();
  const { currentWorkspace } = useWorkspace();

  const handleAddAccount = () => {
    if (!currentWorkspace?.id) {
      console.error('No workspace selected');
      return;
    }
    try {
      initiateLinkedInOAuth(currentWorkspace.id);
    } catch (error) {
      console.error('Failed to start LinkedIn OAuth:', error);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Linkedin className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  if (accounts.length === 0) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleAddAccount}
        className={cn("gap-2", className)}
        data-testid="button-connect-linkedin"
      >
        <Linkedin className="h-4 w-4" />
        Connect LinkedIn
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("gap-2", className)}
          data-testid="dropdown-linkedin-account"
        >
          <Avatar className="h-5 w-5">
            {currentAccount?.profile_data?.picture ? (
              <AvatarImage src={currentAccount.profile_data.picture} alt={currentAccount.account_name} />
            ) : null}
            <AvatarFallback className="bg-[#0077B5] text-white text-xs">
              <Linkedin className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <span className="max-w-[150px] truncate">
              {currentAccount?.account_name || 'Select Account'}
            </span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Linkedin className="h-4 w-4 text-[#0077B5]" />
          LinkedIn Accounts
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.id}
            onClick={() => setCurrentAccount(account)}
            className="flex items-center gap-2 cursor-pointer"
            data-testid={`menu-item-linkedin-${account.id}`}
          >
            <Avatar className="h-6 w-6">
              {account.profile_data?.picture ? (
                <AvatarImage src={account.profile_data.picture} alt={account.account_name} />
              ) : null}
              <AvatarFallback className="bg-[#0077B5] text-white text-xs">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{account.account_name}</div>
              {account.profile_data?.email && (
                <div className="text-xs text-muted-foreground truncate">
                  {account.profile_data.email}
                </div>
              )}
            </div>
            {!account.is_active && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
            {currentAccount?.id === account.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleAddAccount}
          className="flex items-center gap-2 cursor-pointer text-primary"
          data-testid="menu-item-add-linkedin"
        >
          <Plus className="h-4 w-4" />
          Add Another Account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
