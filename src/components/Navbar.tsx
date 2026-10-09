import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  GitPullRequest,
  Settings,
  RefreshCw,
  Sun,
  Moon,
  Github,
  CheckCircle2,
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
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  onLogout,
  setActiveTab,
  repositories,
  activeRepo,
  onSelectRepo,
  isSyncing,
  onSync,
  theme,
  onToggleTheme,
  isMenuOpen,
  onToggleMenu,
}) => {
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const isLight = theme === 'light';

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutside = () => setShowRepoDropdown(false);
    if (showRepoDropdown) {
      window.addEventListener('click', handleOutside);
    }
    return () => window.removeEventListener('click', handleOutside);
  }, [showRepoDropdown]);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors ${
        isLight
          ? 'border-slate-200 bg-white/95 text-slate-900 shadow-xs'
          : 'border-slate-800 bg-slate-950/90 text-slate-100'
      }`}
    >
      <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6">
        {/* Left: Hamburger Button & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMenu}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              isLight
                ? 'border-slate-300 bg-slate-100 text-slate-700 hover:text-slate-950 hover:bg-slate-200'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700'
            }`}
            aria-label="Toggle navigation menu"
            title={isMenuOpen ? 'Hide Menu' : 'Show Menu'}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Brand Logo without cluttered text & without Real-time badge */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 shadow-md shadow-teal-500/20">
              <GitPullRequest className="h-5 w-5 text-white" />
            </div>
            <span
              className={`font-bold tracking-tight text-base ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              GitMerge Pro
            </span>
          </div>

          {/* Active Repo Selector Dropdown */}
          {repositories.length > 0 && activeRepo && (
            <div
              className="relative hidden sm:block ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowRepoDropdown(!showRepoDropdown)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  isLight
                    ? 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                    : 'border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <Github className={`h-3.5 w-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{activeRepo.owner}/</span>
                <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {activeRepo.repo}
                </span>
                <ChevronDown className={`h-3 w-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              </button>

              {showRepoDropdown && (
                <div
                  className={`absolute left-0 mt-1 w-64 rounded-xl border p-1.5 shadow-2xl z-50 animate-in fade-in duration-100 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-900'
                      : 'border-slate-800 bg-slate-900 text-slate-100'
                  }`}
                >
                  <div
                    className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      isLight ? 'text-slate-400' : 'text-slate-400'
                    }`}
                  >
                    Connected Repositories
                  </div>
                  {repositories.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSelectRepo(r);
                        setShowRepoDropdown(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                        r.id === activeRepo.id
                          ? isLight
                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                            : 'bg-emerald-500/10 text-emerald-400 font-medium'
                          : isLight
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">
                        {r.owner}/{r.repo}
                      </span>
                      {r.id === activeRepo.id && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                    </button>
                  ))}
                  <div
                    className={`mt-1 border-t pt-1 ${
                      isLight ? 'border-slate-200' : 'border-slate-800'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setShowRepoDropdown(false);
                      }}
                      className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer ${
                        isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Settings className="h-3 w-3" />
                      Manage Repositories
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Theme Toggle, Sync Action & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dark / Light Mode Switch */}
          <button
            onClick={onToggleTheme}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              isLight
                ? 'border-slate-300 bg-slate-100 text-slate-700 hover:text-slate-950 hover:bg-slate-200'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700'
            }`}
            title={`Switch to ${isLight ? 'Dark' : 'Light'} mode`}
            aria-label="Toggle dark/light theme"
          >
            {isLight ? (
              <Moon className="h-4 w-4 text-cyan-500" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </button>

          {/* Sync GitHub Action */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer ${
              isLight
                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            }`}
            title="Pull latest pull requests and issues from GitHub"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* User Profile / Login */}
          {user ? (
            <div
              className={`flex items-center gap-2 border-l pl-2 sm:pl-3 ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className={`h-8 w-8 rounded-full border object-cover ${
                    isLight ? 'border-slate-300' : 'border-slate-700'
                  }`}
                />
              ) : (
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {user.email ? user.email.slice(0, 2).toUpperCase() : 'ME'}
                </div>
              )}
              <button
                onClick={onLogout}
                className="rounded-lg p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                title="Sign out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors shadow-sm cursor-pointer"
            >
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
