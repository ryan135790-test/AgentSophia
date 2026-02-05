import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Users, Mail, BarChart3, Target, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";

type ExportType = 'contacts' | 'campaigns' | 'analytics' | 'deals' | 'emails' | 'all';

interface ExportOption {
  id: ExportType;
  label: string;
  description: string;
  icon: typeof Users;
  fields: string[];
}

const exportOptions: ExportOption[] = [
  {
    id: 'contacts',
    label: 'Contacts',
    description: 'Export all contacts with their details and tags',
    icon: Users,
    fields: ['name', 'email', 'phone', 'company', 'title', 'tags', 'source', 'created_at']
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    description: 'Export campaign data with performance metrics',
    icon: Mail,
    fields: ['name', 'type', 'status', 'sent', 'opened', 'clicked', 'replied', 'created_at']
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Export performance analytics and reports',
    icon: BarChart3,
    fields: ['date', 'emails_sent', 'opens', 'clicks', 'replies', 'conversions', 'revenue']
  },
  {
    id: 'deals',
    label: 'Deals',
    description: 'Export deal pipeline with values and stages',
    icon: Target,
    fields: ['name', 'value', 'stage', 'contact', 'probability', 'expected_close', 'created_at']
  },
  {
    id: 'emails',
    label: 'Email History',
    description: 'Export sent emails and engagement data',
    icon: Calendar,
    fields: ['subject', 'to', 'from', 'sent_at', 'opened', 'clicked', 'replied']
  }
];

export default function DataExport() {
  const { session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [selectedExport, setSelectedExport] = useState<ExportType>('contacts');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'all' | '30' | '90' | '365'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const currentOption = exportOptions.find(o => o.id === selectedExport);

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const selectAllFields = () => {
    if (currentOption) {
      setSelectedFields(currentOption.fields);
    }
  };

  const handleExport = async () => {
    if (!currentWorkspace) {
      toast.error('Please select a workspace first');
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch('/api/data-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          type: selectedExport,
          format,
          fields: selectedFields.length > 0 ? selectedFields : currentOption?.fields,
          date_range: dateRange
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedExport}_export_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`${currentOption?.label} exported successfully!`);
    } catch (error) {
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Data Export</h1>
        <p className="text-muted-foreground mt-1">
          Export your data as CSV or JSON for backup or analysis
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Select Data to Export
              </CardTitle>
              <CardDescription>Choose what data you want to export</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {exportOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedExport === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSelectedExport(option.id);
                        setSelectedFields([]);
                      }}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      data-testid={`button-export-${option.id}`}
                    >
                      <Icon className={`h-6 w-6 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {currentOption && (
            <Card>
              <CardHeader>
                <CardTitle>Select Fields</CardTitle>
                <CardDescription>
                  Choose which fields to include in your export
                  <Button
                    variant="link"
                    size="sm"
                    onClick={selectAllFields}
                    className="ml-2"
                    data-testid="button-select-all-fields"
                  >
                    Select All
                  </Button>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {currentOption.fields.map((field) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={field}
                        checked={selectedFields.includes(field) || selectedFields.length === 0}
                        onCheckedChange={() => handleFieldToggle(field)}
                        data-testid={`checkbox-field-${field}`}
                      />
                      <Label htmlFor={field} className="text-sm capitalize cursor-pointer">
                        {field.replace(/_/g, ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>File Format</Label>
                <Select value={format} onValueChange={(v: 'csv' | 'json') => setFormat(v)}>
                  <SelectTrigger data-testid="select-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                    <SelectItem value="json">JSON (Data)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={(v: typeof dateRange) => setDateRange(v)}>
                  <SelectTrigger data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="365">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full mt-4"
                onClick={handleExport}
                disabled={isExporting}
                data-testid="button-export"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export {currentOption?.label}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Export</CardTitle>
              <CardDescription>Export everything at once</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedExport('all' as ExportType);
                  handleExport();
                }}
                disabled={isExporting}
                data-testid="button-export-all"
              >
                <Download className="mr-2 h-4 w-4" />
                Export All Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
