import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Link2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function CalendarBookingManager() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [connections, setConnections] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('google');
  const [email, setEmail] = useState('');

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
      const [connRes, bookRes, availRes] = await Promise.all([
        fetch(`/api/workspaces/${currentWorkspace.id}/calendar-connections`),
        fetch(`/api/workspaces/${currentWorkspace.id}/bookings`),
        fetch(`/api/workspaces/${currentWorkspace.id}/availability`)
      ]);

      if (connRes.ok) setConnections(await connRes.json());
      if (bookRes.ok) setBookings(await bookRes.json());
      if (availRes.ok) setAvailability(await availRes.json());
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load calendar data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const connectCalendar = async () => {
    if (!email || !currentWorkspace?.id) {
      toast({ title: 'Error', description: 'Email required', variant: 'destructive' });
      return;
    }

    const res = await fetch(`/api/workspaces/${currentWorkspace.id}/calendar-connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        email,
        access_token: 'demo-token-' + Math.random(),
        is_primary: connections.length === 0,
        sync_enabled: true
      })
    });

    if (res.ok) {
      toast({ title: 'Success', description: `${provider} calendar connected` });
      setEmail('');
      fetchData();
    }
  };

  const confirmBooking = async (bookingId: string) => {
    if (!currentWorkspace?.id) return;
    const res = await fetch(`/api/workspaces/${currentWorkspace.id}/bookings/${bookingId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_time: new Date().toISOString() })
    });

    if (res.ok) {
      const data = await res.json();
      toast({ title: 'Success', description: 'Meeting scheduled & invite sent' });
      fetchData();
    }
  };

  if (loading) return <div>Loading calendar data...</div>;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="connections">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connections">Calendar Connections</TabsTrigger>
          <TabsTrigger value="availability">Your Availability</TabsTrigger>
          <TabsTrigger value="bookings">Meeting Requests</TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Connect Calendar
              </CardTitle>
              <CardDescription>Link Google Calendar, Outlook, or Calendly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div data-testid="select-calendar-provider">
                <label className="text-sm font-medium">Calendar Provider</label>
                <Select value={provider || "google"} onValueChange={setProvider}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google" data-testid="option-google">Google Calendar</SelectItem>
                    <SelectItem value="outlook" data-testid="option-outlook">Microsoft Outlook</SelectItem>
                    <SelectItem value="calendly" data-testid="option-calendly">Calendly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div data-testid="input-calendar-email">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1"
                />
              </div>
              <Button onClick={connectCalendar} className="w-full" data-testid="button-connect-calendar">
                <Calendar className="h-4 w-4 mr-2" />
                Connect Calendar
              </Button>
            </CardContent>
          </Card>

          {connections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connected Calendars</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {connections.map((conn) => (
                  <div key={conn.id} className="border rounded p-3 flex justify-between items-center" data-testid={`card-calendar-${conn.provider}`}>
                    <div>
                      <p className="font-medium text-sm capitalize">{conn.provider}</p>
                      <p className="text-xs text-muted-foreground">{conn.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {conn.is_primary && <Badge>Primary</Badge>}
                      <Badge variant={conn.sync_enabled ? 'default' : 'secondary'}>
                        {conn.sync_enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Meeting Availability
              </CardTitle>
              <CardDescription>Set when you're available for meetings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {availability.length > 0 ? (
                  availability.map((slot) => (
                    <div key={slot.id} className="border rounded p-3 flex justify-between items-center" data-testid={`card-availability-${slot.day_of_week}`}>
                      <div>
                        <p className="font-medium text-sm capitalize">{slot.day_of_week}</p>
                        <p className="text-sm text-muted-foreground">{slot.start_time} - {slot.end_time}</p>
                        {slot.buffer_before_minutes > 0 && (
                          <p className="text-xs text-muted-foreground">{slot.buffer_before_minutes}min buffer</p>
                        )}
                      </div>
                      <Badge variant="outline">{slot.timezone}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No availability configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Meeting Requests
              </CardTitle>
              <CardDescription>Pending & confirmed bookings from prospects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bookings.length > 0 ? (
                  bookings.map((booking) => (
                    <div key={booking.id} className="border rounded p-4 space-y-3" data-testid={`card-booking-${booking.id}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{booking.contact_name}</p>
                          <p className="text-sm text-muted-foreground">{booking.meeting_title}</p>
                        </div>
                        <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                          {booking.status === 'confirmed' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {booking.status}
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {booking.status}
                            </>
                          )}
                        </Badge>
                      </div>
                      {booking.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => confirmBooking(booking.id)}
                          className="w-full"
                          data-testid={`button-confirm-booking-${booking.id}`}
                        >
                          Confirm & Send Invite
                        </Button>
                      )}
                      {booking.status === 'confirmed' && booking.meeting_link && (
                        <a href={booking.meeting_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="w-full" data-testid={`button-open-meeting-${booking.id}`}>
                            Join Meeting
                          </Button>
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No meeting requests</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
