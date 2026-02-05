import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  workflowId?: string;
}

interface BrandVoice {
  tone?: string;
  style?: string;
  keyPhrases?: string[];
  examples?: string[];
}

interface SophiaWorkspaceState {
  chatMode: 'conversational' | 'visual';
  activeWorkflowId: string | null;
  chatTranscript: Message[];
  brandVoice: BrandVoice | null;
  workflowDraft: any | null;
}

interface SophiaWorkspaceContextValue extends SophiaWorkspaceState {
  setChatMode: (mode: 'conversational' | 'visual') => void;
  setActiveWorkflowId: (id: string | null) => void;
  addChatMessage: (message: Message) => void;
  setChatTranscript: (messages: Message[]) => void;
  setBrandVoice: (voice: BrandVoice | null) => void;
  setWorkflowDraft: (draft: any) => void;
  clearWorkspace: () => void;
  onWorkflowReady: (workflowId: string) => void;
}

const STORAGE_KEY = 'sophia-workspace';

const SophiaWorkspaceContext = createContext<SophiaWorkspaceContextValue | undefined>(undefined);

const loadFromStorage = (): Partial<SophiaWorkspaceState> => {
  // Guard against non-browser environments (SSR, tests)
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    
    const parsed = JSON.parse(stored);
    // Rehydrate dates
    if (parsed.chatTranscript) {
      parsed.chatTranscript = parsed.chatTranscript.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load workspace from storage:', error);
    return {};
  }
};

const saveToStorage = (state: SophiaWorkspaceState) => {
  // Guard against non-browser environments (SSR, tests)
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save workspace to storage:', error);
  }
};

export function SophiaWorkspaceProvider({ children }: { children: ReactNode }) {
  const stored = loadFromStorage();
  
  const [chatMode, setChatMode] = useState<'conversational' | 'visual'>(
    stored.chatMode || 'conversational'
  );
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(
    stored.activeWorkflowId || null
  );
  const [chatTranscript, setChatTranscript] = useState<Message[]>(
    stored.chatTranscript || []
  );
  const [brandVoice, setBrandVoice] = useState<BrandVoice | null>(
    stored.brandVoice || null
  );
  const [workflowDraft, setWorkflowDraft] = useState<any>(
    stored.workflowDraft || null
  );

  // Persist to localStorage whenever state changes
  useEffect(() => {
    const state: SophiaWorkspaceState = {
      chatMode,
      activeWorkflowId,
      chatTranscript,
      brandVoice,
      workflowDraft
    };
    saveToStorage(state);
  }, [chatMode, activeWorkflowId, chatTranscript, brandVoice, workflowDraft]);

  const addChatMessage = (message: Message) => {
    setChatTranscript(prev => [...prev, message]);
  };

  const clearWorkspace = () => {
    setChatMode('conversational');
    setActiveWorkflowId(null);
    setChatTranscript([]);
    setWorkflowDraft(null);
    // Preserve brand voice
  };

  // Callback for when workflow is generated
  const onWorkflowReady = (workflowId: string) => {
    setActiveWorkflowId(workflowId);
    setChatMode('visual');
  };

  const value: SophiaWorkspaceContextValue = {
    chatMode,
    activeWorkflowId,
    chatTranscript,
    brandVoice,
    workflowDraft,
    setChatMode,
    setActiveWorkflowId,
    addChatMessage,
    setChatTranscript,
    setBrandVoice,
    setWorkflowDraft,
    clearWorkspace,
    onWorkflowReady
  };

  return (
    <SophiaWorkspaceContext.Provider value={value}>
      {children}
    </SophiaWorkspaceContext.Provider>
  );
}

export function useSophiaWorkspace() {
  const context = useContext(SophiaWorkspaceContext);
  if (!context) {
    throw new Error('useSophiaWorkspace must be used within SophiaWorkspaceProvider');
  }
  return context;
}
