import { StayInTouchAutomation } from '@/components/features/stay-in-touch-automation';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function StayInTouch() {
  const { currentWorkspace } = useWorkspace();
  
  if (!currentWorkspace?.id) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }
  
  return <StayInTouchAutomation workspaceId={currentWorkspace.id} />;
}