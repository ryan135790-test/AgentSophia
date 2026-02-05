export interface ProfileViewAction {
  id: string;
  campaignId: string;
  prospectLinkedInUrl: string;
  accountId: string;
  scheduledFor: Date;
  executedAt: Date | null;
  status: 'pending' | 'completed' | 'failed';
  followUpAction: 'connection_request' | 'message' | 'none';
  delayBeforeFollowUp: number;
}

export interface PostLikeAction {
  id: string;
  campaignId: string;
  prospectLinkedInUrl: string;
  postUrl: string;
  accountId: string;
  scheduledFor: Date;
  executedAt: Date | null;
  status: 'pending' | 'completed' | 'failed';
}

export interface InMailAction {
  id: string;
  campaignId: string;
  prospectLinkedInUrl: string;
  subject: string;
  messageContent: string;
  accountId: string;
  scheduledFor: Date;
  executedAt: Date | null;
  status: 'pending' | 'sent' | 'opened' | 'replied' | 'failed';
  inMailCreditsUsed: number;
}

export interface NotAcceptedSubsequence {
  id: string;
  campaignId: string;
  name: string;
  triggerAfterDays: number;
  isActive: boolean;
  steps: SubsequenceStep[];
}

export interface SubsequenceStep {
  id: string;
  order: number;
  actionType: 'profile_view' | 'post_like' | 'inmail' | 'withdraw_request';
  delayDays: number;
  messageTemplate?: string;
  inMailSubject?: string;
  isActive: boolean;
}

export interface ProspectEngagementState {
  prospectLinkedInUrl: string;
  campaignId: string;
  connectionRequestSentAt: Date;
  connectionRequestStatus: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  lastCheckAt: Date;
  subsequenceId: string | null;
  currentSubsequenceStep: number;
  nextActionScheduledFor: Date | null;
  engagementHistory: Array<{
    actionType: string;
    executedAt: Date;
    result: string;
  }>;
}

class LinkedInAdvancedActionsEngine {
  private profileViews: Map<string, ProfileViewAction> = new Map();
  private postLikes: Map<string, PostLikeAction> = new Map();
  private inMails: Map<string, InMailAction> = new Map();
  private subsequences: Map<string, NotAcceptedSubsequence> = new Map();
  private prospectStates: Map<string, ProspectEngagementState> = new Map();

  scheduleProfileView(
    campaignId: string,
    prospectLinkedInUrl: string,
    accountId: string,
    scheduledFor: Date,
    followUpAction: 'connection_request' | 'message' | 'none' = 'connection_request',
    delayBeforeFollowUp: number = 24 * 60 * 60 * 1000
  ): ProfileViewAction {
    const action: ProfileViewAction = {
      id: `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId,
      prospectLinkedInUrl,
      accountId,
      scheduledFor,
      executedAt: null,
      status: 'pending',
      followUpAction,
      delayBeforeFollowUp,
    };
    
    this.profileViews.set(action.id, action);
    return action;
  }

  schedulePostLike(
    campaignId: string,
    prospectLinkedInUrl: string,
    postUrl: string,
    accountId: string,
    scheduledFor: Date
  ): PostLikeAction {
    const action: PostLikeAction = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId,
      prospectLinkedInUrl,
      postUrl,
      accountId,
      scheduledFor,
      executedAt: null,
      status: 'pending',
    };
    
    this.postLikes.set(action.id, action);
    return action;
  }

  scheduleInMail(
    campaignId: string,
    prospectLinkedInUrl: string,
    subject: string,
    messageContent: string,
    accountId: string,
    scheduledFor: Date
  ): InMailAction {
    const action: InMailAction = {
      id: `im_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId,
      prospectLinkedInUrl,
      subject,
      messageContent,
      accountId,
      scheduledFor,
      executedAt: null,
      status: 'pending',
      inMailCreditsUsed: 0,
    };
    
    this.inMails.set(action.id, action);
    return action;
  }

  createNotAcceptedSubsequence(
    campaignId: string,
    name: string,
    triggerAfterDays: number,
    steps: Omit<SubsequenceStep, 'id'>[]
  ): NotAcceptedSubsequence {
    const subsequence: NotAcceptedSubsequence = {
      id: `subseq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId,
      name,
      triggerAfterDays,
      isActive: true,
      steps: steps.map((step, index) => ({
        ...step,
        id: `step_${index}_${Math.random().toString(36).substr(2, 9)}`,
      })),
    };
    
    this.subsequences.set(subsequence.id, subsequence);
    return subsequence;
  }

  initializeProspectState(
    prospectLinkedInUrl: string,
    campaignId: string,
    connectionRequestSentAt: Date
  ): ProspectEngagementState {
    const state: ProspectEngagementState = {
      prospectLinkedInUrl,
      campaignId,
      connectionRequestSentAt,
      connectionRequestStatus: 'pending',
      lastCheckAt: new Date(),
      subsequenceId: null,
      currentSubsequenceStep: 0,
      nextActionScheduledFor: null,
      engagementHistory: [{
        actionType: 'connection_request',
        executedAt: connectionRequestSentAt,
        result: 'sent',
      }],
    };
    
    const key = `${campaignId}:${prospectLinkedInUrl}`;
    this.prospectStates.set(key, state);
    return state;
  }

  checkAndTriggerSubsequences(): ProspectEngagementState[] {
    const triggeredStates: ProspectEngagementState[] = [];
    const now = new Date();

    for (const [key, state] of this.prospectStates) {
      if (state.connectionRequestStatus !== 'pending') continue;
      if (state.subsequenceId) continue;

      const subsequence = Array.from(this.subsequences.values())
        .find(s => s.campaignId === state.campaignId && s.isActive);
      
      if (!subsequence) continue;

      const daysSinceRequest = Math.floor(
        (now.getTime() - state.connectionRequestSentAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRequest >= subsequence.triggerAfterDays) {
        state.subsequenceId = subsequence.id;
        state.currentSubsequenceStep = 0;
        
        if (subsequence.steps.length > 0) {
          const firstStep = subsequence.steps[0];
          state.nextActionScheduledFor = new Date(
            now.getTime() + firstStep.delayDays * 24 * 60 * 60 * 1000
          );
        }
        
        triggeredStates.push(state);
      }
    }

    return triggeredStates;
  }

  executeNextSubsequenceStep(state: ProspectEngagementState): SubsequenceStep | null {
    if (!state.subsequenceId) return null;

    const subsequence = this.subsequences.get(state.subsequenceId);
    if (!subsequence) return null;

    if (state.currentSubsequenceStep >= subsequence.steps.length) return null;

    const step = subsequence.steps[state.currentSubsequenceStep];
    
    state.engagementHistory.push({
      actionType: step.actionType,
      executedAt: new Date(),
      result: 'executed',
    });

    state.currentSubsequenceStep++;

    if (state.currentSubsequenceStep < subsequence.steps.length) {
      const nextStep = subsequence.steps[state.currentSubsequenceStep];
      state.nextActionScheduledFor = new Date(
        Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000
      );
    } else {
      state.nextActionScheduledFor = null;
    }

    return step;
  }

  updateConnectionStatus(
    campaignId: string,
    prospectLinkedInUrl: string,
    status: 'accepted' | 'declined' | 'withdrawn'
  ): void {
    const key = `${campaignId}:${prospectLinkedInUrl}`;
    const state = this.prospectStates.get(key);
    
    if (state) {
      state.connectionRequestStatus = status;
      
      if (status === 'accepted' || status === 'withdrawn') {
        state.subsequenceId = null;
        state.nextActionScheduledFor = null;
      }
      
      state.engagementHistory.push({
        actionType: 'status_update',
        executedAt: new Date(),
        result: status,
      });
    }
  }

  getPendingActions(campaignId?: string): {
    profileViews: ProfileViewAction[];
    postLikes: PostLikeAction[];
    inMails: InMailAction[];
  } {
    const filterByStatus = (actions: Map<string, any>) => 
      Array.from(actions.values()).filter(a => 
        a.status === 'pending' && 
        (!campaignId || a.campaignId === campaignId) &&
        new Date(a.scheduledFor) <= new Date()
      );

    return {
      profileViews: filterByStatus(this.profileViews),
      postLikes: filterByStatus(this.postLikes),
      inMails: filterByStatus(this.inMails),
    };
  }

  markActionCompleted(actionId: string, actionType: 'profile_view' | 'post_like' | 'inmail'): void {
    if (actionType === 'profile_view') {
      const action = this.profileViews.get(actionId);
      if (action) {
        action.status = 'completed';
        action.executedAt = new Date();
      }
    } else if (actionType === 'post_like') {
      const action = this.postLikes.get(actionId);
      if (action) {
        action.status = 'completed';
        action.executedAt = new Date();
      }
    } else if (actionType === 'inmail') {
      const action = this.inMails.get(actionId);
      if (action) {
        action.status = 'sent';
        action.executedAt = new Date();
        action.inMailCreditsUsed = 1;
      }
    }
  }

  getEngagementStats(campaignId: string): {
    profileViewsScheduled: number;
    profileViewsCompleted: number;
    postLikesScheduled: number;
    postLikesCompleted: number;
    inMailsScheduled: number;
    inMailsSent: number;
    inMailsReplied: number;
    subsequencesActive: number;
    prospectsInSubsequence: number;
  } {
    const profileViews = Array.from(this.profileViews.values()).filter(a => a.campaignId === campaignId);
    const postLikes = Array.from(this.postLikes.values()).filter(a => a.campaignId === campaignId);
    const inMails = Array.from(this.inMails.values()).filter(a => a.campaignId === campaignId);
    const subsequences = Array.from(this.subsequences.values()).filter(s => s.campaignId === campaignId);
    const prospectsInSubsequence = Array.from(this.prospectStates.values())
      .filter(s => s.campaignId === campaignId && s.subsequenceId !== null);

    return {
      profileViewsScheduled: profileViews.length,
      profileViewsCompleted: profileViews.filter(a => a.status === 'completed').length,
      postLikesScheduled: postLikes.length,
      postLikesCompleted: postLikes.filter(a => a.status === 'completed').length,
      inMailsScheduled: inMails.length,
      inMailsSent: inMails.filter(a => a.status === 'sent').length,
      inMailsReplied: inMails.filter(a => a.status === 'replied').length,
      subsequencesActive: subsequences.filter(s => s.isActive).length,
      prospectsInSubsequence: prospectsInSubsequence.length,
    };
  }

  getDefaultNotAcceptedSubsequence(): Omit<SubsequenceStep, 'id'>[] {
    return [
      {
        order: 1,
        actionType: 'profile_view',
        delayDays: 0,
        isActive: true,
      },
      {
        order: 2,
        actionType: 'post_like',
        delayDays: 2,
        isActive: true,
      },
      {
        order: 3,
        actionType: 'profile_view',
        delayDays: 5,
        isActive: true,
      },
      {
        order: 4,
        actionType: 'inmail',
        delayDays: 7,
        inMailSubject: 'Quick question about {{company}}',
        messageTemplate: 'Hi {{firstName}}, I noticed we haven\'t connected yet. I\'d love to share how we\'re helping similar {{industry}} companies...',
        isActive: true,
      },
      {
        order: 5,
        actionType: 'withdraw_request',
        delayDays: 14,
        isActive: true,
      },
    ];
  }
}

export const linkedInAdvancedActionsEngine = new LinkedInAdvancedActionsEngine();
