import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useContactProfile } from "@/hooks/use-contact-profile";
import { Mail, Phone, Briefcase, Linkedin, Twitter, MapPin, TrendingUp, MessageSquare, Calendar, Hash } from "lucide-react";
import { format } from "date-fns";

interface ContactProfileViewProps {
  contactId: string | null | undefined;
}

export function ContactProfileView({ contactId }: ContactProfileViewProps) {
  const { data: profile, isLoading } = useContactProfile(contactId);

  if (!contactId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            No contact linked to this response
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">Loading contact profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Contact not found
          </p>
        </CardContent>
      </Card>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown Contact';

  return (
    <div className="space-y-4">
      <Card data-testid="card-contact-profile">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Contact Profile</span>
            <Badge variant="outline" className="text-base" data-testid="badge-contact-stage">
              {profile.stage}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div>
            <h3 className="text-xl font-semibold" data-testid="text-contact-name">{fullName}</h3>
            {profile.job_title && (
              <p className="text-sm text-muted-foreground" data-testid="text-contact-job-title">
                {profile.job_title}
              </p>
            )}
          </div>

          <Separator />

          {/* Contact Details */}
          <div className="space-y-2">
            {profile.email && (
              <div className="flex items-center gap-2 text-sm" data-testid="text-contact-email">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{profile.email}</span>
              </div>
            )}
            {profile.phone && (
              <div className="flex items-center gap-2 text-sm" data-testid="text-contact-phone">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{profile.phone}</span>
              </div>
            )}
            {profile.company && (
              <div className="flex items-center gap-2 text-sm" data-testid="text-contact-company">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{profile.company}</span>
              </div>
            )}
            {profile.position && (
              <div className="flex items-center gap-2 text-sm" data-testid="text-contact-position">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{profile.position}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Social Links */}
          {(profile.linkedin_url || profile.twitter_handle) && (
            <>
              <div className="space-y-2">
                {profile.linkedin_url && (
                  <a 
                    href={profile.linkedin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    data-testid="link-contact-linkedin"
                  >
                    <Linkedin className="h-4 w-4" />
                    <span>LinkedIn Profile</span>
                  </a>
                )}
                {profile.twitter_handle && (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-contact-twitter">
                    <Twitter className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.twitter_handle}</span>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Lead Score & Stats */}
          <div className="grid grid-cols-2 gap-4">
            {profile.score !== null && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>Lead Score</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-contact-score">{profile.score}</p>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>Responses</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-contact-total-responses">
                {profile.total_responses}
              </p>
            </div>
          </div>

          {/* Tags */}
          {profile.tags && profile.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Hash className="h-4 w-4" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" data-testid={`badge-contact-tag-${idx}`}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {profile.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm" data-testid="text-contact-notes">{profile.notes}</p>
              </div>
            </>
          )}

          {/* Important Dates */}
          {(profile.last_contacted || profile.next_follow_up) && (
            <>
              <Separator />
              <div className="space-y-2">
                {profile.last_contacted && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Contacted</span>
                    <span data-testid="text-contact-last-contacted">
                      {format(new Date(profile.last_contacted), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {profile.next_follow_up && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next Follow-up</span>
                    <span data-testid="text-contact-next-followup">
                      {format(new Date(profile.next_follow_up), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Response History */}
      {profile.all_responses.length > 0 && (
        <Card data-testid="card-response-history">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Response History</span>
              <Badge variant="outline" data-testid="badge-interested-count">
                {profile.interested_responses} Interested
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profile.all_responses.map((response, idx) => (
                <div 
                  key={response.id} 
                  className="border rounded-lg p-3 space-y-2"
                  data-testid={`card-response-history-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={response.intent_tag === 'interested' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {response.intent_tag.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">
                        {response.channel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(response.created_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {response.message_content}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
