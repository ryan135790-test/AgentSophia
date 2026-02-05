import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  Mail, 
  User, 
  CheckCircle2,
  X,
  Edit,
  Sparkles,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bookMeeting } from "@/lib/meeting-booking";

export interface MeetingSuggestion {
  id: string;
  emailId: string;
  emailSubject: string;
  senderName: string;
  senderEmail: string;
  emailPreview: string;
  aiAnalysis: {
    intent: string;
    confidence: number;
    reasoning: string;
  };
  suggestedMeeting: {
    subject: string;
    duration: number; // in minutes
    attendees: string[];
    body: string;
    suggestedTime?: string;
  };
  createdAt: string;
}

interface MeetingApprovalCardProps {
  suggestion: MeetingSuggestion;
  onApprove: (details: any) => void;
  onReject: () => void;
  onEdit: (details: any) => void;
  isSending: boolean;
}

function MeetingApprovalCard({ suggestion, onApprove, onReject, onEdit, isSending }: MeetingApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(suggestion.suggestedMeeting.subject);
  const [editedBody, setEditedBody] = useState(suggestion.suggestedMeeting.body);
  const [editedDuration, setEditedDuration] = useState(suggestion.suggestedMeeting.duration.toString());
  const [suggestedTime, setSuggestedTime] = useState(suggestion.suggestedMeeting.suggestedTime || '');

  const handleApprove = () => {
    onApprove({
      ...suggestion.suggestedMeeting,
      subject: editedSubject,
      body: editedBody,
      duration: parseInt(editedDuration),
      suggestedTime: suggestedTime || undefined,
    });
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Sparkles className="h-3 w-3 mr-1" />
                Meeting Suggested
              </Badge>
              <Badge variant="outline">
                {Math.round(suggestion.aiAnalysis.confidence * 100)}% confident
              </Badge>
            </div>
            <CardTitle className="text-lg">Meeting Opportunity Detected</CardTitle>
            <CardDescription className="mt-2">
              From: <span className="font-medium">{suggestion.senderName}</span> ({suggestion.senderEmail})
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Original Email Context */}
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Original Email</span>
          </div>
          <p className="text-sm font-medium mb-1">{suggestion.emailSubject}</p>
          <p className="text-sm text-muted-foreground line-clamp-3">{suggestion.emailPreview}</p>
        </div>

        {/* AI Analysis */}
        <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="font-medium text-sm text-purple-900 dark:text-purple-100">AI Analysis</span>
          </div>
          <p className="text-sm text-purple-800 dark:text-purple-200">{suggestion.aiAnalysis.reasoning}</p>
        </div>

        <Separator />

        {/* Suggested Meeting Details */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Proposed Meeting Details
          </h4>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Meeting Subject</Label>
                <Input
                  id="subject"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  placeholder="Meeting subject"
                />
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={editedDuration}
                  onChange={(e) => setEditedDuration(e.target.value)}
                  placeholder="30"
                />
              </div>

              <div>
                <Label htmlFor="time">Suggested Time (optional)</Label>
                <Input
                  id="time"
                  type="datetime-local"
                  value={suggestedTime}
                  onChange={(e) => setSuggestedTime(e.target.value)}
                  placeholder="Leave empty to let attendee choose"
                />
              </div>

              <div>
                <Label htmlFor="body">Meeting Description</Label>
                <Textarea
                  id="body"
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={4}
                  placeholder="Meeting agenda and details"
                />
              </div>

              <div>
                <Label>Attendees</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestion.suggestedMeeting.attendees.map((attendee, idx) => (
                    <Badge key={idx} variant="secondary">
                      <User className="h-3 w-3 mr-1" />
                      {attendee}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">Subject:</span>
                <span>{suggestion.suggestedMeeting.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{suggestion.suggestedMeeting.duration} minutes</span>
              </div>
              {suggestion.suggestedMeeting.suggestedTime && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(suggestion.suggestedMeeting.suggestedTime).toLocaleString()}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-muted-foreground">Attendees:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {suggestion.suggestedMeeting.attendees.map((attendee, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {attendee}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <span className="font-medium text-muted-foreground">Description:</span>
                <p className="mt-1 text-muted-foreground">{suggestion.suggestedMeeting.body}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                onClick={() => {
                  handleApprove();
                  setIsEditing(false);
                }}
                disabled={isSending}
                className="flex-1"
                data-testid="button-approve-edited-meeting"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Book Meeting
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isSending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleApprove}
                disabled={isSending}
                className="flex-1"
                data-testid="button-approve-meeting"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Approve & Book
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isSending}
                data-testid="button-edit-meeting"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={onReject}
                disabled={isSending}
                data-testid="button-reject-meeting"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MeetingApprovals() {
  const { toast } = useToast();
  const [meetingSuggestions, setMeetingSuggestions] = useState<MeetingSuggestion[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleApproveMeeting = async (suggestion: MeetingSuggestion, details: any) => {
    setIsSending(true);
    try {
      // Calculate meeting time (use suggested time or default to tomorrow at 2 PM)
      const meetingStart = details.suggestedTime 
        ? new Date(details.suggestedTime)
        : (() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow
            return tomorrow;
          })();
      
      const meetingEnd = new Date(meetingStart);
      meetingEnd.setMinutes(meetingEnd.getMinutes() + details.duration);

      // Book the meeting via Office 365
      const result = await bookMeeting({
        subject: details.subject,
        attendeeEmail: suggestion.senderEmail,
        attendeeName: suggestion.senderName,
        startTime: meetingStart,
        endTime: meetingEnd,
        description: details.body,
        location: 'Microsoft Teams Meeting',
      });

      if (result.success) {
        toast({
          title: "✅ Meeting Booked Successfully!",
          description: `Calendar invitation sent to ${suggestion.senderName}. Meeting link: ${result.meetingLink || 'Check your calendar'}`,
        });
        
        // Remove from suggestions after successful booking
        setMeetingSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      } else {
        throw new Error(result.error || 'Failed to book meeting');
      }
    } catch (error: any) {
      console.error('Meeting booking error:', error);
      toast({
        title: "Failed to Book Meeting",
        description: error.message || "An error occurred while booking the meeting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRejectMeeting = (suggestion: MeetingSuggestion) => {
    setMeetingSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    toast({
      title: "Meeting Suggestion Rejected",
      description: "The meeting will not be scheduled.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Meeting Suggestions
        </CardTitle>
        <CardDescription>
          Review AI-detected meeting opportunities from your emails and messages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {meetingSuggestions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Meeting Suggestions</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When Sophia detects meeting opportunities in your emails, they'll appear here for your approval.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {meetingSuggestions.map((suggestion) => (
                <MeetingApprovalCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApprove={(details) => handleApproveMeeting(suggestion, details)}
                  onReject={() => handleRejectMeeting(suggestion)}
                  onEdit={(details) => {
                    // Update the suggestion with edited details
                    setMeetingSuggestions(prev => prev.map(s => 
                      s.id === suggestion.id 
                        ? { ...s, suggestedMeeting: { ...s.suggestedMeeting, ...details } }
                        : s
                    ));
                  }}
                  isSending={isSending}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
