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

// Default initial demo repository for unauthenticated / first-time state
const INITIAL_DEMO_REPO: Repository = {
  id: 'repo-facebook-react',
  userId: 'demo',
  owner: 'facebook',
  repo: 'react',
  defaultBranch: 'main',
  syncIntervalMinutes: 5,
  lastSyncedAt: new Date().toISOString(),
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'prs' | 'pseudo' | 'issues' | 'chat' | 'settings'>('prs');

  // Repositories & Data States
  const [repositories, setRepositories] = useState<Repository[]>([INITIAL_DEMO_REPO]);
  const [activeRepo, setActiveRepo] = useState<Repository | null>(INITIAL_DEMO_REPO);
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
  const [secondsUntilNextSync, setSecondsUntilNextSync] = useState(300);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch or initialize data when user changes
  useEffect(() => {
    if (!authInitialized) return;

    if (!user) {
      // Unauthenticated demo mode: Keep local state only, do NOT attach Firestore listeners
      setRepositories([INITIAL_DEMO_REPO]);
      setActiveRepo(INITIAL_DEMO_REPO);
      // Fetch initial demo PRs via API into local state
      fetch('/api/sync-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: 'facebook', repo: 'react' }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.pulls) {
            const mappedPulls = data.pulls.map((p: any) => ({
              ...p,
              id: `demo-pr-${p.number}`,
              userId: 'demo',
              repoId: INITIAL_DEMO_REPO.id,
            }));
            setPulls(mappedPulls);
            const mappedIssues = (data.issues || []).map((iss: any) => ({
              ...iss,
              id: `demo-iss-${iss.number}`,
              userId: 'demo',
              repoId: INITIAL_DEMO_REPO.id,
            }));
            setIssues(mappedIssues);
          }
        })
        .catch((e) => console.warn('Demo sync notice:', e));
      return;
    }

    // Authenticated Mode: Use real user.uid with Firestore
    const currentUid = user.uid;

    // Load User Settings
    getUserSettings(currentUid)
      .then((settings) => {
        if (settings) {
          setUserSettings(settings);
          setSecondsUntilNextSync(settings.syncIntervalMinutes * 60);
        } else {
          const defaultSettings: UserSettings = {
            id: currentUid,
            userId: currentUid,
            syncIntervalMinutes: 5,
            autoRebaseCollisions: true,
            updatedAt: new Date().toISOString(),
          };
          saveUserSettings(defaultSettings).catch(console.error);
          setUserSettings(defaultSettings);
        }
      })
      .catch((err) => console.warn('Settings load notice:', err));

    // Subscribe to Repositories
    const unsubRepos = subscribeRepositories(currentUid, (loadedRepos) => {
      if (loadedRepos.length > 0) {
        setRepositories(loadedRepos);
        setActiveRepo((prev) => {
          if (!prev || !loadedRepos.some((r) => r.id === prev.id)) {
            return loadedRepos[0];
          }
          return prev;
        });
      } else {
        // Seed first user repository in Firestore
        const firstRepo: Repository = {
          id: `repo-react-${Date.now()}`,
          userId: currentUid,
          owner: 'facebook',
          repo: 'react',
          defaultBranch: 'main',
          syncIntervalMinutes: 5,
          lastSyncedAt: new Date().toISOString(),
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveRepository(firstRepo).then(() => {
          syncRepositoryData(firstRepo, currentUid);
        });
      }
    });

    // Subscribe to Chat Messages
    const unsubChat = subscribeChatMessages(currentUid, (msgs) => {
      setChatMessages(msgs);
    });

    return () => {
      unsubRepos();
      unsubChat();
    };
  }, [user, authInitialized]);

  // 3. When active repository changes in authenticated mode, attach sub-listeners
  useEffect(() => {
    if (!user || !activeRepo) return;

    const currentUid = user.uid;

    const unsubPrs = subscribePullRequests(currentUid, activeRepo.id, (loadedPrs) => {
      setPulls(loadedPrs);
      if (selectedPrIds.size === 0 && loadedPrs.length > 0) {
        const safeIds = loadedPrs.filter((p) => p.safeToMerge).slice(0, 3).map((p) => p.id);
        setSelectedPrIds(new Set(safeIds));
      }
    });

    const unsubIssues = subscribeIssues(currentUid, activeRepo.id, (loadedIssues) => {
      setIssues(loadedIssues);
    });

    const unsubBuilds = subscribePseudoBuilds(currentUid, activeRepo.id, (loadedBuilds) => {
      setPseudoBuilds(loadedBuilds);
    });

    return () => {
      unsubPrs();
      unsubIssues();
      unsubBuilds();
    };
  }, [user, activeRepo]);

  // 4. GitHub Sync Logic
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
          const syncedPrs: PullRequest[] = (data.pulls || []).map((p: any) => ({
            id: `pr-${repoToSync.id}-${p.number}`.replace(/[^a-zA-Z0-9._-]/g, '-'),
            userId: uid,
            repoId: repoToSync.id,
            number: Number(p.number),
            title: String(p.title || 'Untitled PR').slice(0, 500),
            author: String(p.author || 'contributor').slice(0, 120),
            authorAvatar: String(p.authorAvatar || '').slice(0, 500),
            headBranch: String(p.headBranch || 'patch').slice(0, 200),
            baseBranch: String(p.baseBranch || 'main').slice(0, 100),
            status: String(p.status || 'open').slice(0, 30),
            ciStatus: p.ciStatus || 'passing',
            staticAnalysisStatus: p.staticAnalysisStatus || 'clean',
            hasConflicts: Boolean(p.hasConflicts),
            conflictedFilesSummary: String(p.conflictedFilesSummary || '').slice(0, 1000),
            safeToMerge: Boolean(p.safeToMerge),
            mergeConfidenceScore: Number(p.mergeConfidenceScore || 0),
            automatedLabelsSummary: String(p.automatedLabelsSummary || '').slice(0, 500),
            updatedAt: p.updatedAt || new Date().toISOString(),
            createdAt: p.createdAt || new Date().toISOString(),
          }));

          const syncedIssues: Issue[] = (data.issues || []).map((iss: any) => ({
            id: `iss-${repoToSync.id}-${iss.number}`.replace(/[^a-zA-Z0-9._-]/g, '-'),
            userId: uid,
            repoId: repoToSync.id,
            number: Number(iss.number),
            title: String(iss.title || 'Issue').slice(0, 500),
            author: String(iss.author || 'dev').slice(0, 120),
            state: iss.state || 'open',
            commentsCount: Number(iss.commentsCount || 0),
            priorityScore: Number(iss.priorityScore || 50),
            automatedLabelsSummary: String(iss.automatedLabelsSummary || '').slice(0, 500),
            createdAt: iss.createdAt || new Date().toISOString(),
            updatedAt: iss.updatedAt || new Date().toISOString(),
          }));

          // Only save to Firestore if authenticated
          if (user && uid === user.uid) {
            await batchSavePullRequests(uid, repoToSync.id, syncedPrs);
            await batchSaveIssues(uid, repoToSync.id, syncedIssues);
          } else {
            setPulls(syncedPrs);
            setIssues(syncedIssues);
          }
        }
      } catch (err) {
        console.error('Failed to sync repo:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    [user]
  );

  // Sync on-demand button handler
  const handleSyncCurrent = () => {
    if (!activeRepo) return;
    const currentUid = user?.uid || 'demo';
    syncRepositoryData(activeRepo, currentUid);
  };

  // Sync all repositories button handler
  const handleSyncAll = async () => {
    const currentUid = user?.uid || 'demo';
    for (const r of repositories) {
      await syncRepositoryData(r, currentUid);
    }
  };

  // Periodic Background Job Countdown & Execution
  useEffect(() => {
    const intervalSeconds = (userSettings?.syncIntervalMinutes || 5) * 60;
    const timer = setInterval(() => {
      setSecondsUntilNextSync((prev) => {
        if (prev <= 1) {
          if (activeRepo) {
            syncRepositoryData(activeRepo, user?.uid || 'demo');
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
    if (user) {
      await updatePullRequest(prId, updatedData);
    } else {
      setPulls((prev) =>
        prev.map((p) => (p.id === prId ? { ...p, ...updatedData, updatedAt: new Date().toISOString() } : p))
      );
    }
    setRebaseModalPr(null);
  };

  // Chat Helpers
  const handleSendMessage = async (msg: { role: 'user' | 'assistant'; model: string; content: string }) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: user?.uid || 'demo',
      role: msg.role,
      model: msg.model,
      content: msg.content,
      createdAt: new Date().toISOString(),
    };

    if (user) {
      await saveChatMessage(newMsg);
    } else {
      setChatMessages((prev) => [...prev, newMsg]);
    }
  };

  const handleClearChatHistory = async () => {
    if (user) {
      await clearChatMessages(user.uid);
    } else {
      setChatMessages([]);
    }
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
    const sanitizedOwner = newRepoData.owner.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
    const sanitizedRepoName = newRepoData.repo.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
    const repoId = `repo-${sanitizedOwner}-${sanitizedRepoName}-${Date.now()}`;

    const newRepo: Repository = {
      id: repoId,
      userId: user?.uid || 'demo',
      owner: newRepoData.owner,
      repo: newRepoData.repo,
      defaultBranch: newRepoData.defaultBranch || 'main',
      syncIntervalMinutes: userSettings?.syncIntervalMinutes || 5,
      lastSyncedAt: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (user) {
      await saveRepository(newRepo);
    } else {
      setRepositories((prev) => [newRepo, ...prev]);
    }

    setActiveRepo(newRepo);
    await syncRepositoryData(newRepo, user?.uid || 'demo');
  };

  // Remove Repository
  const handleRemoveRepo = async (repoId: string) => {
    if (user) {
      await removeRepository(repoId);
    } else {
      setRepositories((prev) => prev.filter((r) => r.id !== repoId));
      if (activeRepo?.id === repoId) {
        setActiveRepo(repositories.find((r) => r.id !== repoId) || null);
      }
    }
  };

  // Save User Settings
  const handleSaveUserSettings = async (settings: { syncIntervalMinutes: number; autoRebaseCollisions: boolean }) => {
    const currentUid = user?.uid || 'demo';
    const updated: UserSettings = {
      id: currentUid,
      userId: currentUid,
      syncIntervalMinutes: settings.syncIntervalMinutes,
      autoRebaseCollisions: settings.autoRebaseCollisions,
      updatedAt: new Date().toISOString(),
    };

    if (user) {
      await saveUserSettings(updated);
    }
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
            onSaveBuild={async (b) => {
              if (user) {
                await savePseudoBuild(b);
              } else {
                setPseudoBuilds((prev) => [b, ...prev]);
              }
            }}
            onDeleteBuild={async (bId) => {
              if (user) {
                await deletePseudoBuild(bId);
              } else {
                setPseudoBuilds((prev) => prev.filter((b) => b.id !== bId));
              }
            }}
            userId={user?.uid || 'demo'}
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
            userId={user?.uid || 'demo'}
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
