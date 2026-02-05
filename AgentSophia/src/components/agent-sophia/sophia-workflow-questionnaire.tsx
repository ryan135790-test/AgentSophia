/**
 * Sophia Workflow Questionnaire
 * Beautiful card-based UI for building campaigns
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Sparkles, CheckCircle2, Send, ChevronRight, ArrowLeft,
  Mail, Linkedin, MessageSquare, Phone, Clock, Users, Target, Zap, ArrowRight
} from 'lucide-react';

export interface WorkflowData {
  goal: string;
  audience: string;
  channels: string[];
  messaging: string;
  timing: string;
  frequency: string;
  stepCount?: number;
}

interface SophiaWorkflowQuestionnaireProps {
  onWorkflowGenerated: (workflow: WorkflowData) => void;
  onCancel: () => void;
}

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail, color: 'from-blue-500 to-blue-600' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'from-blue-700 to-blue-800' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, color: 'from-green-500 to-green-600' },
  { id: 'phone', label: 'Phone', icon: Phone, color: 'from-purple-500 to-purple-600' },
];

const CHANNEL_PRESETS = [
  { 
    label: 'Email + LinkedIn', 
    desc: 'Most common',
    channels: ['email', 'linkedin'],
    badge: 'Popular'
  },
  { 
    label: 'All 4 channels', 
    desc: 'Maximum reach',
    channels: ['email', 'linkedin', 'sms', 'phone'],
    badge: 'Max Coverage'
  },
  { 
    label: 'Email + SMS', 
    desc: 'Fast response',
    channels: ['email', 'sms'],
    badge: 'Quick'
  },
];

const GOAL_PRESETS = [
  { label: 'Generate qualified leads', desc: 'Build your pipeline' },
  { label: 'Demo/Meeting bookings', desc: 'Drive conversations' },
  { label: 'Product awareness', desc: 'Build brand presence' },
  { label: 'Increase sales velocity', desc: 'Accelerate deals' },
];

const TIMING_PRESETS = [
  { label: 'Daily with 2-day gaps', desc: '3 touches per week' },
  { label: '3 touches over 1 week', desc: 'Gentle approach' },
  { label: 'Weekly for 4 weeks', desc: 'Long-term nurture' },
  { label: 'Immediate then 3-day gaps', desc: 'Aggressive push' },
];

export function SophiaWorkflowQuestionnaire({ onWorkflowGenerated, onCancel }: SophiaWorkflowQuestionnaireProps) {
  const [step, setStep] = useState<'goal' | 'audience' | 'channels' | 'messaging' | 'timing' | 'review'>(
    'goal'
  );
  const [data, setData] = useState<WorkflowData>({
    goal: '',
    audience: '',
    channels: [],
    messaging: '',
    timing: '',
    frequency: 'daily',
  });

  const [tempInput, setTempInput] = useState('');

  const handleChannelToggle = (channelId: string) => {
    setData(prev => ({
      ...prev,
      channels: prev.channels.includes(channelId)
        ? prev.channels.filter(c => c !== channelId)
        : [...prev.channels, channelId]
    }));
  };

  const handleChannelPreset = (preset: typeof CHANNEL_PRESETS[0]) => {
    setData(prev => ({
      ...prev,
      channels: preset.channels
    }));
    handleNext();
  };

  const handleNext = () => {
    const steps: (typeof step)[] = ['goal', 'audience', 'channels', 'messaging', 'timing', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
      setTempInput('');
    }
  };

  const handlePrevious = () => {
    const steps: (typeof step)[] = ['goal', 'audience', 'channels', 'messaging', 'timing', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
      setTempInput('');
    }
  };

  const handleStepSubmit = (field: keyof WorkflowData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setTimeout(() => handleNext(), 0);
  };

  const handlePresetGoal = (goal: string) => {
    setData(prev => ({ ...prev, goal }));
    setTimeout(() => handleNext(), 0);
  };

  const handlePresetTiming = (timing: string) => {
    setData(prev => ({ ...prev, timing }));
    setTimeout(() => handleNext(), 0);
  };

  const questionsCompleted = data.goal && data.audience && data.channels.length > 0 && data.messaging && data.timing;

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Build Your Campaign</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Answer a few questions and I'll create the perfect workflow for you
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {['goal', 'audience', 'channels', 'messaging', 'timing', 'review'].map((s, idx) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full transition ${
              ['goal', 'audience', 'channels', 'messaging', 'timing', 'review'].indexOf(step) >= idx
                ? 'bg-blue-600'
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Questions */}
      <Card className="border-blue-200 dark:border-blue-800 shadow-lg">
        <CardContent className="pt-8 pb-6 space-y-6">

          {/* GOAL */}
          {step === 'goal' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">🎯 What's your campaign goal?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pick one or describe your own</p>
              </div>

              <div className="grid gap-3">
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetGoal(preset.label)}
                    className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{preset.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{preset.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">OR DESCRIBE YOUR OWN</p>
                <Textarea
                  placeholder="Tell me your campaign goal..."
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  className="bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button
                  onClick={() => handleStepSubmit('goal', tempInput)}
                  disabled={!tempInput.trim()}
                  className="gap-2"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* AUDIENCE */}
          {step === 'audience' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">👥 Who are you targeting?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Describe your ideal prospect</p>
              </div>

              {/* Quick Audience Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setTempInput('VP of Sales at B2B SaaS companies with 50-500 employees');
                    setTimeout(() => handleStepSubmit('audience', 'VP of Sales at B2B SaaS companies with 50-500 employees'), 0);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 transition font-medium"
                >
                  Sales VPs
                </button>
                <button
                  onClick={() => {
                    setTempInput('Marketing Directors at mid-market B2B companies');
                    setTimeout(() => handleStepSubmit('audience', 'Marketing Directors at mid-market B2B companies'), 0);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 transition font-medium"
                >
                  Marketing Leaders
                </button>
                <button
                  onClick={() => {
                    setTempInput('CTOs and VP of Engineering at tech companies');
                    setTimeout(() => handleStepSubmit('audience', 'CTOs and VP of Engineering at tech companies'), 0);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 transition font-medium"
                >
                  Tech Founders
                </button>
                <button
                  onClick={() => {
                    setTempInput('Startup founders and entrepreneurs');
                    setTimeout(() => handleStepSubmit('audience', 'Startup founders and entrepreneurs'), 0);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 transition font-medium"
                >
                  Founders
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center">Or write your own:</p>

              <Textarea
                placeholder="e.g., VP of Sales at B2B SaaS companies with 50-500 employees, based in US..."
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && tempInput.trim()) {
                    handleStepSubmit('audience', tempInput);
                  }
                }}
                className="min-h-28 bg-white dark:bg-slate-900 border-2 focus:border-blue-500"
                autoFocus
              />
              <p className="text-xs text-slate-500">💡 Tip: Press Ctrl+Enter to continue</p>

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={handlePrevious} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => handleStepSubmit('audience', tempInput)}
                  disabled={!tempInput.trim()}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 flex-1"
                  size="lg"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* CHANNELS */}
          {step === 'channels' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">📱 Which channels?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pick presets or mix & match</p>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                {CHANNEL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleChannelPreset(preset)}
                    className="w-full p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-slate-900 dark:text-white">{preset.label}</p>
                          <Badge variant="secondary" className="text-xs">{preset.badge}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{preset.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition ml-2 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white dark:bg-slate-900 text-slate-500">OR SELECT MANUALLY</span>
                </div>
              </div>

              {/* Manual Selection */}
              <div className="grid grid-cols-2 gap-3">
                {CHANNELS.map(channel => {
                  const Icon = channel.icon;
                  const isSelected = data.channels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      onClick={() => handleChannelToggle(channel.id)}
                      className={`p-4 rounded-lg border-2 transition flex items-center gap-2 ${
                        isSelected
                          ? `bg-gradient-to-br ${channel.color} text-white border-opacity-0`
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium text-sm">{channel.label}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 ml-auto" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handlePrevious}>Back</Button>
                <Button
                  onClick={handleNext}
                  disabled={data.channels.length === 0}
                  className="gap-2"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* MESSAGING */}
          {step === 'messaging' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">✍️ How should we message them?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Tone, approach, and key points</p>
              </div>

              {/* Quick Message Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setTempInput('Professional and formal, focus on ROI and efficiency gains, include relevant case studies');
                    setTimeout(() => handleStepSubmit('messaging', 'Professional and formal, focus on ROI and efficiency gains, include relevant case studies'), 0);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 transition font-medium"
                >
                  Professional
                </button>
                <button
                  onClick={() => {
                    setTempInput('Friendly and conversational, focus on pain points and quick wins, personalize with company insights');
                    setTimeout(() => handleStepSubmit('messaging', 'Friendly and conversational, focus on pain points and quick wins, personalize with company insights'), 0);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 transition font-medium"
                >
                  Friendly
                </button>
                <button
                  onClick={() => {
                    setTempInput('Urgent and action-oriented, create FOMO, limited time offer, clear CTA');
                    setTimeout(() => handleStepSubmit('messaging', 'Urgent and action-oriented, create FOMO, limited time offer, clear CTA'), 0);
                  }}
                  className="px-3 py-2 text-xs rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 transition font-medium"
                >
                  Urgent
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center">Or customize:</p>

              <Textarea
                placeholder="e.g., Friendly but professional, focus on ROI and time savings, include case studies, personalize with company research..."
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                className="min-h-28 bg-white dark:bg-slate-900"
              />

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handlePrevious}>Back</Button>
                <Button
                  onClick={() => handleStepSubmit('messaging', tempInput)}
                  disabled={!tempInput.trim()}
                  className="gap-2"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* TIMING */}
          {step === 'timing' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">⏰ What's your cadence?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">When and how often to reach out</p>
              </div>

              <p className="text-xs text-slate-500 font-semibold">Quick picks:</p>
              <div className="grid grid-cols-2 gap-2">
                {TIMING_PRESETS.slice(0, 2).map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleStepSubmit('timing', preset.label)}
                    className="px-3 py-2 text-xs rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 transition font-medium text-left"
                  >
                    <p className="font-semibold">{preset.label}</p>
                    <p className="text-xs opacity-75">{preset.desc}</p>
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-500 font-semibold mt-4">All options:</p>
              <div className="grid gap-3">
                {TIMING_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetTiming(preset.label)}
                    className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{preset.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{preset.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">OR DESCRIBE YOUR TIMING</p>
                <Textarea
                  placeholder="Tell me your preferred timing..."
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  className="bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handlePrevious}>Back</Button>
                <Button
                  onClick={() => handleStepSubmit('timing', tempInput)}
                  disabled={!tempInput.trim()}
                  className="gap-2"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* REVIEW */}
          {step === 'review' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">✨ Ready to launch?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Here's your campaign blueprint</p>
              </div>

              <div className="space-y-3 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                {/* Goal */}
                <div className="flex gap-3">
                  <Target className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">GOAL</p>
                    <p className="text-sm font-medium mt-0.5">{data.goal}</p>
                  </div>
                </div>

                {/* Audience */}
                <div className="flex gap-3">
                  <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">AUDIENCE</p>
                    <p className="text-sm font-medium mt-0.5">{data.audience}</p>
                  </div>
                </div>

                {/* Channels */}
                <div className="flex gap-3">
                  <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">CHANNELS</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {data.channels.map(ch => {
                        const channel = CHANNELS.find(c => c.id === ch);
                        return (
                          <Badge key={ch} variant="secondary">{channel?.label}</Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Messaging */}
                <div className="flex gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">MESSAGING</p>
                    <p className="text-sm font-medium mt-0.5">{data.messaging}</p>
                  </div>
                </div>

                {/* Timing */}
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">CADENCE</p>
                    <p className="text-sm font-medium mt-0.5">{data.timing}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handlePrevious}>Back</Button>
                <Button
                  onClick={() => onWorkflowGenerated(data)}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Zap className="h-4 w-4" />
                  Build Campaign
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
