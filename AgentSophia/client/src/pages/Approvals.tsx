import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, MessageCircle, Calendar, ChevronDown } from 'lucide-react';

interface ApprovalMessage {
  id: string;
  from: string;
  company: string;
  message: string;
  channel: 'email' | 'linkedin' | 'sms';
  intent: string;
  urgency: number;
  confidence: number;
  responseOptions: {
    option: number;
    response: string;
    rationale: string;
  }[];
  recommendedAction: string;
  timestamp: string;
}

interface ApprovalMeeting {
  id: string;
  prospect: string;
  company: string;
  message: string;
  suggestedTimes: {
    time: string;
    timezone: string;
    reason: string;
  }[];
  bookingMessage: string;
  timestamp: string;
}

// Mock data for demo
const MOCK_MESSAGE_APPROVALS: ApprovalMessage[] = [
  {
    id: 'msg_1',
    from: 'Sarah Chen',
    company: 'TechCorp Inc',
    message: 'Hey! This looks interesting. When can we set up a call to discuss implementation?',
    channel: 'email',
    intent: 'approval',
    urgency: 8,
    confidence: 0.95,
    responseOptions: [
      {
        option: 1,
        response: "That's fantastic to hear! How does Thursday at 2 PM work for a call to discuss implementation?",
        rationale: 'Shows enthusiasm and offers specific time'
      },
      {
        option: 2,
        response: "I'm thrilled you're interested! Let's set up a call to dive into the implementation details. Can you share your availability this week, or would early next week be better?",
        rationale: 'More flexible, encourages them to share schedule (RECOMMENDED)'
      },
      {
        option: 3,
        response: "Absolutely! We can definitely arrange a call. Would you prefer a detailed overview or focus on specific areas during our discussion?",
        rationale: 'Engages by asking preference for agenda'
      }
    ],
    recommendedAction: 'meeting_booking',
    timestamp: '2 minutes ago'
  },
  {
    id: 'msg_2',
    from: 'Michael Davis',
    company: 'Sales Inc',
    message: 'Interested in learning more, but have some questions about integration with our existing CRM.',
    channel: 'linkedin',
    intent: 'request_info',
    urgency: 6,
    confidence: 0.92,
    responseOptions: [
      {
        option: 1,
        response: 'Great question! We integrate seamlessly with Salesforce, HubSpot, and Pipedrive. Which CRM do you use?',
        rationale: 'Direct, clarifies their setup'
      },
      {
        option: 2,
        response: "Happy to address that! We support all major CRM platforms (Salesforce, HubSpot, Pipedrive, etc.). Let me send you a detailed integration guide specific to your setup. Which CRM are you using?",
        rationale: 'Consultative, offers to send resources (RECOMMENDED)'
      },
      {
        option: 3,
        response: 'Our integrations are plug-and-play. Can you tell me more about your current CRM stack?',
        rationale: 'Simple, asks for more context'
      }
    ],
    recommendedAction: 'auto_send_option_2',
    timestamp: '15 minutes ago'
  },
  {
    id: 'msg_3',
    from: 'Jennifer Lopez',
    company: 'Enterprise Co',
    message: "I'm on a tight budget this quarter. Can you work with us on pricing?",
    channel: 'email',
    intent: 'objection',
    urgency: 5,
    confidence: 0.88,
    responseOptions: [
      {
        option: 1,
        response: "I understand budget is tight. We offer flexible plans and can explore options. Let's chat about what works for your budget.",
        rationale: 'Acknowledges concern, opens discussion'
      },
      {
        option: 2,
        response: "Absolutely, I get it. Most of our enterprise clients see ROI within 6 weeks, which often offsets the investment. Can we schedule a quick call to explore options that fit your situation?",
        rationale: 'Shows value, asks for meeting (RECOMMENDED)'
      },
      {
        option: 3,
        response: 'We have options for every budget. Would a 20-min call to discuss work?',
        rationale: 'Quick, direct call to action'
      }
    ],
    recommendedAction: 'human_review',
    timestamp: '1 hour ago'
  }
];

const MOCK_MEETING_APPROVALS: ApprovalMeeting[] = [
  {
    id: 'meet_1',
    prospect: 'Sarah Chen',
    company: 'TechCorp Inc',
    message: 'Yes, were interested and would like to see a demo next week',
    suggestedTimes: [
      { time: 'Tuesday 2pm ET', timezone: 'ET', reason: 'Mid-week afternoon' },
      { time: 'Wednesday 10am ET', timezone: 'ET', reason: 'Fresh start' },
      { time: 'Thursday 3pm ET', timezone: 'ET', reason: 'Late week option' }
    ],
    bookingMessage: 'Perfect! Here are three times that work great for us: Tuesday 2pm, Wednesday 10am, or Thursday 3pm ET. Click [CALENDAR_LINK] to book your preferred slot.',
    timestamp: '5 minutes ago'
  },
  {
    id: 'meet_2',
    prospect: 'David Smith',
    company: 'Growth Corp',
    message: 'Sounds good, lets connect to discuss next steps',
    suggestedTimes: [
      { time: 'Monday 11am PT', timezone: 'PT', reason: 'Start of week' },
      { time: 'Wednesday 2pm PT', timezone: 'PT', reason: 'Mid-week check-in' },
      { time: 'Friday 10am PT', timezone: 'PT', reason: 'End of week wrap-up' }
    ],
    bookingMessage: 'Excellent! Let me send over some times. I have availability Monday 11am, Wednesday 2pm, or Friday 10am PT - all Pacific time. Pick whichever works best: [CALENDAR_LINK]',
    timestamp: '45 minutes ago'
  }
];

export default function Approvals() {
  const [messageApprovals, setMessageApprovals] = useState<ApprovalMessage[]>(MOCK_MESSAGE_APPROVALS);
  const [meetingApprovals, setMeetingApprovals] = useState<ApprovalMeeting[]>(MOCK_MEETING_APPROVALS);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  const handleApproveMessage = (id: string, responseOption: number) => {
    console.log(`✅ Approved message ${id} with response option ${responseOption}`);
    setMessageApprovals(messageApprovals.filter(m => m.id !== id));
  };

  const handleRejectMessage = (id: string) => {
    console.log(`❌ Rejected message ${id}`);
    setMessageApprovals(messageApprovals.filter(m => m.id !== id));
  };

  const handleApproveMeeting = (id: string) => {
    console.log(`✅ Approved meeting booking ${id}`);
    setMeetingApprovals(meetingApprovals.filter(m => m.id !== id));
  };

  const handleRejectMeeting = (id: string) => {
    console.log(`❌ Rejected meeting booking ${id}`);
    setMeetingApprovals(meetingApprovals.filter(m => m.id !== id));
  };

  const getIntentColor = (intent: string) => {
    const colors: Record<string, string> = {
      approval: 'bg-green-50 border-green-200 text-green-700',
      objection: 'bg-yellow-50 border-yellow-200 text-yellow-700',
      request_info: 'bg-blue-50 border-blue-200 text-blue-700',
      question: 'bg-purple-50 border-purple-200 text-purple-700',
      rejection: 'bg-red-50 border-red-200 text-red-700'
    };
    return colors[intent] || 'bg-gray-50 border-gray-200 text-gray-700';
  };

  const getRecommendationColor = (action: string) => {
    if (action === 'auto_send_option_2') return 'text-green-600';
    if (action === 'meeting_booking') return 'text-blue-600';
    if (action === 'human_review') return 'text-orange-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8" data-testid="approvals-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Approvals Workspace</h1>
          <p className="text-gray-600 mt-2">Review and approve autonomous actions from Agent Sophia</p>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Message Approvals */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Messages Awaiting Approval</h2>
              {messageApprovals.length > 0 && (
                <span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  {messageApprovals.length}
                </span>
              )}
            </div>

            {messageApprovals.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">All messages approved! Great work.</p>
              </div>
            ) : (
              messageApprovals.map(approval => (
                <div
                  key={approval.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition"
                  data-testid={`message-approval-${approval.id}`}
                >
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{approval.from}</h3>
                          <span className={`text-xs px-2 py-1 rounded border ${getIntentColor(approval.intent)}`}>
                            {approval.intent}
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-medium text-gray-600">Urgency: {approval.urgency}/10</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{approval.company}</p>
                      </div>
                    </div>

                    {/* Message Preview */}
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-sm text-gray-700 italic">"{approval.message}"</p>
                    </div>

                    {/* Metadata */}
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{approval.channel.toUpperCase()}</span>
                      <span>{approval.timestamp}</span>
                    </div>
                  </div>

                  {/* Response Options */}
                  <div className="p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-gray-700">Suggested Responses</h4>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-medium ${getRecommendationColor(approval.recommendedAction)}`}>
                          {approval.recommendedAction === 'auto_send_option_2' && '✓ Auto-send #2'}
                          {approval.recommendedAction === 'meeting_booking' && '📅 Book meeting'}
                          {approval.recommendedAction === 'human_review' && '⚠️ Review first'}
                        </span>
                      </div>
                    </div>

                    {approval.responseOptions.map(option => (
                      <div key={option.option} className="p-3 bg-white rounded border border-gray-200">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-600">
                              Option {option.option}
                              {approval.recommendedAction === 'auto_send_option_2' && option.option === 2 && (
                                <span className="ml-2 text-green-600">⭐ RECOMMENDED</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{option.rationale}</p>
                          </div>
                          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                            {option.option === 2 ? '95%' : '90%'} confidence
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">{option.response}</p>
                        <button
                          onClick={() => handleApproveMessage(approval.id, option.option)}
                          className="mt-2 w-full py-2 px-3 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded border border-green-200 transition"
                          data-testid={`approve-message-${approval.id}-option-${option.option}`}
                        >
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                          Send This Response
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                    <button
                      onClick={() => handleRejectMessage(approval.id)}
                      className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded border border-red-200 transition"
                      data-testid={`reject-message-${approval.id}`}
                    >
                      <XCircle className="w-4 h-4 inline mr-2" />
                      Reject
                    </button>
                    <button
                      onClick={() => setExpandedMessage(expandedMessage === approval.id ? null : approval.id)}
                      className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded border border-gray-200 transition"
                      data-testid={`toggle-details-${approval.id}`}
                    >
                      <ChevronDown className="w-4 h-4 inline mr-2" />
                      {expandedMessage === approval.id ? 'Hide' : 'More'}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {expandedMessage === approval.id && (
                    <div className="p-4 bg-blue-50 border-t border-blue-200 text-sm text-gray-700">
                      <p className="font-medium mb-2">Analysis Details:</p>
                      <ul className="space-y-1 list-disc list-inside text-xs">
                        <li>Confidence: {(approval.confidence * 100).toFixed(0)}%</li>
                        <li>Recommended Action: {approval.recommendedAction}</li>
                        <li>Channel: {approval.channel}</li>
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right Column: Meeting Approvals */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-900">Meetings Awaiting Approval</h2>
              {meetingApprovals.length > 0 && (
                <span className="ml-auto bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  {meetingApprovals.length}
                </span>
              )}
            </div>

            {meetingApprovals.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">All meetings scheduled! Prospects are booked.</p>
              </div>
            ) : (
              meetingApprovals.map(meeting => (
                <div
                  key={meeting.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition"
                  data-testid={`meeting-approval-${meeting.id}`}
                >
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{meeting.prospect}</h3>
                        <p className="text-sm text-gray-600">{meeting.company}</p>
                      </div>
                      <span className="text-xs text-gray-500">{meeting.timestamp}</span>
                    </div>

                    {/* Original Message */}
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-sm text-gray-700 italic">"{meeting.message}"</p>
                    </div>
                  </div>

                  {/* Suggested Times */}
                  <div className="p-4 bg-gray-50 space-y-2">
                    <h4 className="font-medium text-sm text-gray-700 mb-3">Suggested Meeting Times</h4>
                    {meeting.suggestedTimes.map((slot, idx) => (
                      <div key={idx} className="p-3 bg-white rounded border border-gray-200">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{slot.time}</p>
                            <p className="text-xs text-gray-600">{slot.reason}</p>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {slot.timezone}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Booking Message */}
                  <div className="p-4 border-t border-gray-100">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Booking Message</h4>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm text-gray-700">{meeting.bookingMessage}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                    <button
                      onClick={() => handleApproveMeeting(meeting.id)}
                      className="flex-1 py-2 px-3 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded border border-green-200 transition"
                      data-testid={`approve-meeting-${meeting.id}`}
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Send & Book
                    </button>
                    <button
                      onClick={() => handleRejectMeeting(meeting.id)}
                      className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded border border-red-200 transition"
                      data-testid={`reject-meeting-${meeting.id}`}
                    >
                      <XCircle className="w-4 h-4 inline mr-2" />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Empty State */}
        {messageApprovals.length === 0 && meetingApprovals.length === 0 && (
          <div className="mt-12 text-center">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Inbox is empty - all autonomous actions approved!</p>
            <p className="text-gray-500 text-sm mt-2">New messages and booking requests will appear here as they arrive.</p>
          </div>
        )}
      </div>
    </div>
  );
}
