import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Bot, 
  Users, 
  Linkedin, 
  Mail, 
  Megaphone,
  Sparkles,
  Crown,
  LogOut,
  User,
  Settings,
  Zap,
  Share2,
  Inbox,
  Plug,
  Shield
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { user, profile, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "agent-sophia", label: "Agent Sophia", icon: Bot },
    { id: "ai-campaigns", label: "AI Campaigns", icon: Sparkles },
    { id: "social-posting", label: "Social AI", icon: Share2 },
    { id: "crm", label: "CRM", icon: Users },
    { id: "linkedin", label: "LinkedIn", icon: Linkedin },
    { id: "connectors", label: "Connectors", icon: Plug },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="w-full border-b bg-card">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">AI Lead Platform</h1>
          </div>
        </div>
        
        <nav className="flex items-center space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-gradient-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center space-x-4">
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/super-admin')}
              className="flex items-center space-x-2 border-red-500/50 text-red-600 hover:bg-red-50"
              data-testid="button-super-admin"
            >
              <Shield className="h-4 w-4" />
              <span>Super Admin</span>
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2"
              data-testid="button-admin"
            >
              <Crown className="h-4 w-4" />
              <span>Admin</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
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
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}