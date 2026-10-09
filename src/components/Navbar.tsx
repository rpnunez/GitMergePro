import React from 'react';
import {
  GitPullRequest,
  GitMerge,
  Layers,
  Bot,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  LogIn,
  Github,
  ChevronDown
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Repository } from '../types/index.ts';

interface NavbarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  activeTab: 'prs' | 'pseudo' | 'issues' | 'chat' | 'settings';
  setActiveTab: (tab: 'prs' | 'pseudo' | 'issues' | 'chat' | 'settings') => void;
  repositories: Repository[];
  activeRepo: Repository | null;
  onSelectRepo: (repo: Repository) => void;
  isSyncing: boolean;
  onSync: () => void;
  lastSyncedText: string;
  safeCount: number;
  totalPrsCount: number;
  selectedPrCount: number;
  onOpenPseudoModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  onLogout,
  activeTab,
  setActiveTab,
  repositories,
  activeRepo,
  onSelectRepo,
  isSyncing,
  onSync,
  lastSyncedText,
  safeCount,
  totalPrsCount,
  selectedPrCount,
  onOpenPseudoModal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand & Repo Selector */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 shadow-lg shadow-teal-500/20">
              <GitMerge className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">GitMerge Pro</span>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  REAL-TIME
                </span>
              </div>
              <p className="text-[11px] text-slate-400">High-Velocity PR & CI Merger</p>
            </div>
          </div>

          {/* Active Repo Selector Dropdown */}
          {repositories.length > 0 && activeRepo && (
            <div className="relative group hidden md:block">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700 hover:bg-slate-800/80 transition-colors"
              >
                <Github className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400">{activeRepo.owner}/</span>
                <span className="font-semibold text-white">{activeRepo.repo}</span>
                <span className="text-[10px] rounded bg-slate-800 px-1.5 py-0.2 text-slate-400">
                  {activeRepo.defaultBranch}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              <div className="absolute left-0 mt-1 hidden w-64 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl group-hover:block z-50">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Connected Repositories
                </div>
                {repositories.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onSelectRepo(r)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      r.id === activeRepo.id
                        ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">
                      {r.owner}/{r.repo}
                    </span>
                    {r.id === activeRepo.id && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                  </button>
                ))}
                <div className="mt-1 border-t border-slate-800 pt-1">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  >
                    <Settings className="h-3 w-3" />
                    Manage Repositories
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('prs')}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              activeTab === 'prs'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <GitPullRequest className="h-4 w-4 text-emerald-400" />
            <span>PRs</span>
            {totalPrsCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-slate-950 px-2 py-0.5 text-[10px]">
                <span className="text-emerald-400 font-bold">{safeCount}</span>
                <span className="text-slate-500">/{totalPrsCount}</span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('pseudo')}
            className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              activeTab === 'pseudo'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4 text-cyan-400" />
            <span>Pseudo Builds</span>
            {selectedPrCount > 0 && (
              <span className="rounded-full bg-cyan-500/20 text-cyan-400 px-1.5 py-0.2 text-[10px] font-bold border border-cyan-500/30">
                {selectedPrCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('issues')}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              activeTab === 'issues'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">Issues</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Bot className="h-4 w-4 text-indigo-400" />
            <span className="hidden sm:inline">Gemini AI</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Settings className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </nav>

        {/* Actions & User State */}
        <div className="flex items-center gap-3">
          {/* Sync Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              title="Pull latest pull requests and issues from GitHub"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-300' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync GitHub'}</span>
            </button>
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500" title="Periodic background sync active">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>{lastSyncedText}</span>
            </div>
          </div>

          {/* User Profile */}
          {user ? (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="h-8 w-8 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                  {user.email ? user.email.slice(0, 2).toUpperCase() : 'ME'}
                </div>
              )}
              <div className="hidden xl:block text-left text-xs">
                <p className="font-medium text-slate-200 truncate max-w-[110px]">
                  {user.displayName || user.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-emerald-400">Connected</p>
              </div>
              <button
                onClick={onLogout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-rose-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors shadow-sm"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In with Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
