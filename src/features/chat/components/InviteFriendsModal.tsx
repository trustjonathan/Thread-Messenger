import React, { useState, useEffect } from 'react';
import { Copy, Check, Share2, RefreshCw, AlertCircle, X, Link as LinkIcon, ShieldAlert } from 'lucide-react';
import { getMyInviteCode, regenerateInviteCode } from '@/lib/apiClient';
import { copyTextToClipboard } from '@/lib/clipboard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteFriendsModal({ isOpen, onClose }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const announce = (msg: string) => {
    setAnnouncement(msg);
    setTimeout(() => setAnnouncement(''), 3000);
  };

  useEffect(() => {
    if (!isOpen) {
      setShowRegenConfirm(false);
      setErrorMsg(null);
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMsg(null);

    getMyInviteCode()
      .then((res) => {
        if (!active) return;
        if (res.data) {
          setCode(res.data);
        } else {
          setErrorMsg(res.error?.message || 'Failed to load your invite link.');
        }
      })
      .catch(() => {
        if (active) setErrorMsg('Network error loading invite link.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://thread.app';
  const inviteLink = code ? `${origin}/invite/${code}` : '';
  const shareMessage = `Join me on Thread, a free text messenger. ${inviteLink}`;

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    const res = await copyTextToClipboard(inviteLink);
    if (res.success) {
      setCopied(true);
      announce('Invite link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      announce(res.fallbackSelectionMade ? "Couldn't copy — link selected" : "Couldn't copy link");
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Thread',
          text: shareMessage,
          url: inviteLink,
        });
        announce('Invite shared successfully');
        return;
      } catch {
        // User cancelled share or failed, proceed to fallback copy
      }
    }
    // Fallback to copy link
    await handleCopyLink();
  };

  const handleConfirmRegenerate = async () => {
    setIsRegenerating(true);
    setErrorMsg(null);
    try {
      const res = await regenerateInviteCode();
      if (res.data) {
        setCode(res.data);
        setShowRegenConfirm(false);
        announce('New invite link generated. Old link stopped working.');
      } else {
        setErrorMsg(res.error?.message || 'Failed to regenerate invite link.');
      }
    } catch {
      setErrorMsg('Network error regenerating link.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="w-full max-w-md bg-thread-surface border border-thread-border rounded-2xl shadow-xl overflow-hidden flex flex-col text-thread-text animate-in fade-in-50 zoom-in-95 duration-150">
        <header className="px-5 py-4 border-b border-thread-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-thread-accent" aria-hidden="true" />
            <h2 id="invite-modal-title" className="text-base font-semibold">
              Invite friends
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-thread-muted hover:text-thread-text hover:bg-thread-soft transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <p className="text-sm text-thread-muted">
            Share this link with anyone you want to chat with on Thread.
          </p>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-thread-muted">
              <RefreshCw className="w-5 h-5 animate-spin text-thread-accent" />
              <span>Generating your link...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <>
              {/* Link Box */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-thread-soft border border-thread-border">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  aria-label="Your invite link"
                  className="flex-1 bg-transparent text-xs sm:text-sm font-mono text-thread-text truncate select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-thread-surface border border-thread-border hover:bg-thread-soft text-xs font-medium text-thread-text flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent min-h-[36px]"
                  aria-label={copied ? 'Copied link' : 'Copy link'}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-green-600 dark:text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-thread-muted" />
                      <span>Copy link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-thread-accent text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent min-h-[44px]"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegenConfirm(true)}
                  disabled={isRegenerating}
                  className="py-2.5 px-3 rounded-xl border border-thread-border bg-thread-surface hover:bg-thread-soft text-thread-text text-sm flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-thread-accent min-h-[44px]"
                  title="Regenerate link"
                >
                  <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              </div>

              {/* Regenerate confirmation warning */}
              {showRegenConfirm && (
                <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-2">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="font-medium">
                      The old link will stop working immediately. Anyone who has not redeemed it yet won't be able to join using it.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRegenConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-thread-muted hover:text-thread-text hover:bg-thread-soft font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRegenerate}
                      disabled={isRegenerating}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                    >
                      {isRegenerating ? 'Regenerating...' : 'Yes, regenerate'}
                    </button>
                  </div>
                </div>
              )}

              {/* Privacy Notice */}
              <p className="text-xs text-thread-muted pt-2 border-t border-thread-border leading-relaxed">
                Note: Anyone with this link can see your name and @username and ask to chat.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
