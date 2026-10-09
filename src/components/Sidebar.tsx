import React from 'react';
import {
  X,
  GitPullRequest,
  Layers,
  AlertCircle,
  Bot,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { Repository } from '../types/index.ts';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'prs' | 'pseudo' | 'issues' | 'chat' | 'settings';
  setActiveTab: (tab: 'prs' | 'pseudo' | 'issues' | 'chat' | 'settings') => void;
  safeCount: number;
  totalPrsCount: number;
  selectedPrCount: number;
  isSyncing: boolean;
  onSync: () => void;
  lastSyncedText: string;
  activeRepo: Repository | null;
  theme: 'dark' | 'light';
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  safeCount,
  totalPrsCount,
  selectedPrCount,
  isSyncing,
  onSync,
  lastSyncedText,
  activeRepo,
  theme,
}) => {
  if (!isOpen) return null;

  const handleNavClick = (tab: 'prs' | 'pseudo' | 'issues' | 'chat' | 'settings') => {
    setActiveTab(tab);
    // On small mobile screens, auto-close drawer after navigation
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose();
    }
  };

  const isLight = theme === 'light';

  return (
    <>
      {/* Backdrop overlay on mobile screens */}
      <div
        className="fixed inset-0 top-16 bg-slate-950/60 backdrop-blur-xs z-30 md:hidden transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Responsive Sidebar: in-flow flex column on desktop (>= md), drawer overlay on mobile (< md) */}
      <aside
        className={`
          fixed inset-y-16 left-0 z-40 w-64
          md:static md:inset-auto md:z-auto md:w-64 md:shrink-0
          border-r transition-all duration-200
          ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800 shadow-xl md:shadow-none'
              : 'bg-slate-950/95 border-slate-800 text-slate-100 shadow-2xl md:shadow-none backdrop-blur-md'
          }
          p-4 flex flex-col justify-between
          min-h-[calc(100vh-4rem)]
          overflow-y-auto
        `}
        aria-label="Navigation sidebar"
      >
        <div className="space-y-4">
          <div
            className={`flex items-center justify-between px-2 pb-2 border-b ${
              isLight ? 'border-slate-200' : 'border-slate-800/80'
            }`}
          >
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Navigation Menu
            </span>
            <button
              onClick={onClose}
              className={`p-1 transition-colors cursor-pointer ${
                isLight
                  ? 'text-slate-400 hover:text-slate-700'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Collapse menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="space-y-1">
            {/* PRs Item */}
            <button
              onClick={() => handleNavClick('prs')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'prs'
                  ? isLight
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-xs font-semibold'
                    : 'bg-slate-800 text-white shadow-sm border border-slate-700/60 font-semibold'
                  : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <GitPullRequest className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Pull Requests</span>
              </div>
              {totalPrsCount > 0 && (
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                    isLight ? 'bg-slate-200/80' : 'bg-slate-900'
                  }`}
                >
                  <span className="text-emerald-500 font-bold">{safeCount}</span>
                  <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>
                    /{totalPrsCount}
                  </span>
                </span>
              )}
            </button>

            {/* Pseudo Builds Item */}
            <button
              onClick={() => handleNavClick('pseudo')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'pseudo'
                  ? isLight
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-xs font-semibold'
                    : 'bg-slate-800 text-white shadow-sm border border-slate-700/60 font-semibold'
                  : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-cyan-500 shrink-0" />
                <span>Pseudo Builds</span>
              </div>
              {selectedPrCount > 0 && (
                <span className="rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.2 text-[10px] font-bold border border-cyan-500/30">
                  {selectedPrCount}
                </span>
              )}
            </button>

            {/* Issues Item */}
            <button
              onClick={() => handleNavClick('issues')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'issues'
                  ? isLight
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-xs font-semibold'
                    : 'bg-slate-800 text-white shadow-sm border border-slate-700/60 font-semibold'
                  : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Issues &amp; Triage</span>
              </div>
            </button>

            {/* Gemini AI Copilot Item */}
            <button
              onClick={() => handleNavClick('chat')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? isLight
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-xs font-semibold'
                    : 'bg-slate-800 text-white shadow-sm border border-slate-700/60 font-semibold'
                  : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bot className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>Gemini AI Copilot</span>
              </div>
            </button>

            {/* Settings Item */}
            <button
              onClick={() => handleNavClick('settings')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? isLight
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-xs font-semibold'
                    : 'bg-slate-800 text-white shadow-sm border border-slate-700/60 font-semibold'
                  : isLight
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className={`h-4 w-4 shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} />
                <span>Settings &amp; Theme</span>
              </div>
            </button>

            {/* Sync GitHub Item */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 ${
                isLight
                  ? 'text-emerald-700 hover:bg-emerald-50'
                  : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync GitHub'}</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Bottom Drawer Stats & Last Synced */}
        <div
          className={`border-t pt-3 text-[11px] space-y-1 ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>Sync status:</span>
            <span className={`font-mono ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              {lastSyncedText}
            </span>
          </div>
          {activeRepo && (
            <div className="flex items-center justify-between">
              <span>Repository:</span>
              <span
                className={`font-mono truncate max-w-[130px] ${
                  isLight ? 'text-slate-700 font-semibold' : 'text-slate-300'
                }`}
                title={`${activeRepo.owner}/${activeRepo.repo}`}
              >
                {activeRepo.owner}/{activeRepo.repo}
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
