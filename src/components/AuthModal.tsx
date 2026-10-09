import React from 'react';
import { LogIn, Shield, X, GitMerge, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 font-bold shadow-xl shadow-emerald-500/20 mb-4">
            <GitMerge className="h-7 w-7" />
          </div>

          <h3 className="text-lg font-bold text-white">Sign In to GitMerge Pro</h3>
          <p className="mt-1 text-xs text-slate-400">
            Authenticate with Google to enable persistent database storage for your repositories, pull requests, automated merge trains, and AI triage history.
          </p>
        </div>

        <div className="my-6 space-y-2.5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Secure Firebase Authentication</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Personalized multi-repo Firestore sync</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Automated conflict rebase resolution history</span>
          </div>
        </div>

        <button
          onClick={async () => {
            onClose();
            await onLogin();
          }}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
        >
          <LogIn className="h-4 w-4" />
          <span>Sign In with Google</span>
        </button>
      </div>
    </div>
  );
};
