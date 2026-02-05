import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkflowContactsListProps {
  workflowId: string | null;
  workspaceId?: string;
  onContactAction?: (action: string, contactId: string) => void;
}

interface WorkflowContact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  added_at?: string;
}

export function WorkflowContactsList({ workflowId, workspaceId, onContactAction }: WorkflowContactsListProps) {
  const { data: contacts, isLoading } = useQuery<WorkflowContact[]>({
    queryKey: [`/api/workflows/${workflowId}/contacts?workspaceId=${workspaceId}`],
    enabled: !!workflowId && !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const contactList = contacts || [];
  const activeCount = contactList.filter(c => c.status !== 'completed').length;

  if (contactList.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No contacts in this workflow yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Add contacts from the Campaigns page to see them here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Contacts at This Step</div>
          <div className="text-sm text-muted-foreground">{activeCount} active</div>
        </div>
        <Badge variant="secondary">{contactList.length > 0 ? 'In Progress' : 'Empty'}</Badge>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {contactList.map((contact) => {
            const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';
            const timeAgo = contact.added_at 
              ? formatDistanceToNow(new Date(contact.added_at), { addSuffix: false })
              : '';
            
            return (
              <Card key={contact.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">{name}</div>
                      <div className="text-xs text-muted-foreground">{contact.email || 'No email'}</div>
                    </div>
                    {timeAgo && <Badge variant="outline" className="text-xs">{timeAgo}</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs" 
                      onClick={() => onContactAction?.('removed', contact.id)}
                      data-testid={`button-delete-contact-${contact.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs" 
                      onClick={() => onContactAction?.('moved forward', contact.id)}
                      data-testid={`button-move-forward-${contact.id}`}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Next
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs" 
                      onClick={() => onContactAction?.('moved back', contact.id)}
                      data-testid={`button-move-back-${contact.id}`}
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}
