import React, { useState, useMemo } from 'react';
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  GitMerge,
  Search,
  Filter,
  Layers,
  Sparkles,
  Bot,
  ExternalLink,
  ShieldCheck,
  Tag,
  ArrowRight,
  ChevronRight,
  Code2,
  CheckSquare,
  Square,
  Plus,
  X,
  Loader2,
  Check,
  BarChart2,
  BarChart3,
  SlidersHorizontal
} from 'lucide-react';
import { PullRequest, Repository } from '../types/index.ts';

interface PullRequestsViewProps {
  pulls: PullRequest[];
  repo: Repository;
  selectedPrIds: Set<string>;
  onToggleSelectPr: (prId: string) => void;
  onSelectAllSafe: () => void;
  onClearSelection: () => void;
  onOpenRebaseModal: (pr: PullRequest) => void;
  onOpenPseudoModal: () => void;
  onAskGeminiAboutPr: (pr: PullRequest) => void;
  onBulkAddLabel?: (prIds: string[], label: string) => Promise<void>;
  onBulkClosePrs?: (prIds: string[]) => Promise<void>;
  onBulkRebaseAll?: (prIds: string[]) => Promise<void>;
}

export const PullRequestsView: React.FC<PullRequestsViewProps> = ({
  pulls,
  repo,
  selectedPrIds,
  onToggleSelectPr,
  onSelectAllSafe,
  onClearSelection,
  onOpenRebaseModal,
  onOpenPseudoModal,
  onAskGeminiAboutPr,
  onBulkAddLabel,
  onBulkClosePrs,
  onBulkRebaseAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'safe' | 'ci_fail' | 'conflicts' | 'static_warn'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'conflict_asc' | 'conflict_desc'>('recent');
  const [expandedPrId, setExpandedPrId] = useState<string | null>(null);

  // Bulk Action States
  const [showLabelPopover, setShowLabelPopover] = useState(false);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [isPerformingBulkAction, setIsPerformingBulkAction] = useState(false);
  const [bulkActionFeedback, setBulkActionFeedback] = useState<string | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Compute conflict complexity based on number of impacted files
  const getConflictComplexity = (pr: PullRequest) => {
    if (!pr.hasConflicts) {
      return {
        fileCount: 0,
        severity: 'none' as const,
        label: 'Clean',
        badgeColor: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
        barColor: 'bg-emerald-400',
        barsFilled: 0,
        estimatedTime: 'Ready',
        description: 'Zero file collisions against target branch',
      };
    }

    const files = pr.conflictedFilesSummary
      ? pr.conflictedFilesSummary.split(',').filter(Boolean).map((s) => s.trim())
      : ['src/index.ts'];
    const count = files.length || 1;

    if (count === 1) {
      return {
        fileCount: 1,
        severity: 'low' as const,
        label: 'Minor',
        badgeColor: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
        barColor: 'bg-yellow-400',
        barsFilled: 1,
        estimatedTime: '~2m rebase',
        description: '1 file impacted — quick AST & imports resolution',
      };
    } else if (count === 2) {
      return {
        fileCount: 2,
        severity: 'medium' as const,
        label: 'Moderate',
        badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        barColor: 'bg-amber-400',
        barsFilled: 2,
        estimatedTime: '~5m rebase',
        description: '2 files impacted — exports or dependencies overlap',
      };
    } else if (count === 3) {
      return {
        fileCount: 3,
        severity: 'high' as const,
        label: 'Substantial',
        badgeColor: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
        barColor: 'bg-orange-500',
        barsFilled: 3,
        estimatedTime: '~10m rebase',
        description: '3 files impacted — multi-module overlap',
      };
    } else {
      return {
        fileCount: count,
        severity: 'critical' as const,
        label: 'Complex',
        badgeColor: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
        barColor: 'bg-rose-500',
        barsFilled: 4,
        estimatedTime: '~15m+ review',
        description: `${count} files impacted — high complexity structural collision`,
      };
    }
  };

  const selectedCount = selectedPrIds.size;
  const selectedList = useMemo(() => pulls.filter((p) => selectedPrIds.has(p.id)), [pulls, selectedPrIds]);
  const conflictedSelectedCount = useMemo(() => selectedList.filter((p) => p.hasConflicts).length, [selectedList]);

  const predefinedLabels = [
    'safe-to-merge:green',
    'fast-track',
    'approved-for-train',
    'blocked:needs-qa',
    'p0-critical',
    'needs-docs',
  ];

  const handleApplyBulkLabel = async (label: string) => {
    if (!label.trim() || !onBulkAddLabel) return;
    setIsPerformingBulkAction(true);
    try {
      await onBulkAddLabel(Array.from(selectedPrIds), label.trim());
      setBulkActionFeedback(`Added label "${label}" to ${selectedCount} PRs`);
      setShowLabelPopover(false);
      setCustomLabelInput('');
      setTimeout(() => setBulkActionFeedback(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  const handleApplyBulkRebase = async () => {
    if (!onBulkRebaseAll) return;
    setIsPerformingBulkAction(true);
    try {
      await onBulkRebaseAll(Array.from(selectedPrIds));
      setBulkActionFeedback(`Rebased and resolved collisions for ${selectedCount} PRs`);
      setTimeout(() => setBulkActionFeedback(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  const handleApplyBulkClose = async () => {
    if (!onBulkClosePrs) return;
    setIsPerformingBulkAction(true);
    try {
      await onBulkClosePrs(Array.from(selectedPrIds));
      setBulkActionFeedback(`Closed ${selectedCount} PRs`);
      setShowConfirmClose(false);
      setTimeout(() => setBulkActionFeedback(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  // Statistics
  const safePulls = useMemo(() => pulls.filter((p) => p.safeToMerge), [pulls]);
  const ciFailingPulls = useMemo(() => pulls.filter((p) => p.ciStatus === 'failing'), [pulls]);
  const conflictedPulls = useMemo(() => pulls.filter((p) => p.hasConflicts), [pulls]);
  const staticWarningPulls = useMemo(
    () => pulls.filter((p) => p.staticAnalysisStatus === 'warnings' || p.staticAnalysisStatus === 'errors'),
    [pulls]
  );

  // Filtered list
  const filteredPulls = useMemo(() => {
    const list = pulls.filter((p) => {
      // Type filter
      if (filterType === 'safe' && !p.safeToMerge) return false;
      if (filterType === 'ci_fail' && p.ciStatus !== 'failing') return false;
      if (filterType === 'conflicts' && !p.hasConflicts) return false;
      if (filterType === 'static_warn' && p.staticAnalysisStatus === 'clean') return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(query);
        const matchAuthor = p.author?.toLowerCase().includes(query);
        const matchNumber = String(p.number).includes(query);
        const matchLabels = p.automatedLabelsSummary?.toLowerCase().includes(query);
        return matchTitle || matchAuthor || matchNumber || matchLabels;
      }
      return true;
    });

    // Sort by selected criteria
    if (sortBy === 'conflict_asc') {
      list.sort((a, b) => {
        const countA = getConflictComplexity(a).fileCount;
        const countB = getConflictComplexity(b).fileCount;
        if (countA === 0 && countB > 0) return 1;
        if (countB === 0 && countA > 0) return -1;
        return countA - countB;
      });
    } else if (sortBy === 'conflict_desc') {
      list.sort((a, b) => {
        const countA = getConflictComplexity(a).fileCount;
        const countB = getConflictComplexity(b).fileCount;
        return countB - countA;
      });
    } else {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return list;
  }, [pulls, filterType, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Velocity Header & Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total PRs */}
        <div
          onClick={() => setFilterType('all')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'all'
              ? 'border-slate-700 bg-slate-900 shadow-md ring-1 ring-slate-700'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tracked PRs</span>
            <GitPullRequest className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{pulls.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Live integration queue</div>
        </div>

        {/* Safe to Merge */}
        <div
          onClick={() => setFilterType('safe')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'safe'
              ? 'border-emerald-500/50 bg-emerald-950/30 shadow-md ring-1 ring-emerald-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Safe to Merge</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">{safePulls.length}</div>
          <div className="mt-1 text-[11px] text-emerald-500/80">CI Green &amp; No Conflicts</div>
        </div>

        {/* CI Failures */}
        <div
          onClick={() => setFilterType('ci_fail')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'ci_fail'
              ? 'border-rose-500/50 bg-rose-950/30 shadow-md ring-1 ring-rose-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
            <span>CI Failures</span>
            <XCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-300">{ciFailingPulls.length}</div>
          <div className="mt-1 text-[11px] text-rose-500/80">GitHub Actions failed</div>
        </div>

        {/* Merge Conflicts */}
        <div
          onClick={() => setFilterType('conflicts')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'conflicts'
              ? 'border-amber-500/50 bg-amber-950/30 shadow-md ring-1 ring-amber-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Merge Conflicts</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">{conflictedPulls.length}</div>
          <div className="mt-1 text-[11px] text-amber-500/80">Auto-rebase available</div>
        </div>

        {/* Static Analysis Warnings */}
        <div
          onClick={() => setFilterType('static_warn')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all col-span-2 lg:col-span-1 ${
            filterType === 'static_warn'
              ? 'border-cyan-500/50 bg-cyan-950/30 shadow-md ring-1 ring-cyan-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-cyan-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-cyan-400 font-medium">
            <span>Static Analysis</span>
            <Code2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">{staticWarningPulls.length}</div>
          <div className="mt-1 text-[11px] text-cyan-500/80">Linter / Typecheck notice</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Pseudo Build Action */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, PR #, author, branch, or label..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAllSafe}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Select All Safe ({safePulls.length})</span>
            </button>
            {selectedPrIds.size > 0 && (
              <button
                onClick={onClearSelection}
                className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear ({selectedPrIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Sort and Pseudo Build Trigger */}
        <div className="flex items-center gap-3">
          {/* Conflict Complexity Sort Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300">
            <BarChart2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-500 text-[11px] hidden md:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              title="Sort PRs to prioritize conflict resolution"
            >
              <option value="recent" className="bg-slate-900 text-white">Most Recent</option>
              <option value="conflict_asc" className="bg-slate-900 text-white">Complexity: Lowest First (Quick Wins)</option>
              <option value="conflict_desc" className="bg-slate-900 text-white">Complexity: Highest First (Blockers)</option>
            </select>
          </div>

          <button
            onClick={onOpenPseudoModal}
            disabled={selectedPrIds.size === 0}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-lg ${
              selectedPrIds.size > 0
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-cyan-500/20 hover:from-cyan-400 hover:to-teal-400'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Simulate Pseudo Build ({selectedPrIds.size} Selected)</span>
          </button>
        </div>
      </div>

      {/* Pull Requests List */}
      <div className="space-y-3">
        {filteredPulls.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-12 text-center">
            <GitPullRequest className="mx-auto h-10 w-10 text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No pull requests match this filter</h3>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search criteria or switch to the "Tracked PRs" tab.
            </p>
          </div>
        ) : (
          filteredPulls.map((pr) => {
            const isSelected = selectedPrIds.has(pr.id);
            const isExpanded = expandedPrId === pr.id;
            const labels = pr.automatedLabelsSummary
              ? pr.automatedLabelsSummary.split(',').map((l) => l.trim())
              : [];
            const complexity = getConflictComplexity(pr);

            return (
              <div
                key={pr.id}
                className={`group rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-cyan-500/50 bg-slate-900/90 shadow-md ring-1 ring-cyan-500/30'
                    : pr.safeToMerge
                    ? 'border-slate-800 bg-slate-900/40 hover:border-emerald-500/40 hover:bg-slate-900/70'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Main Row */}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Checkbox, PR Number, Title, Author */}
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => onToggleSelectPr(pr.id)}
                      className="mt-1 sm:mt-0 p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      title={isSelected ? 'Remove from pseudo build' : 'Add to pseudo build'}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-cyan-400" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </button>

                    {/* Author Avatar */}
                    {pr.authorAvatar && (
                      <img
                        src={pr.authorAvatar}
                        alt={pr.author || 'Author'}
                        className="h-8 w-8 rounded-full border border-slate-700 object-cover shrink-0 hidden sm:block"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          #{pr.number}
                        </span>
                        <h3 className="font-semibold text-sm text-white truncate max-w-xl">
                          {pr.title}
                        </h3>
                        {/* Safe to Merge Badge */}
                        {pr.safeToMerge && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="h-3 w-3" />
                            SAFE TO MERGE
                          </span>
                        )}
                      </div>

                      {/* Branch and Meta Row */}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="text-slate-400 font-medium">by @{pr.author || 'contributor'}</span>
                        <span className="text-slate-600">•</span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-400">
                            {pr.headBranch || 'patch'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-600" />
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-400">
                            {pr.baseBranch || 'main'}
                          </span>
                        </div>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] text-slate-500">
                          Updated {new Date(pr.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Badges & Action CTAs */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                    {/* CI Status Pill */}
                    <div
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        pr.ciStatus === 'passing'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : pr.ciStatus === 'failing'
                          ? 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                          : 'border-slate-700 bg-slate-800 text-slate-300'
                      }`}
                      title={`GitHub Actions status: ${pr.ciStatus}`}
                    >
                      {pr.ciStatus === 'passing' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : pr.ciStatus === 'failing' ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 animate-spin" />
                      )}
                      <span className="capitalize">CI {pr.ciStatus}</span>
                    </div>

                    {/* Static Analysis Pill */}
                    <div
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        pr.staticAnalysisStatus === 'clean'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : pr.staticAnalysisStatus === 'warnings'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                          : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span className="capitalize">{pr.staticAnalysisStatus}</span>
                    </div>

                    {/* Conflict Complexity Severity Indicator & Rebase CTA */}
                    {pr.hasConflicts ? (
                      <div className="flex items-center gap-2">
                        {/* Mini-Bar Chart Stepped Visual Indicator */}
                        <div
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${complexity.badgeColor}`}
                          title={`${complexity.fileCount} file(s) collided. Severity: ${complexity.label} (${complexity.description})`}
                        >
                          {/* 4-Level Stepped Mini-Bar Chart */}
                          <div className="flex items-end gap-0.5 h-3.5" title={`Conflict Severity Level: ${complexity.barsFilled}/4`}>
                            <div
                              className={`w-1 rounded-xs transition-all ${
                                complexity.barsFilled >= 1 ? `h-2 ${complexity.barColor}` : 'h-1.5 bg-slate-800'
                              }`}
                            />
                            <div
                              className={`w-1 rounded-xs transition-all ${
                                complexity.barsFilled >= 2 ? `h-2.5 ${complexity.barColor}` : 'h-1.5 bg-slate-800'
                              }`}
                            />
                            <div
                              className={`w-1 rounded-xs transition-all ${
                                complexity.barsFilled >= 3 ? `h-3 ${complexity.barColor}` : 'h-1.5 bg-slate-800'
                              }`}
                            />
                            <div
                              className={`w-1 rounded-xs transition-all ${
                                complexity.barsFilled >= 4 ? `h-3.5 ${complexity.barColor}` : 'h-1.5 bg-slate-800'
                              }`}
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span>{complexity.fileCount} {complexity.fileCount === 1 ? 'file' : 'files'}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-black/40">
                              {complexity.severity}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => onOpenRebaseModal(pr)}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all shadow-sm"
                          title="Rebase onto main branch and auto-resolve collisions"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                          <span>Fix Merge Conflicts</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-400"
                        title="Zero merge conflicts against target branch"
                      >
                        {/* 4-Level Stepped Mini-Bar Chart (Zero Filled) */}
                        <div className="flex items-end gap-0.5 h-3.5 opacity-40">
                          <div className="w-1 h-1.5 rounded-xs bg-emerald-500/40" />
                          <div className="w-1 h-2 rounded-xs bg-emerald-500/40" />
                          <div className="w-1 h-2.5 rounded-xs bg-emerald-500/40" />
                          <div className="w-1 h-3 rounded-xs bg-emerald-500/40" />
                        </div>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Clean (0 files)</span>
                      </div>
                    )}

                    {/* Ask Gemini Button */}
                    <button
                      onClick={() => onAskGeminiAboutPr(pr)}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-colors"
                      title="Analyze this PR with Gemini AI"
                    >
                      <Bot className="h-4 w-4" />
                    </button>

                    {/* Expand Details Arrow */}
                    <button
                      onClick={() => setExpandedPrId(isExpanded ? null : pr.id)}
                      className="rounded-lg p-1 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/80 p-4 space-y-3 rounded-b-2xl animate-in fade-in duration-150">
                    {/* Automated Labels */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        Automated Prioritization Labels
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {labels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                              lbl.includes('safe') || lbl.includes('green')
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : lbl.includes('blocked') || lbl.includes('failure')
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                                : lbl.includes('conflict')
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border-slate-700 bg-slate-800 text-slate-300'
                            }`}
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Conflicted Files & Complexity Breakdown */}
                    {pr.hasConflicts && (
                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/10 pb-2.5">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                            <span className="text-xs font-bold text-amber-300">
                              Conflict Complexity Analysis: {complexity.label} ({complexity.fileCount} {complexity.fileCount === 1 ? 'file' : 'files'} collided)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Stepped Mini-Bar Chart (Enlarged in Drawer) */}
                            <div className="flex items-end gap-1 h-4 bg-slate-900/90 px-2 py-0.5 rounded-md border border-slate-800" title={`Severity: ${complexity.barsFilled}/4`}>
                              <div className={`w-1.5 rounded-xs ${complexity.barsFilled >= 1 ? `h-2.5 ${complexity.barColor}` : 'h-1.5 bg-slate-800'}`} />
                              <div className={`w-1.5 rounded-xs ${complexity.barsFilled >= 2 ? `h-3.5 ${complexity.barColor}` : 'h-1.5 bg-slate-800'}`} />
                              <div className={`w-1.5 rounded-xs ${complexity.barsFilled >= 3 ? `h-4.5 ${complexity.barColor}` : 'h-1.5 bg-slate-800'}`} />
                              <div className={`w-1.5 rounded-xs ${complexity.barsFilled >= 4 ? `h-5 ${complexity.barColor}` : 'h-1.5 bg-slate-800'}`} />
                            </div>
                            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {complexity.estimatedTime}
                            </span>
                          </div>
                        </div>

                        {/* Impacted Files Pills */}
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                            Impacted Files ({complexity.fileCount}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(pr.conflictedFilesSummary ? pr.conflictedFilesSummary.split(',').filter(Boolean) : ['src/index.ts']).map((file, i) => (
                              <span key={i} className="flex items-center gap-1 font-mono text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-amber-300">
                                <Code2 className="h-3 w-3 text-amber-400" />
                                {file.trim()}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Prioritization Recommendation */}
                        <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                          <BarChart3 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-white">Triage Priority: </span>
                            {complexity.fileCount === 1 ? (
                              <span className="text-emerald-300">Low complexity quick win. Prioritize resolving this PR early to unblock downstream dependent branches.</span>
                            ) : complexity.fileCount === 2 ? (
                              <span className="text-amber-300">Moderate complexity. Resolvable quickly with automated 3-way semantic rebase.</span>
                            ) : (
                              <span className="text-rose-300">Substantial collision across multiple architectural modules. Prioritize coordination with branch author.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CI Matrix Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <span className="text-slate-400 block text-[11px]">Test Suite (Jest/Vitest)</span>
                        <span className={`font-semibold ${pr.ciStatus === 'passing' ? 'text-emerald-400' : pr.ciStatus === 'failing' ? 'text-rose-400' : 'text-slate-300'}`}>
                          {pr.ciStatus === 'passing' ? '14/14 Suites Passed' : pr.ciStatus === 'failing' ? '2 Failures in Auth Worker' : 'In Progress'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <span className="text-slate-400 block text-[11px]">Static Linter &amp; Types</span>
                        <span className={`font-semibold ${pr.staticAnalysisStatus === 'clean' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {pr.staticAnalysisStatus === 'clean' ? '0 Type Errors, Strict OK' : '2 Cognitive Complexity Warnings'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <span className="text-slate-400 block text-[11px]">Merge Confidence Score</span>
                        <span className="font-semibold text-cyan-400">
                          {pr.mergeConfidenceScore || (pr.safeToMerge ? 95 : 40)}/100
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Floating Action Menu for Multiple Selected PRs */}
      {selectedCount >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="relative flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
            {/* Selection Counter */}
            <div className="flex items-center gap-1.5 rounded-xl bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-300 border border-cyan-500/25">
              <CheckSquare className="h-4 w-4" />
              <span>{selectedCount} PRs</span>
            </div>

            {/* Bulk Action: Add Label */}
            <div className="relative">
              <button
                onClick={() => setShowLabelPopover(!showLabelPopover)}
                disabled={isPerformingBulkAction}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  showLabelPopover
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
                title="Add a label to all selected PRs"
              >
                <Tag className="h-3.5 w-3.5 text-indigo-400" />
                <span>Add Label</span>
              </button>

              {/* Add Label Popover */}
              {showLabelPopover && (
                <div className="absolute bottom-full left-0 mb-3 w-72 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-2xl animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-indigo-400" />
                      Apply Label ({selectedCount} PRs)
                    </span>
                    <button
                      onClick={() => setShowLabelPopover(false)}
                      className="text-slate-500 hover:text-white p-0.5 rounded"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Predefined Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {predefinedLabels.map((lbl) => (
                      <button
                        key={lbl}
                        onClick={() => handleApplyBulkLabel(lbl)}
                        disabled={isPerformingBulkAction}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                      >
                        +{lbl}
                      </button>
                    ))}
                  </div>

                  {/* Custom Label Input */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                    <input
                      type="text"
                      value={customLabelInput}
                      onChange={(e) => setCustomLabelInput(e.target.value)}
                      placeholder="Custom label..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyBulkLabel(customLabelInput);
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleApplyBulkLabel(customLabelInput)}
                      disabled={!customLabelInput.trim() || isPerformingBulkAction}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Action: Rebase All */}
            <button
              onClick={handleApplyBulkRebase}
              disabled={isPerformingBulkAction}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-all shadow-sm disabled:opacity-50"
              title={
                conflictedSelectedCount > 0
                  ? `Rebase all and auto-resolve ${conflictedSelectedCount} conflicted PRs`
                  : 'Rebase all selected PRs onto target branch'
              }
            >
              <GitMerge className="h-3.5 w-3.5 text-amber-400" />
              <span>Rebase All</span>
              {conflictedSelectedCount > 0 && (
                <span className="rounded-full bg-amber-500/30 px-1.5 py-0.2 text-[10px] font-bold text-amber-200">
                  {conflictedSelectedCount}
                </span>
              )}
            </button>

            {/* Bulk Action: Close PRs */}
            <button
              onClick={() => setShowConfirmClose(true)}
              disabled={isPerformingBulkAction}
              className="flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-all shadow-sm disabled:opacity-50"
              title="Close all selected pull requests"
            >
              <XCircle className="h-3.5 w-3.5 text-rose-400" />
              <span>Close PRs</span>
            </button>

            {/* Launch Pseudo Build */}
            <button
              onClick={onOpenPseudoModal}
              disabled={isPerformingBulkAction}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
              title="Launch composite pseudo build merge simulation"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Pseudo Build</span>
            </button>

            {/* Deselect All */}
            <button
              onClick={onClearSelection}
              disabled={isPerformingBulkAction}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Deselect all PRs"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Loading Indicator */}
            {isPerformingBulkAction && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing bulk action...</span>
                </div>
              </div>
            )}
          </div>

          {/* Feedback Toast */}
          {bulkActionFeedback && (
            <div className="mt-2 text-center animate-in fade-in slide-in-from-bottom-2 duration-150">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/90 px-3.5 py-1 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur-md">
                <Check className="h-3.5 w-3.5" />
                {bulkActionFeedback}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Bulk Close */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Close {selectedCount} Pull Requests?</h3>
                <p className="text-xs text-slate-400">This will mark all {selectedCount} selected PRs as closed.</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 max-h-36 overflow-y-auto space-y-1 mb-5">
              {selectedList.map((pr) => (
                <div key={pr.id} className="text-xs text-slate-300 flex items-center gap-2 truncate">
                  <span className="font-mono text-slate-500">#{pr.number}</span>
                  <span className="truncate">{pr.title}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmClose(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkClose}
                disabled={isPerformingBulkAction}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {isPerformingBulkAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                <span>Confirm &amp; Close PRs</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
