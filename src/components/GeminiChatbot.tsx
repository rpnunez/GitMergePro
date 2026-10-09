import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  Brain,
  Trash2,
  Loader2,
  User as UserIcon,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Copy,
  Check
} from 'lucide-react';
import { ChatMessage, PullRequest, Repository } from '../types/index.ts';

interface GeminiChatbotProps {
  messages: ChatMessage[];
  onSendMessage: (msg: { role: 'user' | 'assistant'; model: string; content: string }) => Promise<void>;
  onClearHistory: () => Promise<void>;
  activeRepo: Repository | null;
  selectedPrForChat: PullRequest | null;
  onClearPrContext: () => void;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
  activeRepo,
  selectedPrForChat,
  onClearPrContext,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'merge_architect' | 'conflict_specialist' | 'ci_diagnostician'>('merge_architect');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userPrompt = input.trim();
    setInput('');
    setIsLoading(true);

    // Save user message
    await onSendMessage({
      role: 'user',
      model: selectedModel,
      content: userPrompt,
    });

    try {
      // Build conversation history payload
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      history.push({ role: 'user', content: userPrompt });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          model: selectedModel,
          role: selectedRole,
          useThinking: selectedModel === 'gemini-3.1-pro-preview',
          repoContext: activeRepo
            ? {
                owner: activeRepo.owner,
                repo: activeRepo.repo,
                defaultBranch: activeRepo.defaultBranch,
              }
            : null,
          prContext: selectedPrForChat
            ? {
                number: selectedPrForChat.number,
                title: selectedPrForChat.title,
                ciStatus: selectedPrForChat.ciStatus,
                hasConflicts: selectedPrForChat.hasConflicts,
                staticAnalysisStatus: selectedPrForChat.staticAnalysisStatus,
                automatedLabelsSummary: selectedPrForChat.automatedLabelsSummary,
              }
            : null,
        }),
      });

      const data = await response.json();
      const replyText = data.reply || data.error || 'No response received from Gemini.';

      await onSendMessage({
        role: 'assistant',
        model: data.model || selectedModel,
        content: replyText,
      });
    } catch (err: any) {
      console.error('Chat error:', err);
      await onSendMessage({
        role: 'assistant',
        model: selectedModel,
        content: `Error contacting Gemini server: ${err?.message || 'Network error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    'Analyze which PRs are 100% safe to merge into main right now',
    'How should I resolve imports and config collisions in PR rebase?',
    'Explain the CI test failure and recommend a fix strategy',
    'Simulate a 3-PR merge train sequence to minimize conflict probability',
  ];

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
      {/* Top Bar: Role & Model Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-3">
        {/* Role Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Agent Role:
          </span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as any)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="merge_architect">Merge Train Architect</option>
            <option value="conflict_specialist">Git Rebase &amp; Conflict Specialist</option>
            <option value="ci_diagnostician">CI &amp; Test Suite Doctor</option>
          </select>
        </div>

        {/* Model Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900 rounded-xl p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              selectedModel === 'gemini-3.1-pro-preview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="High Thinking Mode with gemini-3.1-pro-preview"
          >
            <Brain className="h-3.5 w-3.5 text-indigo-300" />
            <span>High Thinking (Pro)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedModel('gemini-3.5-flash')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              selectedModel === 'gemini-3.5-flash'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="General reasoning with gemini-3.5-flash"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            <span>General (3.5 Flash)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              selectedModel === 'gemini-3.1-flash-lite'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Ultra-fast low-latency responses with gemini-3.1-flash-lite"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-300" />
            <span>Fast (Flash-Lite)</span>
          </button>
        </div>

        {/* Clear History */}
        <button
          onClick={onClearHistory}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
          title="Clear thread history"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </div>

      {/* PR Context Alert if Selected */}
      {selectedPrForChat && (
        <div className="flex items-center justify-between border-b border-indigo-500/20 bg-indigo-500/10 px-5 py-2 text-xs text-indigo-300">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4" />
            <span>
              Inspecting PR #{selectedPrForChat.number}: <strong>{selectedPrForChat.title}</strong>
            </span>
          </div>
          <button
            onClick={onClearPrContext}
            className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Remove Context
          </button>
        </div>
      )}

      {/* Messages Scrollable Thread */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4 shadow-xl">
              <Bot className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-white">Gemini Repository Triage Copilot</h3>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              Multi-turn assistant for merge safety validation, rebase strategies, test suite diagnostics, and automated train scheduling.
            </p>

            {/* Quick Prompts */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full text-left">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => setInput(qp)}
                  className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300 hover:border-indigo-500/40 hover:bg-slate-900 transition-colors"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{qp}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`group relative max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'border border-slate-800 bg-slate-950 text-slate-200 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1 border-b border-slate-800/40 pb-1">
                    <span className="font-semibold text-slate-300">
                      {isUser ? 'You' : `Gemini (${m.model || 'model'})`}
                    </span>
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="whitespace-pre-wrap font-sans text-xs">
                    {m.content}
                  </div>

                  {!isUser && (
                    <button
                      onClick={() => handleCopy(m.id, m.content)}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-white transition-opacity"
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 shrink-0 mt-0.5">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-indigo-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {selectedModel === 'gemini-3.1-pro-preview'
                  ? 'Gemini 3.1 Pro reasoning with high thinking...'
                  : 'Generating response...'}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="border-t border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini about PRs, CI failures, merge safety, or rebase strategies..."
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
