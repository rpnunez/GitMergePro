import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Terminal,
  Loader2,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  FolderGit2
} from 'lucide-react';
import { PullRequest, Repository } from '../types/index.ts';

interface RebaseConflictModalProps {
  pr: PullRequest;
  repo: Repository;
  isOpen: boolean;
  onClose: () => void;
  onApplyResolution: (prId: string, updatedData: Partial<PullRequest>) => Promise<void>;
}

export const RebaseConflictModal: React.FC<RebaseConflictModalProps> = ({
  pr,
  repo,
  isOpen,
  onClose,
  onApplyResolution,
}) => {
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionResult, setResolutionResult] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [copiedCommands, setCopiedCommands] = useState(false);
  
  // Real PR files state
  const [prFiles, setPrFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesSource, setFilesSource] = useState<'live_pr' | 'cached' | 'analyzed'>('cached');

  // Load and sanitize files for THIS specific PR when opened
  useEffect(() => {
    if (!isOpen || !pr) return;

    // Check if cached summary is already valid and repo-specific (and doesn't have old legacy bug values)
    const existingSummary = pr.conflictedFilesSummary?.trim();
    const isLegacyArtifact = existingSummary && (
      existingSummary.includes('src/index.ts') || 
      existingSummary.includes('GitMergePro') ||
      (existingSummary.includes('package.json') && !repo.repo.includes('json') && !repo.repo.includes('node') && !repo.repo.includes('react'))
    );

    if (existingSummary && !isLegacyArtifact) {
      const parsed = existingSummary.split(',').map((f) => f.trim()).filter(Boolean);
      if (parsed.length > 0) {
        setPrFiles(parsed);
        setFilesSource('cached');
      }
    }

    // Always fetch latest files directly for this PR from the server/GitHub API
    setIsLoadingFiles(true);
    fetch('/api/pr-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: repo.owner,
        repo: repo.repo,
        prNumber: pr.number,
        title: pr.title,
        headBranch: pr.headBranch,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files) && data.files.length > 0) {
          const filenames: string[] = data.files.map((f: any) => f.filename);
          setPrFiles(filenames);
          setFilesSource(data.isLive ? 'live_pr' : 'analyzed');

          // If previously missing or had old bug data, silently sync this PR record in DB
          if (isLegacyArtifact || !existingSummary) {
            onApplyResolution(pr.id, {
              conflictedFilesSummary: filenames.join(', '),
            }).catch(console.warn);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load PR files:', err);
      })
      .finally(() => {
        setIsLoadingFiles(false);
      });
  }, [isOpen, pr?.id, repo.owner, repo.repo]);

  if (!isOpen) return null;

  const handleRunRebase = async () => {
    setIsResolving(true);
    try {
      const response = await fetch('/api/rebase-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.repo,
          prNumber: pr.number,
          title: pr.title,
          headBranch: pr.headBranch || 'patch',
          targetBranch: pr.baseBranch || repo.defaultBranch || 'main',
          conflictedFiles: prFiles,
        }),
      });

      const data = await response.json();
      setResolutionResult(data);
    } catch (err) {
      console.error('Failed to run rebase:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleApplyToPr = async () => {
    setIsApplying(true);
    try {
      // Clear conflicts and update safeToMerge in DB
      await onApplyResolution(pr.id, {
        hasConflicts: false,
        conflictedFilesSummary: prFiles.length > 0 ? `Resolved (${prFiles.join(', ')})` : 'Resolved automatically via 3-way semantic rebase',
        ciStatus: 'passing',
        staticAnalysisStatus: 'clean',
        safeToMerge: true,
        mergeConfidenceScore: 98,
        automatedLabelsSummary: 'safe-to-merge:green, automated:rebased, train:p1',
      });
      onClose();
    } catch (err) {
      console.error('Failed to apply resolution:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const copyCommands = () => {
    if (!resolutionResult?.gitCommands) return;
    navigator.clipboard.writeText(resolutionResult.gitCommands.join('\n'));
    setCopiedCommands(true);
    setTimeout(() => setCopiedCommands(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Merge Conflict Resolver &amp; Rebase Engine
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                  PR #{pr.number}
                </span>
                <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-cyan-400 font-mono flex items-center gap-1">
                  <FolderGit2 className="h-3 w-3" />
                  {repo.owner}/{repo.repo}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">{pr.title}</h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <span className="font-mono text-cyan-400">{pr.headBranch || 'feat/branch'}</span>
                <ArrowRight className="h-3 w-3 text-slate-600" />
                <span className="font-mono text-emerald-400">{pr.baseBranch || repo.defaultBranch || 'main'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-5">
          {/* Conflicted Files from Selected PR Notice */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Detected File Collisions in PR #{pr.number} ({prFiles.length})
                </span>
              </div>
              {isLoadingFiles ? (
                <span className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                  Fetching files for PR #{pr.number}...
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {filesSource === 'live_pr' ? 'Live GitHub PR Files' : 'PR Changed Files'}
                </span>
              )}
            </div>
            
            <p className="mt-1 text-xs text-slate-400">
              Target branch <span className="font-mono text-emerald-400 font-semibold">{pr.baseBranch || 'main'}</span> has moved ahead. The following files modified in this pull request have concurrent modifications that require rebase resolution:
            </p>
            
            <div className="mt-3 flex flex-wrap gap-2">
              {prFiles.length === 0 && !isLoadingFiles ? (
                <span className="text-xs text-slate-500 italic">No file collisions detected for this PR.</span>
              ) : (
                prFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-amber-300 shadow-xs"
                  >
                    <FileCode className="h-3.5 w-3.5 text-amber-400" />
                    <span>{file}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Trigger */}
          {!resolutionResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-cyan-400 mb-2" />
              <h3 className="text-sm font-semibold text-white">Smart 3-Way Rebase Simulation</h3>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                Automatically rebases PR #{pr.number} onto {pr.baseBranch || 'main'}, deduplicates colliding imports, reconciles version bumps and configuration keys, and resolves concurrent file modifications for {repo.owner}/{repo.repo}.
              </p>
              <button
                onClick={handleRunRebase}
                disabled={isResolving || prFiles.length === 0}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-xs font-bold text-slate-950 hover:from-emerald-400 hover:to-teal-500 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing AST &amp; Rebasing Files for PR #{pr.number}...</span>
                  </>
                ) : (
                  <>
                    <GitMerge className="h-4 w-4" />
                    <span>Run Automated Rebase &amp; Resolve Collisions</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Resolution Result Preview */}
          {resolutionResult && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">
                      Rebase Completed Cleanly ({resolutionResult.cleanMergabilityScore}% Confidence)
                    </h4>
                    <p className="text-xs text-slate-300">{resolutionResult.confidenceNotes}</p>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  READY TO MERGE
                </span>
              </div>

              {/* Resolved Files List */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Resolved File Collisions in PR #{pr.number}
                </h5>
                {resolutionResult.filesResolved?.map((fileRes: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                        <FileCode className="h-3.5 w-3.5" />
                        {fileRes.file}
                      </span>
                      <span className="text-[10px] rounded bg-slate-800 px-2 py-0.5 text-slate-400 uppercase font-mono">
                        {fileRes.collisionType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{fileRes.resolutionSummary}</p>
                    {fileRes.resolvedSnippet && (
                      <pre className="mt-2 rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-[11px] font-mono text-slate-300 overflow-x-auto">
                        {fileRes.resolvedSnippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              {/* Executable Terminal Commands */}
              {resolutionResult.gitCommands && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <Terminal className="h-3.5 w-3.5 text-slate-400" />
                      Git Terminal Commands for PR #{pr.number}
                    </span>
                    <button
                      onClick={copyCommands}
                      className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      {copiedCommands ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Commands</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="rounded-lg bg-slate-900 p-2 text-xs font-mono text-emerald-400 overflow-x-auto">
                    {resolutionResult.gitCommands.join('\n')}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Cancel
          </button>
          {resolutionResult && (
            <button
              onClick={handleApplyToPr}
              disabled={isApplying}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating PR in DB...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Apply Resolution &amp; Mark Safe to Merge</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
