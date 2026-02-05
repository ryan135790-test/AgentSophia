import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileCheck, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ImportHistory {
  date: string;
  file: string;
  count: number;
  status: string;
}

interface PreviewData {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
}

export default function ContactImport() {
  const { currentWorkspace } = useWorkspace();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  useEffect(() => {
    const fetchHistory = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      if (isDemo) {
        setImportHistory([
          { date: '2025-01-22', file: 'Q1_prospects.csv', count: 450, status: 'completed' },
          { date: '2025-01-20', file: 'leads_webinar.csv', count: 320, status: 'completed' },
          { date: '2025-01-18', file: 'database_sync.csv', count: 1200, status: 'completed' }
        ]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/contacts/import-history`);
        if (res.ok) {
          const data = await res.json();
          setImportHistory(data || []);
        } else {
          setImportHistory([]);
        }
      } catch (error) {
        console.error('Error fetching import history:', error);
        setImportHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [workspaceId, isDemo]);

  const handleFileSelect = async (file: File) => {
    setUploading(true);
    try {
      const fileContent = await file.text();
      const response = await fetch('/api/contacts/preview-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: fileContent,
          fileName: file.name
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPreview({
          total_rows: data.total_rows,
          valid_rows: data.valid_rows,
          invalid_rows: data.invalid_rows
        });
      }
    } catch (error) {
      console.error('Error previewing import:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    const response = await fetch('/api/contacts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'imported_contacts.csv',
        totalRows: preview.total_rows,
        skipDuplicates: true
      })
    });

    if (response.ok) {
      const data = await response.json();
      setImportHistory([
        { date: new Date().toISOString().split('T')[0], file: 'imported_contacts.csv', count: data.imported_contacts, status: 'completed' },
        ...importHistory
      ]);
      setPreview(null);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Upload className="h-8 w-8 text-blue-600" />
            Contact Import
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Upload CSV to import contacts and run bulk campaigns</p>
        </div>

        {/* Upload Section */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Import Contacts</CardTitle>
            <CardDescription>Upload a CSV file with email, name, company, title, phone</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-8 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = e.dataTransfer.files;
                if (files.length > 0) handleFileSelect(files[0]);
              }}
            >
              <Upload className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-900 dark:text-white">Drag CSV here or click to upload</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Supported: CSV format with up to 10,000 contacts</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files) handleFileSelect(e.target.files[0]);
                }}
                className="hidden"
                data-testid="input-file-upload"
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        {preview && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-green-600" />
                Import Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Rows</p>
                  <p className="text-2xl font-bold">{preview.total_rows}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Valid</p>
                  <p className="text-2xl font-bold text-green-600">{preview.valid_rows}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Invalid</p>
                  <p className="text-2xl font-bold text-orange-600">{preview.invalid_rows}</p>
                </div>
              </div>
              <button
                onClick={handleConfirmImport}
                disabled={uploading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                data-testid="button-confirm-import"
              >
                {uploading ? 'Importing...' : 'Confirm Import'}
              </button>
            </CardContent>
          </Card>
        )}

        {/* Import History */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Import History
            </CardTitle>
            <CardDescription>
              {importHistory.length > 0 
                ? `${importHistory.length} total imports • ${importHistory.reduce((sum, i) => sum + i.count, 0).toLocaleString()} contacts`
                : 'No imports yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {importHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No import history yet</p>
                <p className="text-sm">Upload a CSV file above to start importing contacts</p>
              </div>
            ) : (
            <div className="space-y-3">
              {importHistory.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <p className="font-semibold text-sm">{item.file}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{item.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">{item.count} contacts</span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{item.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Sophia Insights - only show for demo */}
        {isDemo && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Sophia's Import Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p><strong>CSV Format:</strong> Include columns: email, name, company, title, phone, linkedin_url</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p><strong>Bulk Campaigns:</strong> After importing, run bulk email/SMS to engage 1000+ contacts instantly</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p><strong>Lead Scoring:</strong> Automatically score imported contacts and segment into Hot/Warm/Cold</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p><strong>Duplicates:</strong> System automatically detects and skips duplicate emails</p>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
