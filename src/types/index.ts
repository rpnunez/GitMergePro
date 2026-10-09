export interface Repository {
  id: string;
  userId: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  syncIntervalMinutes?: number;
  lastSyncedAt?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequest {
  id: string;
  userId: string;
  repoId: string;
  number: number;
  title: string;
  author?: string;
  authorAvatar?: string;
  headBranch?: string;
  baseBranch?: string;
  status?: string;
  ciStatus: 'passing' | 'failing' | 'pending';
  staticAnalysisStatus: 'clean' | 'warnings' | 'errors';
  hasConflicts: boolean;
  conflictedFilesSummary?: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  safeToMerge: boolean;
  mergeConfidenceScore?: number;
  automatedLabelsSummary?: string;
  updatedAt: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  userId: string;
  repoId: string;
  number: number;
  title: string;
  author?: string;
  state: 'open' | 'closed';
  commentsCount?: number;
  priorityScore?: number;
  automatedLabelsSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PseudoBuild {
  id: string;
  userId: string;
  repoId: string;
  title: string;
  selectedPrNumbers: string;
  canMergeAll: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKING';
  summary: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  model: string;
  content: string;
  createdAt: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  syncIntervalMinutes: number;
  autoRebaseCollisions: boolean;
  theme?: 'dark' | 'light';
  updatedAt: string;
}
