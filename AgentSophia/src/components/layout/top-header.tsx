import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { Crown, LogOut, User, Settings, Home, Building2, ChevronDown, Check, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { HelpBot } from "@/components/help-bot/HelpBot";

interface TopHeaderProps {
  onMobileMenuToggle?: () => void;
}

export function TopHeader({ onMobileMenuToggle }: TopHeaderProps) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { currentWorkspace, workspaces, setCurrentWorkspace, loading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="h-14 md:h-16 border-b bg-card flex items-center justify-between px-3 md:px-6">
      {/* Mobile Menu + Home Button + Workspace Switcher */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile hamburger menu */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onMobileMenuToggle}
          className="md:hidden"
          data-testid="button-mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/')}
          title="Back to Dashboard"
          data-testid="button-home"
          className="hidden md:flex"
        >
          <Home className="h-5 w-5" />
        </Button>
        
        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="flex items-center gap-2 min-w-[120px] md:min-w-[180px] justify-between"
              data-testid="button-workspace-switcher"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="truncate max-w-[80px] md:max-w-[140px] text-sm">
                  {workspaceLoading ? 'Loading...' : (currentWorkspace?.name || 'Select')}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[220px]" align="start">
            <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.length === 0 ? (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">No workspaces found</span>
              </DropdownMenuItem>
            ) : (
              workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => setCurrentWorkspace(workspace)}
                  className="flex items-center justify-between"
                  data-testid={`workspace-option-${workspace.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="truncate max-w-[150px]">{workspace.name}</span>
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="menu-manage-workspaces">
              <Settings className="mr-2 h-4 w-4" />
              <span>Manage Workspaces</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right side - Help, Theme, Admin & Profile */}
      <div className="flex items-center space-x-1 md:space-x-2">
        <div className="hidden md:block">
          <HelpBot />
        </div>
        <ThemeToggle />
        
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
            className="hidden md:flex items-center space-x-2"
            data-testid="button-admin"
          >
            <Crown className="h-4 w-4" />
            <span>Admin</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-8 w-8 rounded-full"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-sm font-medium leading-none">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="menu-profile">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="menu-settings">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} data-testid="menu-logout">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
