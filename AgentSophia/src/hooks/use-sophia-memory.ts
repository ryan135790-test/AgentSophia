import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SophiaConversation, SophiaMessage, SophiaMemory } from '@shared/schema';

interface MemoryContext {
  userMemories: SophiaMemory[];
  recentConversations: SophiaConversation[];
  contactMemories: any[];
}

export function useSophiaMemory(userId: string | null, workspaceId?: string | null) {
  const queryClient = useQueryClient();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const { data: conversations, isLoading: conversationsLoading } = useQuery<SophiaConversation[]>({
    queryKey: ['/api/sophia/memory/conversations', userId],
    queryFn: async () => {
      if (!userId) return [];
      const params = new URLSearchParams({ user_id: userId });
      if (workspaceId) params.append('workspace_id', workspaceId);
      const response = await fetch(`/api/sophia/memory/conversations?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!userId,
  });

  const { data: memoryContext } = useQuery<MemoryContext>({
    queryKey: ['/api/sophia/memory/context', userId],
    queryFn: async () => {
      if (!userId) return { userMemories: [], recentConversations: [], contactMemories: [] };
      const response = await fetch(`/api/sophia/memory/context/${userId}`);
      if (!response.ok) return { userMemories: [], recentConversations: [], contactMemories: [] };
      return response.json();
    },
    enabled: !!userId,
  });

  const { data: memoryPrompt } = useQuery<{ memoryPrompt: string }>({
    queryKey: ['/api/sophia/memory/context-prompt', userId],
    queryFn: async () => {
      if (!userId) return { memoryPrompt: '' };
      const response = await fetch(`/api/sophia/memory/context-prompt/${userId}`);
      if (!response.ok) return { memoryPrompt: '' };
      return response.json();
    },
    enabled: !!userId,
  });

  const { data: currentMessages, refetch: refetchMessages } = useQuery<SophiaMessage[]>({
    queryKey: ['/api/sophia/memory/messages', currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      const response = await fetch(`/api/sophia/memory/conversations/${currentConversationId}/messages`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!currentConversationId,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { title?: string; context?: string }) => {
      if (!userId) throw new Error('User not logged in');
      const response = await fetch('/api/sophia/memory/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          workspace_id: workspaceId,
          title: data.title,
          context: data.context,
        }),
      });
      if (!response.ok) throw new Error('Failed to create conversation');
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/memory/conversations', userId] });
    },
  });

  const saveMessageMutation = useMutation({
    mutationFn: async (data: {
      conversation_id: string;
      role: 'user' | 'assistant';
      content: string;
      context_page?: string;
      contact_id?: string;
      campaign_id?: string;
      model_used?: string;
      tokens_used?: number;
      confidence_score?: number;
    }) => {
      if (!userId || !data.conversation_id) throw new Error('No active conversation');
      const response = await fetch('/api/sophia/memory/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ...data,
        }),
      });
      if (!response.ok) throw new Error('Failed to save message');
      return response.json();
    },
    onSuccess: () => {
      refetchMessages();
    },
  });

  const saveMemoryMutation = useMutation({
    mutationFn: async (data: {
      memory_type: string;
      category: string;
      key: string;
      value: string;
      confidence?: number;
    }) => {
      if (!userId) throw new Error('User not logged in');
      const response = await fetch('/api/sophia/memory/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          workspace_id: workspaceId,
          source_conversation_id: currentConversationId,
          ...data,
        }),
      });
      if (!response.ok) throw new Error('Failed to save memory');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/memory/context', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/memory/context-prompt', userId] });
    },
  });

  const updateConversationSummary = useCallback(async (summary: string) => {
    if (!currentConversationId) return;
    await fetch(`/api/sophia/memory/conversations/${currentConversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/sophia/memory/conversations', userId] });
  }, [currentConversationId, userId, queryClient]);

  const startNewConversation = useCallback(async (context?: string) => {
    const result = await createConversationMutation.mutateAsync({
      title: 'New conversation',
      context,
    });
    return result;
  }, [createConversationMutation]);

  const loadConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
  }, []);

  const saveMessage = useCallback(async (
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      context_page?: string;
      contact_id?: string;
      campaign_id?: string;
      model_used?: string;
      tokens_used?: number;
      confidence_score?: number;
    }
  ) => {
    let convId = currentConversationId;
    if (!convId) {
      const newConv = await startNewConversation(metadata?.context_page);
      convId = newConv.id;
    }
    return saveMessageMutation.mutateAsync({ conversation_id: convId, role, content, ...metadata });
  }, [currentConversationId, startNewConversation, saveMessageMutation]);

  const learnFact = useCallback(async (
    category: string,
    key: string,
    value: string,
    memoryType: string = 'fact'
  ) => {
    return saveMemoryMutation.mutateAsync({
      memory_type: memoryType,
      category,
      key,
      value,
      confidence: 75,
    });
  }, [saveMemoryMutation]);

  return {
    conversations: conversations || [],
    conversationsLoading,
    currentConversationId,
    currentMessages: currentMessages || [],
    memoryContext: memoryContext || { userMemories: [], recentConversations: [], contactMemories: [] },
    memoryPrompt: memoryPrompt?.memoryPrompt || '',
    startNewConversation,
    loadConversation,
    saveMessage,
    learnFact,
    updateConversationSummary,
    isCreatingConversation: createConversationMutation.isPending,
    isSavingMessage: saveMessageMutation.isPending,
  };
}
