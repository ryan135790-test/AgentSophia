import { Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MeetingBookingPanelProps {
  intent?: string;
  prospectName?: string;
  prospectEmail?: string;
  isBooking?: boolean;
  bookedTime?: string;
  meetingLink?: string;
  onBook?: () => void;
}

export function MeetingBookingPanel({
  intent,
  prospectName,
  prospectEmail,
  isBooking = false,
  bookedTime,
  meetingLink,
  onBook
}: MeetingBookingPanelProps) {
  const shouldShowBooking = intent === 'meeting_request' || intent === 'interested';

  if (!shouldShowBooking) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-start gap-3">
        {bookedTime ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-900 dark:text-green-100 mb-2">
                Meeting Booked!
              </p>
              <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                <p>📅 {new Date(bookedTime).toLocaleDateString()} at {new Date(bookedTime).toLocaleTimeString()}</p>
                <p>👤 {prospectName}</p>
                {meetingLink && (
                  <p className="text-blue-600 dark:text-blue-300">
                    <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="underline">
                      Join Meeting
                    </a>
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-300 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Auto-Book Meeting
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Ready to schedule with {prospectName}
              </p>
              <Button
                size="sm"
                onClick={onBook}
                disabled={isBooking}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-book-meeting"
              >
                {isBooking ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Book Next Available Time
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
