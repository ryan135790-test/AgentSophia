import { Card } from '@/components/ui/card';
import { InboxIntentBadge } from './inbox-intent-badge';
import { Mail, MessageCircle, X } from 'lucide-react';
import { useState } from 'react';

interface MessageCardProps {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  preview: string;
  intent: string;
  sentiment: string;
  buyer_signal_score: number;
  timestamp: string;
  is_read: boolean;
  onSelect: () => void;
  isSelected: boolean;
}

export function InboxMessageCard({
  id, from_name, from_email, subject, preview, intent, sentiment,
  buyer_signal_score, timestamp, is_read, onSelect, isSelected
}: MessageCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={`p-4 cursor-pointer transition ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20'
          : is_read
          ? 'hover:bg-slate-50 dark:hover:bg-slate-900'
          : 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30'
      }`}
      data-testid={`card-message-${id}`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${!is_read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
              {from_name}
            </p>
            <p className="text-xs text-slate-500 truncate">{from_email}</p>
          </div>
          {!is_read && <div className="h-2 w-2 rounded-full bg-blue-600 mt-1 flex-shrink-0" />}
        </div>

        {/* Subject */}
        <div>
          <p className={`text-sm font-medium line-clamp-2 ${!is_read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
            {subject}
          </p>
          <p className="text-xs text-slate-500 line-clamp-1 mt-1">{preview}</p>
        </div>

        {/* Intent Badge */}
        <InboxIntentBadge intent={intent} score={buyer_signal_score} />

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{timestamp}</span>
          <span className="capitalize">{sentiment}</span>
        </div>
      </div>
    </Card>
  );
}
