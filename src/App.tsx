import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from './lib/firebase.ts';
import {
  subscribeRepositories,
  subscribePullRequests,
  subscribeIssues,
  subscribePseudoBuilds,
  subscribeChatMessages,
  saveRepository,
  removeRepository,
  batchSavePullRequests,
  batchSaveIssues,
  updatePullRequest,
  savePseudoBuild,
  deletePseudoBuild,
  saveChatMessage,
  clearChatMessages,
  getUserSettings,
  saveUserSettings,
} from './lib/firestoreService.ts';
import { Repository, PullRequest, Issue, PseudoBuild, ChatMessage, UserSettings } from './types/index.ts';
import { Navbar } from './components/Navbar.tsx';
import { PullRequestsView } from './components/PullRequestsView.tsx';
import { RebaseConflictModal } from './components/RebaseConflictModal.tsx';
import { PseudoBuildView } from './components/PseudoBuildView.tsx';
import { IssuesView } from './components/IssuesView.tsx';
import { GeminiChatbot } from './components/GeminiChatbot.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AlertCircle, RefreshCw, Layers } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'prs' | 'pseudo' | 'issues' | 'chat' | 'settings'>('prs');

  // Database Data States
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [activeRepo, setActiveRepo] = useState<Repository | null>(null);
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pseudoBuilds, setPseudoBuilds] = useState<PseudoBuild[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Pseudo Build Tray (Selected PR IDs)
  const [selectedPrIds, setSelectedPrIds] = useState<Set<string>>(new Set());

  // Conflict Modal State
  const [rebaseModalPr, setRebaseModalPr] = useState<PullRequest | null>(null);

  // Gemini Chat Context from PR
  const [selectedPrForChat, setSelectedPrForChat] = useState<PullRequest | null>(null);

  // Sync state & Background timer
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());
  const [secondsUntilNextSync, setSecondsUntilNextSync] = useState(300); // 5 minutes default

  // Listen for Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  // When user is authenticated or demo mode, load settings & subscribe to repositories
  useEffect(() => {
    const currentUserId = user?.uid || 'demo-user';

    // Fetch user settings
    getUserSettings(currentUserId)
      .then((settings) => {
        if (settings) {
          setUserSettings(settings);
          setSecondsUntilNextSync(settings.syncIntervalMinutes * 60);
        } else {
          const defaultSettings: UserSettings = {
            id: currentUserId,
            userId: currentUserId,
            syncIntervalMinutes: 5,
            autoRebaseCollisions: true,
            updatedAt: new Date().toISOString(),
          };
          saveUserSettings(defaultSettings);
          setUserSettings(defaultSettings);
        }
      })
      .catch((err) => console.warn('Settings load notice:', err));

    // Subscribe to user repositories
    const unsubRepos = subscribeRepositories(currentUserId, (repos) => {
      setRepositories(repos);
      if (repos.length > 0) {
        // If active repo not set or deleted, select first
        setActiveRepo((prev) => {
          if (!prev || !repos.some((r) => r.id === prev.id)) {
            return repos[0];
          }
          return prev;
        });
      } else {
        // Seed default high-velocity demo repo
        const defaultRepo: Repository = {
          id: `repo-react-${Date.now()}`,
          userId: currentUserId,
          owner: 'facebook',
          repo: 'react',
          defaultBranch: 'main',
          syncIntervalMinutes: 5,
          lastSyncedAt: new Date().toISOString(),
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveRepository(defaultRepo).then(() => {
          syncRepositoryData(defaultRepo, currentUserId);
        });
      }
    });

    // Subscribe to chat messages
    const unsubChat = subscribeChatMessages(currentUserId, (msgs) => {
      setChatMessages(msgs);
    });

    return () => {
      unsubRepos();
      unsubChat();
    };
  }, [user]);

  // When active repository changes, subscribe to its PRs, issues, and pseudo builds
  useEffect(() => {
    if (!activeRepo) {
      setPulls([]);
      setIssues([]);
      setPseudoBuilds([]);
      return;
    }

    const currentUserId = user?.uid || 'demo-user';

    const unsubPrs = subscribePullRequests(currentUserId, activeRepo.id, (loadedPrs) => {
      setPulls(loadedPrs);
      // Auto-populate pseudo build selection if empty
      if (selectedPrIds.size === 0 && loadedPrs.length > 0) {
        const safeIds = loadedPrs.filter((p) => p.safeToMerge).slice(0, 3).map((p) => p.id);
        setSelectedPrIds(new Set(safeIds));
      }
    });

    const unsubIssues = subscribeIssues(currentUserId, activeRepo.id, (loadedIssues) => {
      setIssues(loadedIssues);
    });

    const unsubBuilds = subscribePseudoBuilds(currentUserId, activeRepo.id, (loadedBuilds) => {
      setPseudoBuilds(loadedBuilds);
    });

    return () => {
      unsubPrs();
      unsubIssues();
      unsubBuilds();
    };
  }, [activeRepo, user]);

  // Sync a single repository with GitHub
  const syncRepositoryData = useCallback(
    async (repoToSync: Repository, uid: string) => {
      setIsSyncing(true);
      try {
        const response = await fetch('/api/sync-github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: repoToSync.owner,
            repo: repoToSync.repo,
          }),
        });

        const data = await response.json();
        if (data.success) {
          const syncedPrs: PullRequest[] = (data.pulls || []).map((p: any, idx: number) => ({
            id: `pr-${repoToSync.id}-${p.number}`,
            userId: uid,
            repoId: repoToSync.id,
            number: p.number,
            title: p.title,
            author: p.author,
            authorAvatar: p.authorAvatar,
            headBranch: p.headBranch,
            baseBranch: p.baseBranch,
            status: p.status,
            ciStatus: p.ciStatus,
            staticAnalysisStatus: p.staticAnalysisStatus,
            hasConflicts: p.hasConflicts,
            conflictedFilesSummary: p.conflictedFilesSummary,
            safeToMerge: p.safeToMerge,
            mergeConfidenceScore: p.mergeConfidenceScore,
            automatedLabelsSummary: p.automatedLabelsSummary,
            updatedAt: p.updatedAt,
            createdAt: p.createdAt,
          }));

          const syncedIssues: Issue[] = (data.issues || []).map((iss: any) => ({
            id: `iss-${repoToSync.id}-${iss.number}`,
            userId: uid,
            repoId: repoToSync.id,
            number: iss.number,
            title: iss.title,
            author: iss.author,
            state: iss.state,
            commentsCount: iss.commentsCount,
            priorityScore: iss.priorityScore,
            automatedLabelsSummary: iss.automatedLabelsSummary,
            createdAt: iss.createdAt,
            updatedAt: iss.updatedAt,
          }));

          await batchSavePullRequests(uid, repoToSync.id, syncedPrs);
          await batchSaveIssues(uid, repoToSync.id, syncedIssues);
          setLastSyncedTime(new Date());
        }
      } catch (err) {
        console.error('Failed to sync repo:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  // Sync on-demand button handler
  const handleSyncCurrent = () => {
    if (!activeRepo) return;
    const currentUserId = user?.uid || 'demo-user';
    syncRepositoryData(activeRepo, currentUserId);
  };

  // Sync all repositories button handler
  const handleSyncAll = async () => {
    const currentUserId = user?.uid || 'demo-user';
    for (const r of repositories) {
      await syncRepositoryData(r, currentUserId);
    }
  };

  // Periodic Background Job Countdown & Execution
  useEffect(() => {
    const intervalSeconds = (userSettings?.syncIntervalMinutes || 5) * 60;
    const timer = setInterval(() => {
      setSecondsUntilNextSync((prev) => {
        if (prev <= 1) {
          // Trigger scheduled background sync
          if (activeRepo) {
            syncRepositoryData(activeRepo, user?.uid || 'demo-user');
          }
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRepo, userSettings, syncRepositoryData, user]);

  // Multi-PR selection handlers for Pseudo Build
  const handleToggleSelectPr = (prId: string) => {
    setSelectedPrIds((prev) => {
      const next = new Set(prev);
      if (next.has(prId)) next.delete(prId);
      else next.add(prId);
      return next;
    });
  };

  const handleSelectAllSafe = () => {
    const safeIds = pulls.filter((p) => p.safeToMerge).map((p) => p.id);
    setSelectedPrIds(new Set(safeIds));
  };

  const handleClearSelection = () => {
    setSelectedPrIds(new Set());
  };

  // Conflict Rebase Resolution Applier
  const handleApplyResolution = async (prId: string, updatedData: Partial<PullRequest>) => {
    await updatePullRequest(prId, updatedData);
    setRebaseModalPr(null);
  };

  // Chat Helpers
  const handleSendMessage = async (msg: { role: 'user' | 'assistant'; model: string; content: string }) => {
    const currentUserId = user?.uid || 'demo-user';
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUserId,
      role: msg.role,
      model: msg.model,
      content: msg.content,
      createdAt: new Date().toISOString(),
    };
    await saveChatMessage(newMsg);
  };

  const handleClearChatHistory = async () => {
    const currentUserId = user?.uid || 'demo-user';
    await clearChatMessages(currentUserId);
  };

  const handleAskGeminiAboutPr = (pr: PullRequest) => {
    setSelectedPrForChat(pr);
    setActiveTab('chat');
  };

  const handleAskGeminiAboutIssue = (iss: Issue) => {
    setActiveTab('chat');
  };

  // Add Repository
  const handleAddRepo = async (newRepoData: { owner: string; repo: string; defaultBranch: string; token?: string }) => {
    const currentUserId = user?.uid || 'demo-user';
    const newRepo: Repository = {
      id: `repo-${newRepoData.owner}-${newRepoData.repo}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      userId: currentUserId,
      owner: newRepoData.owner,
      repo: newRepoData.repo,
      defaultBranch: newRepoData.defaultBranch || 'main',
      syncIntervalMinutes: userSettings?.syncIntervalMinutes || 5,
      lastSyncedAt: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveRepository(newRepo);
    setActiveRepo(newRepo);
    await syncRepositoryData(newRepo, currentUserId);
  };

  // Remove Repository
  const handleRemoveRepo = async (repoId: string) => {
    await removeRepository(repoId);
  };

  // Save User Settings
  const handleSaveUserSettings = async (settings: { syncIntervalMinutes: number; autoRebaseCollisions: boolean }) => {
    const currentUserId = user?.uid || 'demo-user';
    const updated: UserSettings = {
      id: currentUserId,
      userId: currentUserId,
      syncIntervalMinutes: settings.syncIntervalMinutes,
      autoRebaseCollisions: settings.autoRebaseCollisions,
      updatedAt: new Date().toISOString(),
    };
    await saveUserSettings(updated);
    setUserSettings(updated);
    setSecondsUntilNextSync(settings.syncIntervalMinutes * 60);
  };

  // Human readable last sync text
  const lastSyncedText = useMemo(() => {
    const mins = Math.floor(secondsUntilNextSync / 60);
    const secs = secondsUntilNextSync % 60;
    return `Auto-sync in ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }, [secondsUntilNextSync]);

  const safeCount = useMemo(() => pulls.filter((p) => p.safeToMerge).length, [pulls]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        repositories={repositories}
        activeRepo={activeRepo}
        onSelectRepo={(r) => setActiveRepo(r)}
        isSyncing={isSyncing}
        onSync={handleSyncCurrent}
        lastSyncedText={lastSyncedText}
        safeCount={safeCount}
        totalPrsCount={pulls.length}
        selectedPrCount={selectedPrIds.size}
        onOpenPseudoModal={() => setActiveTab('pseudo')}
      />

      {/* Main View Body */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
        {/* Pull Requests Tab */}
        {activeTab === 'prs' && activeRepo && (
          <PullRequestsView
            pulls={pulls}
            repo={activeRepo}
            selectedPrIds={selectedPrIds}
            onToggleSelectPr={handleToggleSelectPr}
            onSelectAllSafe={handleSelectAllSafe}
            onClearSelection={handleClearSelection}
            onOpenRebaseModal={(pr) => setRebaseModalPr(pr)}
            onOpenPseudoModal={() => setActiveTab('pseudo')}
            onAskGeminiAboutPr={handleAskGeminiAboutPr}
          />
        )}

        {/* Pseudo Builds Tab */}
        {activeTab === 'pseudo' && activeRepo && (
          <PseudoBuildView
            pulls={pulls}
            repo={activeRepo}
            selectedPrIds={selectedPrIds}
            onToggleSelectPr={handleToggleSelectPr}
            savedBuilds={pseudoBuilds}
            onSaveBuild={savePseudoBuild}
            onDeleteBuild={deletePseudoBuild}
            userId={user?.uid || 'demo-user'}
          />
        )}

        {/* Issues Tab */}
        {activeTab === 'issues' && activeRepo && (
          <IssuesView
            issues={issues}
            repo={activeRepo}
            onAskGeminiAboutIssue={handleAskGeminiAboutIssue}
          />
        )}

        {/* Gemini AI Copilot Tab */}
        {activeTab === 'chat' && (
          <GeminiChatbot
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            onClearHistory={handleClearChatHistory}
            activeRepo={activeRepo}
            selectedPrForChat={selectedPrForChat}
            onClearPrContext={() => setSelectedPrForChat(null)}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsView
            repositories={repositories}
            onAddRepo={handleAddRepo}
            onRemoveRepo={handleRemoveRepo}
            userSettings={userSettings}
            onSaveUserSettings={handleSaveUserSettings}
            onSyncAll={handleSyncAll}
            isSyncing={isSyncing}
            userId={user?.uid || 'demo-user'}
          />
        )}
      </main>

      {/* Modals */}
      {rebaseModalPr && activeRepo && (
        <RebaseConflictModal
          pr={rebaseModalPr}
          repo={activeRepo}
          isOpen={!!rebaseModalPr}
          onClose={() => setRebaseModalPr(null)}
          onApplyResolution={handleApplyResolution}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={async () => {
          try {
            await loginWithGoogle();
          } catch (e) {
            console.error('Login error:', e);
          }
        }}
      />
    </div>
  );
}
