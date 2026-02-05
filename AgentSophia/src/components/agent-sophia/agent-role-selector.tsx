import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  TrendingUp,
  Users,
  BarChart3,
  PenTool,
  Zap,
  Mail,
  Upload,
  ChevronDown,
  FileText,
  X
} from "lucide-react";

export interface AgentRole {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: typeof MessageSquare;
  color: string;
}

export const AGENT_ROLES: AgentRole[] = [
  {
    id: "sales",
    name: "Sales Manager (Milli)",
    title: "Milli",
    description: "Generate cold call scripts, email campaigns, and persuasive pitches",
    icon: TrendingUp,
    color: "bg-blue-100 text-blue-700"
  },
  {
    id: "marketing",
    name: "Marketing Manager (Buddy)",
    title: "Buddy",
    description: "Build growth strategies, analyze audiences, and plan campaigns",
    icon: Zap,
    color: "bg-purple-100 text-purple-700"
  },
  {
    id: "support",
    name: "Support Specialist (Cassie)",
    title: "Cassie",
    description: "Craft customer responses while maintaining your brand voice",
    icon: MessageSquare,
    color: "bg-green-100 text-green-700"
  },
  {
    id: "copywriter",
    name: "Copywriter (Penn)",
    title: "Penn",
    description: "Write compelling ads, blog posts, and marketing copy",
    icon: PenTool,
    color: "bg-orange-100 text-orange-700"
  },
  {
    id: "data",
    name: "Data Analyst (Dexter)",
    title: "Dexter",
    description: "Transform data into insights and forecasts",
    icon: BarChart3,
    color: "bg-indigo-100 text-indigo-700"
  },
  {
    id: "team",
    name: "Business Development (Buddy)",
    title: "Buddy",
    description: "Manage partnerships and growth initiatives",
    icon: Users,
    color: "bg-pink-100 text-pink-700"
  }
];

interface AgentRoleSelectorProps {
  selectedRole: string;
  onRoleChange: (roleId: string) => void;
  knowledgeBase?: string[];
  onUploadFile?: (file: File) => void;
  onRemoveFile?: (fileName: string) => void;
}

export function AgentRoleSelector({
  selectedRole,
  onRoleChange,
  knowledgeBase = [],
  onUploadFile,
  onRemoveFile
}: AgentRoleSelectorProps) {
  const [uploading, setUploading] = useState(false);
  const currentRole = AGENT_ROLES.find(r => r.id === selectedRole) || AGENT_ROLES[0];
  const Icon = currentRole.icon;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      setUploading(true);
      await onUploadFile(file);
      setUploading(false);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border">
      {/* Agent Role Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Select Agent Role</label>
        <Select value={selectedRole} onValueChange={onRoleChange}>
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {AGENT_ROLES.map(role => {
              const RoleIcon = role.icon;
              return (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <RoleIcon className="h-4 w-4" />
                    <span>{role.title}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{currentRole.description}</p>
      </div>

      {/* Knowledge Base Upload */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Knowledge Base (Optional)</label>
        <div className="flex gap-2">
          <label className="flex-1">
            <Button
              variant="outline"
              className="w-full"
              disabled={uploading}
              asChild
            >
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Add File"}
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.md,.json"
              disabled={uploading}
            />
          </label>
        </div>

        {/* Uploaded Files List */}
        {knowledgeBase.length > 0 && (
          <div className="space-y-2">
            {knowledgeBase.map((fileName, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white dark:bg-slate-700 p-2 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{fileName}</span>
                </div>
                {onRemoveFile && (
                  <button
                    onClick={() => onRemoveFile(fileName)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role Badge */}
      <Badge className={currentRole.color} variant="secondary">
        <Icon className="h-3 w-3 mr-1" />
        {currentRole.title}
      </Badge>
    </div>
  );
}
