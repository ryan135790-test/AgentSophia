import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle2, XCircle, AlertCircle, Edit3, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface MessageVersion {
  id: string;
  text: string;
  subject?: string;
  reasoning?: string;
  confidence?: number;
  isOriginal?: boolean;
}

interface MessageEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: MessageVersion[];
  selectedVersionId?: string;
  onSave: (version: MessageVersion) => void;
  onApprove?: (version: MessageVersion) => void;
  onReject?: () => void;
  title?: string;
  description?: string;
  contactName?: string;
}

export function MessageEditorModal({
  open,
  onOpenChange,
  versions,
  selectedVersionId,
  onSave,
  onApprove,
  onReject,
  title = 'Edit Message',
  description = 'Review and edit the suggested message',
  contactName
}: MessageEditorModalProps) {
  const { toast } = useToast();
  const [activeVersionId, setActiveVersionId] = useState<string>(selectedVersionId || versions[0]?.id);
  const [editedText, setEditedText] = useState('');
  const [editedSubject, setEditedSubject] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const currentVersion = versions.find(v => v.id === activeVersionId);

  useEffect(() => {
    if (currentVersion) {
      setEditedText(currentVersion.text);
      setEditedSubject(currentVersion.subject || '');
      setHasChanges(false);
    }
  }, [currentVersion, open]);

  const handleTextChange = (text: string) => {
    setEditedText(text);
    setHasChanges(
      text !== (currentVersion?.text || '') ||
      editedSubject !== (currentVersion?.subject || '')
    );
  };

  const handleSubjectChange = (subject: string) => {
    setEditedSubject(subject);
    setHasChanges(
      editedText !== (currentVersion?.text || '') ||
      subject !== (currentVersion?.subject || '')
    );
  };

  const handleSave = () => {
    if (!currentVersion) return;
    
    const updatedVersion: MessageVersion = {
      ...currentVersion,
      text: editedText,
      subject: editedSubject || currentVersion.subject
    };
    
    onSave(updatedVersion);
    setHasChanges(false);
    
    toast({
      title: 'Message saved',
      description: 'Your edits have been saved',
    });
  };

  const handleApprove = () => {
    if (!currentVersion) return;
    
    const finalVersion: MessageVersion = {
      ...currentVersion,
      text: editedText,
      subject: editedSubject || currentVersion.subject
    };
    
    if (onApprove) {
      onApprove(finalVersion);
    }
  };

  const handleCopyToClipboard = () => {
    const text = editedSubject ? `${editedSubject}\n\n${editedText}` : editedText;
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'Message copied successfully',
    });
  };

  if (!currentVersion) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="message-editor-modal">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
            {contactName && <span className="font-medium ml-1">to {contactName}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Version Tabs */}
        {versions.length > 1 && (
          <div className="border-b">
            <div className="flex gap-2 px-6 pt-2 overflow-x-auto">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => setActiveVersionId(version.id)}
                  className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors whitespace-nowrap text-sm ${
                    activeVersionId === version.id
                      ? 'border-b-primary text-primary'
                      : 'border-b-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`version-tab-${version.id}`}
                >
                  Version {versions.indexOf(version) + 1}
                  {version.confidence && (
                    <span className="ml-2 text-xs opacity-70">
                      ({version.confidence}% confident)
                    </span>
                  )}
                  {version.isOriginal && (
                    <Badge variant="outline" className="ml-2 h-5">Original</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs: Edit vs Preview */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start px-6">
            <TabsTrigger value="edit" className="gap-2">
              <Edit3 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Edit Tab */}
          <TabsContent value="edit" className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="space-y-4 pt-4">
              {/* Subject */}
              {editedSubject && (
                <div>
                  <Label className="text-xs font-medium">Subject Line</Label>
                  <Input
                    value={editedSubject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="mt-1.5"
                    placeholder="Enter subject line..."
                    data-testid="input-edit-subject"
                  />
                </div>
              )}

              {/* Message Body */}
              <div className="flex-1">
                <Label className="text-xs font-medium">Message</Label>
                <Textarea
                  value={editedText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="mt-1.5 min-h-[300px] font-mono text-sm"
                  placeholder="Edit your message here..."
                  data-testid="textarea-edit-message"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {editedText.length} characters
                  {hasChanges && (
                    <span className="text-yellow-600 ml-2 font-medium">• Unsaved changes</span>
                  )}
                </p>
              </div>

              {/* Reasoning (if available) */}
              {currentVersion.reasoning && (
                <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                    <strong>Sophia's reasoning:</strong> {currentVersion.reasoning}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="space-y-4 pt-4">
              {editedSubject && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Subject:</p>
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <p className="font-semibold text-base">{editedSubject}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Message:</p>
                <div className="bg-muted/50 rounded-lg p-4 border min-h-[300px] whitespace-pre-wrap text-sm leading-relaxed">
                  {editedText}
                </div>
              </div>

              {/* Confidence Badge */}
              {currentVersion.confidence && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sophia's confidence:</span>
                  <Badge
                    variant={
                      currentVersion.confidence >= 90
                        ? 'default'
                        : currentVersion.confidence >= 70
                          ? 'outline'
                          : 'destructive'
                    }
                  >
                    {currentVersion.confidence}%
                  </Badge>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="border-t pt-4">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              className="gap-2"
              data-testid="button-copy-message"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>

            <div className="flex-1" />

            {onReject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onReject();
                  onOpenChange(false);
                }}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                data-testid="button-reject-message"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            )}

            {hasChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="gap-2"
                data-testid="button-save-changes"
              >
                Save Changes
              </Button>
            )}

            {onApprove && (
              <Button
                size="sm"
                onClick={handleApprove}
                className="gap-2 bg-green-600 hover:bg-green-700"
                data-testid="button-approve-message"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve & Send
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
