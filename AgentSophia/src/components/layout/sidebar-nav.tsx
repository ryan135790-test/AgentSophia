import { cn } from "@/lib/utils";
import { 
  LayoutDashboard,
  Inbox,
  Megaphone,
  Users,
  Settings,
  Bot,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Share2,
  Shield,
  Plug,
  MessageSquare,
  UserPlus,
  ThumbsUp,
  BarChart3,
  Heart,
  FileText,
  Send,
  Flame,
  TrendingUp,
  Briefcase,
  Target,
  Linkedin,
  Building2,
  Activity,
  Calendar,
  Palette,
  Rocket,
  BookOpen,
  HelpCircle,
  Phone,
  Smartphone,
  Mail,
  MousePointer,
  GitCompare,
  DollarSign,
  CalendarCheck,
  UsersRound,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingApprovals?: number;
  isMobile?: boolean;
  onMobileNavClick?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  path?: string;
  badge?: number;
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
  color?: string;
}

const navigationGroups: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/" },
      { id: "activity", label: "Activity Feed", icon: Activity, path: "/activity" },
    ]
  },
  {
    id: "communication",
    label: "Communication",
    icon: Inbox,
    items: [
      { id: "inbox", label: "Inbox", icon: Inbox, path: "/inbox" },
      { id: "stay-in-touch", label: "Stay in Touch", icon: Heart, path: "/stay-in-touch" },
      { id: "templates", label: "Templates", icon: FileText, path: "/templates" },
    ]
  },
  {
    id: "crm",
    label: "Contacts & CRM",
    icon: Users,
    items: [
      { id: "contacts", label: "Contacts", icon: Users, path: "/contacts" },
      { id: "contact-import", label: "Import Contacts", icon: UserPlus, path: "/contact-import" },
      { id: "deal-pipeline", label: "Deal Pipeline", icon: Briefcase, path: "/deal-pipeline" },
      { id: "lead-scoring", label: "Lead Scoring", icon: Target, path: "/lead-scoring" },
    ]
  },
  {
    id: "campaigns",
    label: "Campaigns",
    icon: Megaphone,
    items: [
      { id: "campaigns", label: "All Campaigns", icon: Megaphone, path: "/campaigns" },
      { id: "sms-campaigns", label: "SMS Campaigns", icon: Smartphone, path: "/sms-campaigns" },
      { id: "phone-voicemail", label: "Phone & Voicemail", icon: Phone, path: "/phone-voicemail" },
      { id: "workflow-builder", label: "Workflow Builder", icon: Activity, path: "/workflow-builder" },
      { id: "workflows", label: "Workflow Monitor", icon: Activity, path: "/workflows" },
    ]
  },
  {
    id: "social",
    label: "Social Media",
    icon: Share2,
    color: "text-pink-400",
    items: [
      { id: "social-media", label: "Social Scheduler", icon: Calendar, path: "/social-media" },
      { id: "social-posts", label: "Post Manager", icon: FileText, path: "/social-posts" },
      { id: "social-analytics", label: "Analytics", icon: BarChart3, path: "/social-analytics" },
    ]
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    color: "text-blue-400",
    items: [
      { id: "linkedin-lead-import", label: "Lead Import", icon: UserPlus, path: "/linkedin-lead-import" },
      { id: "linkedin-campaigns", label: "Campaigns", icon: Megaphone, path: "/linkedin-campaigns" },
      { id: "linkedin-inbox", label: "AI Inbox", icon: MessageSquare, path: "/linkedin-inbox" },
      { id: "linkedin-engagement", label: "Engagement", icon: ThumbsUp, path: "/linkedin-engagement" },
      { id: "linkedin-optimization", label: "Optimization", icon: BarChart3, path: "/linkedin-optimization" },
      { id: "linkedin-settings", label: "Settings", icon: Shield, path: "/linkedin-settings" },
    ]
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    color: "text-orange-400",
    items: [
      { id: "email-manager", label: "Email Manager", icon: Mail, path: "/email-manager" },
      { id: "email-sequences", label: "Email Sequences", icon: Send, path: "/email-sequences" },
      { id: "bulk-email", label: "Bulk Email", icon: Send, path: "/bulk-email" },
      { id: "email-warmup", label: "Email Warmup", icon: Flame, path: "/email-warmup" },
      { id: "email-tracking", label: "Email Tracking", icon: MousePointer, path: "/email-tracking" },
      { id: "email-setup", label: "Email Setup", icon: Settings, path: "/email-setup" },
    ]
  },
  {
    id: "sophia",
    label: "AI Sophia",
    icon: Bot,
    color: "text-purple-400",
    items: [
      { id: "chat-sophia", label: "Chat with Sophia", icon: Sparkles, path: "/chat-sophia" },
      { id: "sophia-activity", label: "Activity Dashboard", icon: Activity, path: "/sophia-activity" },
      { id: "sophia-admin", label: "Brain Control", icon: Bot, path: "/sophia-admin" },
      { id: "approvals", label: "Approvals", icon: CheckSquare, path: "/approvals" },
      { id: "sophia-learning", label: "Learning", icon: TrendingUp, path: "/sophia-learning" },
      { id: "sophia-reports", label: "Reports & Actions", icon: BarChart3, path: "/sophia-reports" },
    ]
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: TrendingUp,
    items: [
      { id: "analytics", label: "Analytics", icon: BarChart3, path: "/analytics" },
      { id: "revenue-analytics", label: "Revenue", icon: TrendingUp, path: "/revenue-analytics" },
      { id: "revenue-forecast", label: "Revenue Forecast", icon: DollarSign, path: "/revenue-forecast" },
      { id: "ab-testing", label: "A/B Testing", icon: GitCompare, path: "/ab-testing" },
    ]
  },
  {
    id: "team-ops",
    label: "Team & Operations",
    icon: UsersRound,
    items: [
      { id: "team-collaboration", label: "Team Collaboration", icon: UsersRound, path: "/team-collaboration" },
      { id: "meeting-scheduling", label: "Meeting Scheduling", icon: CalendarCheck, path: "/meeting-scheduling" },
      { id: "bulk-operations", label: "Bulk Operations", icon: Layers, path: "/bulk-operations" },
    ]
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { id: "settings", label: "General Settings", icon: Settings, path: "/settings" },
      { id: "profile", label: "My Profile", icon: Users, path: "/profile" },
      { id: "brand-voice", label: "Brand Voice", icon: Palette, path: "/brand-voice" },
      { id: "my-connections", label: "My Connections", icon: Plug, path: "/my-connections" },
      { id: "notification-settings", label: "Notifications", icon: MessageSquare, path: "/notification-settings" },
      { id: "rate-limiting", label: "Rate Limiting", icon: Shield, path: "/rate-limiting" },
      { id: "data-export", label: "Data Export", icon: FileText, path: "/data-export" },
      { id: "audit-log", label: "Audit Log", icon: Activity, path: "/audit-log" },
      { id: "integrations-setup", label: "Integrations Setup", icon: Plug, path: "/integrations-setup" },
      { id: "integrations", label: "Integrations Hub", icon: Plug, path: "/integrations" },
      { id: "invites", label: "Pending Invites", icon: Mail, path: "/invites" },
      { id: "admin", label: "Team Management", icon: Users, path: "/admin" },
    ]
  },
  {
    id: "admin-section",
    label: "Admin",
    icon: Shield,
    items: [
      { id: "super-admin", label: "Super Admin", icon: Shield, path: "/super-admin" },
    ]
  },
  {
    id: "help",
    label: "Help & Setup",
    icon: HelpCircle,
    color: "text-emerald-400",
    items: [
      { id: "getting-started", label: "Getting Started", icon: Rocket, path: "/getting-started" },
      { id: "how-to-use", label: "How to Use", icon: BookOpen, path: "/how-to-use" },
      { id: "features", label: "Features Hub", icon: Sparkles, path: "/features" },
    ]
  },
];

export function SidebarNav({ activeTab, onTabChange, pendingApprovals = 0, isMobile = false, onMobileNavClick }: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["overview", "communication"]));

  const effectiveExpanded = isMobile ? true : isExpanded;

  // Auto-expand group containing active item
  useEffect(() => {
    const currentPath = location.pathname;
    navigationGroups.forEach(group => {
      const hasActiveItem = group.items.some(item => 
        item.path === currentPath || 
        (currentPath !== "/" && item.path && currentPath.startsWith(item.path))
      );
      if (hasActiveItem) {
        setExpandedGroups(prev => new Set([...prev, group.id]));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleNavClick = (item: NavItem) => {
    if (item.path) {
      navigate(item.path);
    } else {
      onTabChange(item.id);
    }
    if (isMobile && onMobileNavClick) {
      onMobileNavClick();
    }
  };

  const isItemActive = (item: NavItem): boolean => {
    const currentPath = location.pathname;
    if (item.path === "/" && currentPath === "/") return true;
    if (item.path && item.path !== "/" && currentPath.startsWith(item.path)) return true;
    return activeTab === item.id;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div 
        className={cn(
          "flex h-full flex-col border-r bg-slate-900 transition-all duration-300 overflow-hidden",
          isMobile ? "w-full" : (effectiveExpanded ? "w-64" : "w-16")
        )}
      >
        {/* Logo Header */}
        <div className="p-4 border-b border-slate-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            S
          </div>
          {effectiveExpanded && (
            <div>
              <h1 className="text-white font-semibold text-sm">Agent Sophia</h1>
              <p className="text-slate-400 text-xs">AI Sales Officer</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 min-h-0">
          <nav className="p-2">
            {navigationGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupExpanded = expandedGroups.has(group.id);
              const hasActiveItem = group.items.some(item => isItemActive(item));

              // Get badge count for group if any item has a badge
              const groupBadge = group.items.reduce((acc, item) => {
                if (item.id === "approvals") return acc + (pendingApprovals || 0);
                return acc + (item.badge || 0);
              }, 0);

              if (!effectiveExpanded) {
                // Collapsed mode - show only group icons
                return (
                  <Tooltip key={group.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          setIsExpanded(true);
                          setExpandedGroups(prev => new Set([...prev, group.id]));
                        }}
                        className={cn(
                          "flex w-full items-center justify-center rounded-lg py-3 mb-1 transition-colors relative",
                          hasActiveItem
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        )}
                        data-testid={`nav-group-${group.id}`}
                      >
                        <GroupIcon className={cn("h-5 w-5", group.color)} />
                        {groupBadge > 0 && (
                          <Badge 
                            className="absolute -top-1 -right-1 h-4 min-w-4 text-xs px-1"
                          >
                            {groupBadge}
                          </Badge>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{group.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              // Expanded mode - show collapsible groups
              return (
                <div key={group.id} className="mb-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                      hasActiveItem
                        ? "text-white bg-slate-800/50"
                        : "text-slate-400 hover:bg-slate-800/30 hover:text-slate-200"
                    )}
                    data-testid={`nav-group-${group.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon className={cn("h-4 w-4", group.color)} />
                      <span className="font-medium">{group.label}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {groupBadge > 0 && (
                        <Badge variant="default" className="h-5 text-xs px-1.5">
                          {groupBadge}
                        </Badge>
                      )}
                      <ChevronDown 
                        className={cn(
                          "h-4 w-4 transition-transform",
                          !isGroupExpanded && "-rotate-90"
                        )} 
                      />
                    </div>
                  </button>

                  {/* Group Items */}
                  {isGroupExpanded && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = isItemActive(item);
                        const itemBadge = item.id === "approvals" ? pendingApprovals : item.badge;

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavClick(item)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-blue-600 text-white"
                                : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                            )}
                            data-testid={`nav-${item.id}`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {itemBadge && itemBadge > 0 && (
                              <Badge variant="default" className="h-5 text-xs px-1.5">
                                {itemBadge}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer - Toggle Button (hidden on mobile) */}
        {!isMobile && (
          <div className="border-t border-slate-700 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="toggle-sidebar"
            >
              {isExpanded ? (
                <div className="flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-xs">Collapse</span>
                </div>
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
