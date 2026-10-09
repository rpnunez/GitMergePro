import React, { useState } from 'react';
import {
  Settings,
  Github,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders
} from 'lucide-react';
import { Repository, UserSettings } from '../types/index.ts';

interface SettingsViewProps {
  repositories: Repository[];
  onAddRepo: (repo: { owner: string; repo: string; defaultBranch: string; token?: string }) => Promise<void>;
  onRemoveRepo: (repoId: string) => Promise<void>;
  userSettings: UserSettings | null;
  onSaveUserSettings: (settings: { syncIntervalMinutes: number; autoRebaseCollisions: boolean }) => Promise<void>;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
  userId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  repositories,
  onAddRepo,
  onRemoveRepo,
  userSettings,
  onSaveUserSettings,
  onSyncAll,
  isSyncing,
  userId,
}) => {
  const [newOwner, setNewOwner] = useState('');
  const [newRepo, setNewRepo] = useState('');
  const [newBranch, setNewBranch] = useState('main');
  const [newToken, setNewToken] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [syncInterval, setSyncInterval] = useState<number>(userSettings?.syncIntervalMinutes || 5);
  const [autoRebase, setAutoRebase] = useState<boolean>(userSettings?.autoRebaseCollisions ?? true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwner.trim() || !newRepo.trim()) {
      setAddError('Owner and repository name are required.');
      return;
    }
    setAddError(null);
    setIsAdding(true);

    try {
      await onAddRepo({
        owner: newOwner.trim(),
        repo: newRepo.trim(),
        defaultBranch: newBranch.trim() || 'main',
        token: newToken.trim() || undefined,
      });
      setNewOwner('');
      setNewRepo('');
      setNewBranch('main');
      setNewToken('');
    } catch (err: any) {
      setAddError(err?.message || 'Failed to connect repository.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await onSaveUserSettings({
        syncIntervalMinutes: syncInterval,
        autoRebaseCollisions: autoRebase,
      });
      setSettingsSavedMessage(true);
      setTimeout(() => setSettingsSavedMessage(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-200">
                <Sliders className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Repository &amp; Sync Engine Settings</h2>
                <p className="text-xs text-slate-400">
                  Configure connected GitHub repositories, periodic background synchronization frequency, and auto-rebase policies.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onSyncAll}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing All Repos...' : 'Sync All Repositories Now'}</span>
          </button>
        </div>
      </div>

      {/* Connected Repositories Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Github className="h-4 w-4 text-slate-400" />
              <span>Connected GitHub Repositories ({repositories.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Track pull requests, CI status, and issues across multiple repositories simultaneously.
            </p>
          </div>
        </div>

        {/* Existing Repos List */}
        <div className="space-y-3">
          {repositories.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-xs text-slate-500">
              No repositories connected yet. Add one below.
            </div>
          ) : (
            repositories.map((repo) => (
              <div
                key={repo.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                    <Github className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {repo.owner}/{repo.repo}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-400">
                        {repo.defaultBranch}
                      </span>
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20">
                        ACTIVE
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span>Last Synced: {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleTimeString() : 'Pending'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRemoveRepo(repo.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                    title="Disconnect repository"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Connect New Repo Form */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-5 mt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-400" />
            <span>Connect a New Repository</span>
          </h4>

          {addError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Owner / Organization
              </label>
              <input
                type="text"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="e.g. facebook, vercel, my-org"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Repository Name
              </label>
              <input
                type="text"
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="e.g. react, next.js, my-app"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Default Target Branch
              </label>
              <input
                type="text"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder="main or master"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                GitHub Personal Access Token (Optional, for private repos or high rate limits)
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="password"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (stored securely or skipped for public repos)"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-3 flex justify-end mt-2">
              <button
                type="submit"
                disabled={isAdding}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting &amp; Fetching PRs...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Connect Repository &amp; Pull Data</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sync Cadence & Automation Settings */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            <span>Scheduled Background Job &amp; Sync Frequency</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how often the background job automatically queries GitHub for new PRs, CI changes, and conflict checks.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div>
              <h4 className="text-xs font-bold text-white">Periodic Background Sync Frequency</h4>
              <p className="text-[11px] text-slate-400">
                Scheduled runner interval to fetch PR status and Actions test results.
              </p>
            </div>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(Number(e.target.value))}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value={1}>Every 1 Minute (High-Velocity Hot Queue)</option>
              <option value={5}>Every 5 Minutes (Recommended)</option>
              <option value={15}>Every 15 Minutes</option>
              <option value={30}>Every 30 Minutes</option>
              <option value={60}>Every 1 Hour</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div>
              <h4 className="text-xs font-bold text-white">Automated AST &amp; Import Collision Auto-Rebase</h4>
              <p className="text-[11px] text-slate-400">
                Allow the conflict engine to auto-reconcile import blocks and package version bumps on rebase.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoRebase}
                onChange={(e) => setAutoRebase(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          {settingsSavedMessage && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Settings saved to database!</span>
            </span>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {isSavingSettings ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Sync Settings</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
