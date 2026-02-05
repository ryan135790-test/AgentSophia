import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, MessageSquare } from 'lucide-react';
import { AIAssistantChat } from './ai-assistant-chat';

interface AIAssistantButtonProps {
  context?: string;
}

export function AIAssistantButton({ context }: AIAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-2xl hover:scale-110 transition-transform"
          data-testid="button-open-ai-assistant"
        >
          <Bot className="h-6 w-6" />
        </Button>
      )}
      
      <AIAssistantChat 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        context={context}
      />
    </>
  );
}
