export interface DmSplitState {
  active: boolean;
  alphaMembers: string[];
  betaMembers: string[];
  initiatedBy: string;
  initiatedAt: string;
  snapshotMessages: Array<{
    id: string;
    role: string;
    content: string;
    sender_user_id: string | null;
    sender_name: string;
    created_at: string;
  }>;
  alphaSummary: string | null;
  betaSummary: string | null;
  alphaName?: string;
  betaName?: string;
}

export type SplitTeam = 'alpha' | 'beta' | null;
