import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Zap } from 'lucide-react';
import { useState } from 'react';

interface SuggestedResponsesProps {
  messageId: string;
  intent: string;
  contactName: string;
  companyName: string;
  onSelectResponse: (response: string) => void;
}

export function SuggestedResponses({
  messageId,
  intent,
  contactName,
  companyName,
  onSelectResponse
}: SuggestedResponsesProps) {
  const [loading, setLoading] = useState(false);

  // Mock suggestions based on intent
  const suggestions: Record<string, string[]> = {
    interested: [
      `Hi {{name}}, thanks for your interest! I'd love to show you how {{company}} can benefit from our solution. Do you have 15 minutes for a quick demo this week?`,
      `Perfect timing! I've had great success with companies similar to {{company}}. Would you be open to a brief call to explore how we might help?`
    ],
    question: [
      `Great question! Here's what I'd recommend... Let me know if you'd like to discuss further.`,
      `I completely understand. The best way to answer this is in a quick call - would you be available this Thursday?`
    ],
    meeting_request: [
      `Absolutely! I'm excited to connect. Let me send you a calendar link - what time works best for you?`,
      `Perfect! Our team will be ready. I'll send over the Zoom link shortly.`
    ],
    objection: [
      `I appreciate your honesty. Many of our clients had similar concerns at first. Would you be open to seeing a brief case study from a similar company?`,
      `That's a fair point. Let me address that directly - do you have 10 minutes for a quick call?`
    ]
  };

  const responses = suggestions[intent] || [
    `Hi {{name}}, thanks for reaching out. I'd like to learn more about your needs.`
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          💡 Sophia's Suggested Responses
        </p>
      </div>

      {responses.map((response, idx) => (
        <Card key={idx} className="p-3 hover:border-blue-400 transition">
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 line-clamp-3">
            {response
              .replace('{{name}}', contactName)
              .replace('{{company}}', companyName)
            }
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onSelectResponse(response)}
              disabled={loading}
              className="gap-2 flex-1"
            >
              <CheckCircle className="h-3 w-3" />
              Use This
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelectResponse(response)}
            >
              Edit
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
