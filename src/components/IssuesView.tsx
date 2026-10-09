import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Tag,
  MessageSquare,
  Bot,
  Filter,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { Issue, Repository } from '../types/index.ts';

interface IssuesViewProps {
  issues: Issue[];
  repo: Repository;
  onAskGeminiAboutIssue: (issue: Issue) => void;
}

export const IssuesView: React.FC<IssuesViewProps> = ({
  issues,
  repo,
  onAskGeminiAboutIssue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'p0' | 'p1' | 'p2'>('all');

  const filteredIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (filterPriority === 'p0' && (iss.priorityScore || 0) < 80) return false;
      if (filterPriority === 'p1' && ((iss.priorityScore || 0) < 50 || (iss.priorityScore || 0) >= 80)) return false;
      if (filterPriority === 'p2' && (iss.priorityScore || 0) >= 50) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          iss.title.toLowerCase().includes(q) ||
          String(iss.number).includes(q) ||
          iss.author?.toLowerCase().includes(q) ||
          iss.automatedLabelsSummary?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [issues, filterPriority, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Automated Issue Prioritization</h2>
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              {issues.length} TRACKED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time issues categorized and prioritized by impact on release stability and CI test suite health.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterPriority('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterPriority === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterPriority('p0')}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterPriority === 'p0'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            P0 Critical
          </button>
          <button
            onClick={() => setFilterPriority('p1')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterPriority === 'p1'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            P1 Urgent
          </button>
          <button
            onClick={() => setFilterPriority('p2')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterPriority === 'p2'
                ? 'bg-slate-700 text-slate-200'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            P2 Standard
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search issues by keyword, title, author..."
          className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {filteredIssues.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-12 text-center text-xs text-slate-500">
            No issues match the selected filter.
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const labels = issue.automatedLabelsSummary
              ? issue.automatedLabelsSummary.split(',').map((l) => l.trim())
              : [];
            const isP0 = (issue.priorityScore || 0) >= 80;
            const isP1 = (issue.priorityScore || 0) >= 50 && (issue.priorityScore || 0) < 80;

            return (
              <div
                key={issue.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4.5 transition-all ${
                  isP0
                    ? 'border-rose-500/30 bg-rose-950/10 hover:border-rose-500/50'
                    : isP1
                    ? 'border-amber-500/20 bg-slate-900/60 hover:border-amber-500/40'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`mt-1 flex h-8 w-8 items-center justify-center rounded-xl shrink-0 font-bold ${
                      isP0
                        ? 'bg-rose-500/20 text-rose-400'
                        : isP1
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <AlertCircle className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        #{issue.number}
                      </span>
                      <h4 className="font-semibold text-sm text-white truncate max-w-xl">
                        {issue.title}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                          isP0
                            ? 'border-rose-500/30 bg-rose-500/20 text-rose-300'
                            : isP1
                            ? 'border-amber-500/30 bg-amber-500/20 text-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        Score: {issue.priorityScore || 50}/100
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>opened by @{issue.author || 'dev'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {issue.commentsCount || 0} comments
                      </span>
                      <span>•</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {labels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onAskGeminiAboutIssue(issue)}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Triage with Gemini</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
