import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import api from '../../api/client';
import AiFormatTab from './AiFormatTab';
import {
  Sparkles,
  X,
  Copy,
  Check,
  MessageSquare,
  Wand2,
  SquarePen,
  ArrowUp,
  Square,
  ArrowDown,
  Info,
  RotateCcw,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

const SUGGESTIONS = [
  'quickQ1',
  'quickQ2',
  'quickQ3',
  'quickQ4',
];

export default function AiAssistantDrawer({ isOpen, onClose, triggerRef }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'format'

  // Chat State
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ai_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isColdStart, setIsColdStart] = useState(false);
  const [showScopePopover, setShowScopePopover] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // History recall state
  const lastUserMessageRef = useRef('');

  // DOM Refs
  const drawerRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const coldStartTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Save chat history to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('ai_chat_history', JSON.stringify(messages.slice(-50)));
    } catch {
      // ignore
    }
  }, [messages]);

  // Lock background scroll with scrollbar compensation when drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  // Handle Focus Trap & Keyboard Shortcuts (Escape, Ctrl+K)
  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus composer on desktop only
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch && textareaRef.current && activeTab === 'chat') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isGenerating && abortControllerRef.current) {
          abortControllerRef.current.abort();
          setIsGenerating(false);
          setIsColdStart(false);
          if (coldStartTimerRef.current) clearTimeout(coldStartTimerRef.current);
        } else {
          onClose();
          triggerRef?.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, activeTab, onClose, triggerRef]);

  // Auto Scroll logic
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setShowScrollBottomBtn(!isNearBottom);
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, isGenerating]);

  // Auto-grow textarea
  const adjustTextareaHeight = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    const newHeight = Math.min(textareaRef.current.scrollHeight, 140); // max ~6 lines
    textareaRef.current.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // Clear Chat History
  const handleNewChat = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setInput('');
    setError(null);
    setIsGenerating(false);
    setIsColdStart(false);
    try {
      sessionStorage.removeItem('ai_chat_history');
    } catch {}
  };

  // Send Message Handler
  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend !== null ? textToSend : input).trim();
    if (!query || isGenerating) return;

    if (query.length > 1000) {
      setError('Message exceeds 1000 character limit');
      return;
    }

    lastUserMessageRef.current = query;
    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: query };
    const updatedMessages = [...messages, userMsg];

    setMessages(updatedMessages);
    setInput('');
    setError(null);
    setIsGenerating(true);
    setIsColdStart(false);

    // 5s Cold Start Timer
    coldStartTimerRef.current = setTimeout(() => {
      setIsColdStart(true);
    }, 5000);

    abortControllerRef.current = new AbortController();

    try {
      const { data } = await api.post(
        '/api/ai/chat',
        {
          question: query,
          messages: updatedMessages.slice(-10),
        },
        { signal: abortControllerRef.current.signal }
      );

      if (coldStartTimerRef.current) clearTimeout(coldStartTimerRef.current);
      setIsColdStart(false);

      if (data.message && data.message.content) {
        const assistantMsg = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.message.content,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('No content returned');
      }
    } catch (err) {
      if (coldStartTimerRef.current) clearTimeout(coldStartTimerRef.current);
      setIsColdStart(false);

      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        return;
      }

      // Restore unsent text to composer if failed
      setInput(query);
      const code = err.response?.data?.code || 'UPSTREAM_ERROR';
      const friendlyMsg =
        code === 'RATE_LIMITED'
          ? 'Too many requests. Please try again in a moment.'
          : err.response?.data?.error || t('errors.GENERIC');

      setError(friendlyMsg);
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Stop Generation Handler
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setIsColdStart(false);
      if (coldStartTimerRef.current) clearTimeout(coldStartTimerRef.current);
    }
  };

  // Keyboard Event Handler for Composer
  const handleComposerKeyDown = (e) => {
    // Check IME composition (Amharic / Arabic input method)
    const isComposing = e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229;
    if (isComposing) return;

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (e.key === 'Enter') {
      if (isTouch) {
        // Touch devices: plain Enter inserts newline
        return;
      }

      if (!e.shiftKey) {
        // Desktop: plain Enter or Ctrl/Cmd+Enter sends message
        e.preventDefault();
        handleSendMessage();
      }
    } else if (e.key === 'ArrowUp' && !input && lastUserMessageRef.current) {
      e.preventDefault();
      setInput(lastUserMessageRef.current);
    }
  };

  // Copy Message Handler
  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Regenerate last assistant answer
  const handleRegenerate = () => {
    if (isGenerating || messages.length === 0) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      // Remove last assistant response if any
      const trimmed = messages.filter((m, idx) => !(idx === messages.length - 1 && m.role === 'assistant'));
      setMessages(trimmed);
      handleSendMessage(lastUser.content);
    }
  };

  if (!isOpen) return null;

  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const drawerContent = (
    <div
      ref={drawerRef}
      className="fixed inset-0 z-[90] overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="AI Assistant"
    >
      {/* Simple dim backdrop (no heavy blur) */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen sm:w-[440px] xl:w-[480px] max-w-full bg-surface-900 dark:bg-surface-900 border-l border-surface-200 dark:border-surface-800 text-surface-100 shadow-2xl flex flex-col animate-slide-left h-[100dvh]">
          {/* 1. FIXED HEADER (56px) */}
          <div className="h-14 px-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-surface-900/95 dark:bg-surface-900/95 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary-500 dark:text-primary-400" />
              </div>
              <h2 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                {t('ai.assistantTitle')}
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNewChat}
                disabled={messages.length === 0}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={t('ai.newChat')}
                aria-label={t('ai.newChat')}
              >
                <SquarePen className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors cursor-pointer"
                title={t('ai.close')}
                aria-label={t('ai.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. SEGMENTED TABS CONTROL */}
          <div className="px-4 py-2 border-b border-surface-200 dark:border-surface-800 bg-surface-950/60 dark:bg-surface-950/60 shrink-0">
            <div className="flex p-1 rounded-xl bg-surface-900 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 gap-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'chat'}
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'chat'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('ai.portalTab')}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'format'}
                onClick={() => setActiveTab('format')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'format'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{t('ai.formatTab')}</span>
              </button>
            </div>
          </div>

          {/* 3. SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain p-4 space-y-4">
            {activeTab === 'chat' ? (
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex flex-col h-full space-y-4 relative"
                role="log"
                aria-live="polite"
              >
                {/* Empty State */}
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-4 my-auto">
                    <div className="w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-primary-400" />
                    </div>
                    <p className="text-sm font-semibold text-surface-200">
                      {t('ai.greeting')}
                    </p>

                    {/* 4 Translated Suggestion Chips */}
                    <div className="w-full space-y-2 pt-2">
                      {SUGGESTIONS.map((key, idx) => {
                        const chipText = t(`ai.${key}`);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(chipText)}
                            className="w-full p-3 rounded-2xl bg-surface-950/80 hover:bg-primary-600/15 border border-surface-800 hover:border-primary-500/40 text-left text-xs text-surface-300 hover:text-primary-300 transition-all cursor-pointer flex items-center justify-between group"
                          >
                            <span className="truncate pr-2">{chipText}</span>
                            <ArrowUp className="w-3.5 h-3.5 text-surface-500 group-hover:text-primary-400 rotate-45 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Messages List */
                  <div className="space-y-4">
                    {messages.map((m, idx) => {
                      const isUser = m.role === 'user';
                      const isLastAssistant = !isUser && idx === messages.length - 1;

                      return (
                        <div
                          key={m.id || idx}
                          className={`flex gap-3 text-xs animate-fade-in ${
                            isUser ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isUser && (
                            <div className="w-7 h-7 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                            </div>
                          )}

                          <div className={`space-y-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                            <div
                              dir="auto"
                              className={`p-3.5 rounded-2xl leading-relaxed ${
                                isUser
                                  ? 'bg-primary-600/20 text-surface-100 border border-primary-500/30 rounded-tr-none'
                                  : 'bg-transparent text-surface-200 border-none px-0 py-0'
                              }`}
                            >
                              {isUser ? (
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              ) : (
                                <div className="prose prose-invert prose-xs max-w-none space-y-2 font-sans [overflow-wrap:anywhere]">
                                  <ReactMarkdown
                                    rehypePlugins={[rehypeSanitize]}
                                    components={{
                                      a: ({ href, children }) => {
                                        const isInternal = href?.startsWith('/admin');
                                        return (
                                          <a
                                            href={href}
                                            onClick={(e) => {
                                              if (isInternal) {
                                                e.preventDefault();
                                                navigate(href);
                                                if (isTouchDevice) onClose();
                                              }
                                            }}
                                            target={isInternal ? '_self' : '_blank'}
                                            rel="noopener noreferrer"
                                            className="text-primary-400 underline font-semibold hover:text-primary-300 inline-flex items-center gap-0.5"
                                          >
                                            {children}
                                            {!isInternal && <ExternalLink className="w-3 h-3 inline" />}
                                          </a>
                                        );
                                      },
                                      table: ({ children }) => (
                                        <div className="overflow-x-auto my-2 rounded-xl border border-surface-800">
                                          <table className="w-full text-left text-[11px]">
                                            {children}
                                          </table>
                                        </div>
                                      ),
                                      code: ({ inline, children }) => (
                                        <code className={`${inline ? 'bg-surface-800 px-1 py-0.5 rounded text-[11px] text-amber-300' : 'block bg-surface-950 p-2.5 rounded-xl border border-surface-800 overflow-x-auto text-[11px] font-mono text-surface-200'}`}>
                                          {children}
                                        </code>
                                      ),
                                    }}
                                  >
                                    {m.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>

                            {/* Assistant Actions (Copy, Regenerate) */}
                            {!isUser && (
                              <div className="flex items-center gap-2 pt-1 text-[11px] text-surface-400">
                                <button
                                  type="button"
                                  onClick={() => handleCopyMessage(m.id || idx, m.content)}
                                  className="hover:text-surface-200 flex items-center gap-1 cursor-pointer transition-colors"
                                  title={t('ai.copyResponse')}
                                >
                                  {copiedId === (m.id || idx) ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>

                                {isLastAssistant && (
                                  <button
                                    type="button"
                                    onClick={handleRegenerate}
                                    className="hover:text-surface-200 flex items-center gap-1 cursor-pointer transition-colors"
                                    title={t('ai.regenerate')}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>{t('ai.regenerate')}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Generating Indicator & Cold Start Notice */}
                    {isGenerating && (
                      <div className="flex items-center gap-3 text-xs text-surface-400 animate-fade-in">
                        <div className="w-7 h-7 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 bg-surface-950 px-3 py-2 rounded-2xl border border-surface-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse delay-150" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse delay-300" />
                          </div>
                          {isColdStart && (
                            <p className="text-[11px] text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{t('ai.wakingUp')}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Inline Error Display */}
                    {error && (
                      <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-2 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendMessage()}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] shrink-0 cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}

                {/* Floating "Jump to latest" button */}
                {showScrollBottomBtn && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom()}
                    className="absolute bottom-4 right-4 p-2 rounded-full bg-surface-800 border border-surface-700 text-surface-200 hover:text-white shadow-xl animate-fade-in cursor-pointer z-10"
                    title={t('ai.jumpToLatest')}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              /* Format Tab View */
              <AiFormatTab onInsertCsv={onClose} />
            )}
          </div>

          {/* 4. FIXED COMPOSER / FOOTER FOR CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="p-4 border-t border-surface-200 dark:border-surface-800 bg-surface-900/95 dark:bg-surface-900/95 backdrop-blur-md shrink-0 space-y-2">
              {/* Single Rounded Container */}
              <div className="relative rounded-2xl bg-surface-950 dark:bg-surface-950 border border-surface-700 dark:border-surface-700 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/30 transition-all p-2 flex flex-col">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  dir="auto"
                  value={input}
                  onChange={(e) => {
                    if (e.target.value.length <= 1000) {
                      setInput(e.target.value);
                    }
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={t('ai.askPlaceholder')}
                  aria-label={t('ai.askPlaceholder')}
                  enterKeyHint="send"
                  className="w-full px-2 pt-1 pb-8 text-xs text-surface-100 placeholder:text-surface-500 bg-transparent border-none focus:outline-none resize-none font-sans"
                />

                {/* Send / Stop Action Button inside Container at Bottom-Right */}
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {input.length > 800 && (
                    <span className="text-[10px] font-mono text-amber-400">
                      {1000 - input.length}
                    </span>
                  )}

                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={handleStopGenerating}
                      className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                      title={t('ai.stop')}
                      aria-label={t('ai.stop')}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!input.trim()}
                      onClick={() => handleSendMessage()}
                      className="w-9 h-9 rounded-full bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                      title={t('ai.send')}
                      aria-label={t('ai.send')}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Muted Disclaimer & Keyboard Hint */}
              <div className="flex items-center justify-between text-[11px] text-surface-400 px-1">
                <div className="flex items-center gap-1 truncate">
                  <span className="truncate">{t('ai.disclaimer')}</span>
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowScopePopover(!showScopePopover)}
                      className="text-surface-500 hover:text-primary-400 p-0.5 cursor-pointer"
                      title="Scope Notice"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    {showScopePopover && (
                      <div className="absolute bottom-full mb-2 left-0 w-64 p-3 rounded-2xl bg-surface-950 border border-surface-700 text-surface-200 text-xs shadow-2xl z-50 animate-scale-in">
                        {t('ai.scopeNoticeTooltip')}
                      </div>
                    )}
                  </div>
                </div>

                {!isTouchDevice && (
                  <span className="hidden sm:inline text-surface-500 text-[10px] shrink-0 pl-2">
                    {t('ai.keyboardHint')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
