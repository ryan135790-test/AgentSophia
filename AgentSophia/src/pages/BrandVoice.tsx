import { BrandVoiceManager } from '@/components/agent-sophia/brand-voice-manager';

export default function BrandVoice() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-brand-voice-title">Brand Voice</h1>
        <p className="text-muted-foreground" data-testid="text-brand-voice-description">
          Define your brand's voice and tone for AI-generated content across all campaigns
        </p>
      </div>
      <BrandVoiceManager />
    </div>
  );
}
