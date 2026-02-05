import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Download, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function AdvancedReporting() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [reports, setReports] = useState<any[]>([]);
  const [exports, setExports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState('csv');

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchData();
    }
  }, [currentWorkspace?.id]);

  const fetchData = async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }
    try {
      const [repRes, expRes] = await Promise.all([
        fetch(`/api/workspaces/${currentWorkspace.id}/custom-reports`),
        fetch(`/api/workspaces/${currentWorkspace.id}/data-exports`)
      ]);

      if (repRes.ok) setReports(await repRes.json());
      if (expRes.ok) setExports(await expRes.json());
    } finally {
      setLoading(false);
    }
  };

  const createReport = async () => {
    if (!currentWorkspace?.id) return;
    const res = await fetch(`/api/workspaces/${currentWorkspace.id}/custom-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_name: 'Custom Analytics Report',
        report_type: 'custom',
        metrics: ['response_rate', 'conversion_rate', 'engagement'],
        date_range: { start: '2025-01-01', end: '2025-01-31' },
        scheduled: true,
        schedule_frequency: 'weekly'
      })
    });

    if (res.ok) {
      toast({ title: 'Success', description: 'Report created & scheduled' });
      fetchData();
    }
  };

  const startExport = async () => {
    if (!currentWorkspace?.id) return;
    const res = await fetch(`/api/workspaces/${currentWorkspace.id}/data-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        export_type: 'all',
        format: exportFormat,
        date_range: { start: '2025-01-01', end: '2025-01-31' },
        include_metadata: true
      })
    });

    if (res.ok) {
      toast({ title: 'Success', description: 'Export started - check back soon' });
      fetchData();
    }
  };

  if (loading) return <div>Loading reports...</div>;

  const chartData = [
    { name: 'Week 1', rate: 24 },
    { name: 'Week 2', rate: 31 },
    { name: 'Week 3', rate: 28 },
    { name: 'Week 4', rate: 35 }
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="reports">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports">Custom Reports</TabsTrigger>
          <TabsTrigger value="exports">Data Exports</TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Create Custom Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate scheduled reports with custom metrics, filters, and delivery
              </p>
              <Button onClick={createReport} className="w-full" data-testid="button-create-report">
                Create New Report
              </Button>
            </CardContent>
          </Card>

          {reports.length > 0 && (
            <Card data-testid="card-scheduled-reports">
              <CardHeader>
                <CardTitle className="text-sm">Scheduled Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="border rounded p-3" data-testid={`report-item-${report.id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{report.report_name}</p>
                        <p className="text-xs text-muted-foreground">{report.report_type.replace(/_/g, ' ')}</p>
                      </div>
                      {report.scheduled && (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {report.schedule_frequency}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Performance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exports Tab */}
        <TabsContent value="exports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div data-testid="select-export-format">
                <label className="text-sm font-medium">Format</label>
                <Select value={exportFormat || "csv"} onValueChange={setExportFormat}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv" data-testid="option-csv">CSV</SelectItem>
                    <SelectItem value="xlsx" data-testid="option-xlsx">Excel</SelectItem>
                    <SelectItem value="json" data-testid="option-json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={startExport} className="w-full" data-testid="button-start-export">
                <Download className="h-4 w-4 mr-2" />
                Start Export
              </Button>
            </CardContent>
          </Card>

          {exports.length > 0 && (
            <Card data-testid="card-export-history">
              <CardHeader>
                <CardTitle className="text-sm">Recent Exports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {exports.map((exp) => (
                  <div key={exp.id} className="border rounded p-3 flex justify-between items-center" data-testid={`export-item-${exp.id}`}>
                    <div>
                      <p className="font-medium text-sm capitalize">{exp.export_type}</p>
                      <p className="text-xs text-muted-foreground">{exp.format.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={exp.status === 'completed' ? 'default' : 'secondary'}>
                        {exp.status}
                      </Badge>
                      {exp.file_url && (
                        <a href={exp.file_url} download>
                          <Button size="sm" variant="outline" data-testid={`button-download-${exp.id}`}>
                            Download
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
