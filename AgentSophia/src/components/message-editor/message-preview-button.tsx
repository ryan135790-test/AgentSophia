import { Button } from '@/components/ui/button';
import { Edit3, Eye } from 'lucide-react';

interface MessagePreviewButtonProps {
  message: string;
  subject?: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showText?: boolean;
}

export function MessagePreviewButton({
  message,
  subject,
  onClick,
  variant = 'outline',
  size = 'sm',
  showText = true
}: MessagePreviewButtonProps) {
  const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className="gap-2"
      title="Click to view and edit full message"
      data-testid="button-edit-message"
    >
      <Edit3 className="h-4 w-4" />
      {showText && 'Edit Message'}
    </Button>
  );
}
