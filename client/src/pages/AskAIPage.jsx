import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SendHorizontal,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getUserSubjects } from '../api/subjectsApi';
import { deleteChat, getChat, listChats, streamAnswer } from '../api/aiApi';

const initialMessages = [
  {
    role: 'assistant',
    text: 'Hi! I can help with your subjects, notes, and study questions. Ask anything you want to revise or understand better.',
  },
  {
    role: 'assistant',
    text: 'Try a question like: “Summarize the key topics for OOP,” or “Explain the steps for the DBMS assignment.”',
  },
];

// Answer length for each marks option (single-spaced A4)
const MARKS_OPTIONS = [
  { value: '16', words: 2688, pages: '6' },
  { value: '8', words: 1920, pages: '4' },
  { value: '5', words: 1152, pages: '3' },
  { value: '3', words: 768, pages: '1.5' },
];

const MAX_QUESTION_CHARS = 2000;

const groupLabel = (dateValue) => {
  const date = new Date(dateValue);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday - startOfDate) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 days';
  return 'Older';
};

const groupChats = (chats) => {
  const groups = [];
  chats.forEach((chat) => {
    const label = groupLabel(chat.updatedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(chat);
    else groups.push({ label, items: [chat] });
  });
  return groups;
};

const isMobileScreen = () => typeof window !== 'undefined' && window.innerWidth < 640;

const AskAIPage = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [messages, setMessages] = useState(initialMessages);
  const [chatId, setChatId] = useState(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [chatSearch, setChatSearch] = useState('');
  const [chatsError, setChatsError] = useState('');

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedMarks, setSelectedMarks] = useState('');
  const [subjectsError, setSubjectsError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  // filter bottom sheet: edits are kept as a draft until the student taps Apply
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftSubject, setDraftSubject] = useState('all');
  const [draftMarks, setDraftMarks] = useState('');
  const [tipOpen, setTipOpen] = useState(true);
  const textareaRef = useRef(null);

  const messagesContainerRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const abortRef = useRef(null);
  const runRef = useRef(0); // identifies the current answer, so a late event from an old one is ignored
  const chatsRequestRef = useRef(0);
  const searchInputRef = useRef(null);

  // ---------------------------------------------------------------- data
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await getUserSubjects();
        setSubjects(response.data || []);
      } catch (error) {
        console.error('Error fetching subjects for Ask AI:', error);
        setSubjectsError('Unable to load your subjects. You can still ask about all subjects.');
      }
    };
    fetchSubjects();
  }, []);

  const refreshChats = useCallback(async (query = '') => {
    const requestId = ++chatsRequestRef.current;
    try {
      const data = await listChats(query);
      if (requestId !== chatsRequestRef.current) return; // a newer search already replaced this one
      setChats(Array.isArray(data) ? data : []);
      setChatsError('');
    } catch (error) {
      if (requestId !== chatsRequestRef.current) return;
      console.error('Error loading chats:', error);
      setChatsError('Unable to load your chats.');
    }
  }, []);

  // search box: wait a moment after typing, then search all previous chats
  useEffect(() => {
    const timer = setTimeout(() => refreshChats(chatSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [chatSearch, refreshChats]);

  // stop the answer if the page is closed
  useEffect(() => () => abortRef.current?.abort(), []);

  // keep the newest text in view, unless the student scrolled up to read
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container && stickToBottomRef.current) {
      container.scrollTo({ top: container.scrollHeight, behavior: streaming ? 'auto' : 'smooth' });
    }
  }, [messages, streaming]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    stickToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  };

  // the message box grows with the text (up to about 7 lines), then scrolls
  useEffect(() => {
    const box = textareaRef.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 168)}px`;
  }, [input]);

  // Esc closes the filter sheet
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  // ---------------------------------------------------------------- styles
  const shellClass = isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#f5f7f3] text-slate-900';
  const panelClass = isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white';
  const assistantBubble = isDark ? 'border border-slate-700 bg-slate-800/80 text-slate-100' : 'border border-slate-200 bg-white text-slate-800';
  const errorBubble = isDark ? 'border border-red-900 bg-red-950/40 text-red-200' : 'border border-red-200 bg-red-50 text-red-700';
  const userBubble = isDark ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white';
  const softText = isDark ? 'text-slate-400' : 'text-slate-500';
  const dividerClass = isDark ? 'border-slate-800' : 'border-slate-200';
  const inputClass = isDark
    ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500';
  const quickActionClass = isDark
    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
    : 'bg-slate-100 text-slate-700 hover:bg-slate-200';
  const actionButton = isDark
    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
    : 'bg-slate-800 text-white hover:bg-slate-700';
  const chipClass = isDark ? 'border-slate-600 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600';

  // ---------------------------------------------------------------- actions
  const closeSidebarOnMobile = () => {
    if (isMobileScreen()) setSidebarOpen(false);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const startNewChat = () => {
    runRef.current += 1; // anything still arriving from the old answer is ignored
    abortRef.current?.abort();
    setStreaming(false);
    setMessages(initialMessages);
    setChatId(null);
    setInput('');
    stickToBottomRef.current = true;
    closeSidebarOnMobile();
  };

  const openChat = async (id) => {
    runRef.current += 1;
    abortRef.current?.abort();
    setStreaming(false);
    try {
      const chat = await getChat(id);
      setMessages(
        chat.messages.map((message) => ({
          role: message.role,
          text: message.text,
          sources: message.sources || [],
          error: message.error,
          requestOptions: message.role === 'user' ? message.options : undefined,
        }))
      );
      setChatId(chat._id);
      stickToBottomRef.current = true;
      closeSidebarOnMobile();
    } catch (error) {
      setChatsError(error.message || 'Unable to open this chat.');
    }
  };

  const handleDeleteChat = async (event, id) => {
    event.stopPropagation();
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    try {
      await deleteChat(id);
      setChats((current) => current.filter((chat) => chat._id !== id));
      if (id === chatId) startNewChat();
    } catch (error) {
      setChatsError(error.message || 'Unable to delete this chat.');
    }
  };

  const openSearch = () => {
    setSidebarOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 320);
  };

  const handleCopy = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const openSheet = () => {
    setDraftSubject(selectedSubject);
    setDraftMarks(selectedMarks);
    setSheetOpen(true);
  };

  const applyFilters = () => {
    setSelectedSubject(draftSubject);
    setSelectedMarks(draftMarks);
    setSheetOpen(false);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const subject = subjects.find((item) => item._id === selectedSubject);
    const marks = selectedMarks ? Number(selectedMarks) : null;
    const requestOptions = {
      subjectId: subject?._id || null,
      subjectName: subject?.name || null,
      marks,
    };

    const controller = new AbortController();
    abortRef.current = controller;
    const myRun = ++runRef.current;

    // change the last message (the answer being written), but only while this answer is still the current one
    const patchLast = (change) => {
      if (runRef.current !== myRun) return;
      setMessages((current) => {
        const next = current.slice();
        next[next.length - 1] = change(next[next.length - 1]);
        return next;
      });
    };

    stickToBottomRef.current = true;
    setMessages((current) => [
      ...current,
      { role: 'user', text: trimmed, requestOptions },
      { role: 'assistant', text: '', streaming: true, stage: 'searching', sources: [] },
    ]);
    setInput('');
    setStreaming(true);

    try {
      await streamAnswer({
        question: trimmed,
        subjectId: subject?._id || 'all',
        marks,
        chatId,
        signal: controller.signal,
        onEvent: (name, data) => {
          if (runRef.current !== myRun) return;
          if (name === 'chat') setChatId(data.chatId);
          else if (name === 'status') patchLast((m) => ({ ...m, stage: data.stage }));
          else if (name === 'sources') patchLast((m) => ({ ...m, sources: data }));
          else if (name === 'token') patchLast((m) => ({ ...m, text: m.text + data.text }));
          else if (name === 'error') patchLast((m) => ({ ...m, text: m.text || data.message, error: !m.text }));
        },
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        patchLast((m) => ({ ...m, text: m.text || 'Stopped.' }));
      } else {
        patchLast((m) => ({ ...m, text: m.text || error.message || 'Something went wrong. Please try again.', error: !m.text }));
      }
    } finally {
      patchLast((m) => ({ ...m, streaming: false }));
      if (runRef.current === myRun) {
        setStreaming(false);
        abortRef.current = null;
        refreshChats(chatSearch.trim());
      }
    }
  };

  const groupedChats = groupChats(chats);
  const searching = chatSearch.trim().length > 0;

  // ---------------------------------------------------------------- pieces
  const railButton = (label, onClick, icon) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition sm:h-10 sm:w-10 ${quickActionClass}`}
    >
      {icon}
    </button>
  );

  const subjectLabel = subjects.find((item) => item._id === selectedSubject)?.name || 'All subjects';
  const marksLabel = selectedMarks ? `${selectedMarks} marks` : 'Any marks';
  const draftMarksInfo = MARKS_OPTIONS.find((option) => option.value === draftMarks);
  const sheetPanel = isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const pillClass = isDark
    ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';

  return (
    <div className={`h-dvh overflow-hidden ${shellClass}`}>
      {/* chat fills the whole screen: no outer margin, no card border */}
      <div className={`relative flex h-full min-h-0 overflow-hidden ${panelClass}`}>
        {/* phone only: dark layer behind the open chat list; tap it to close */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close recent chats"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-20 bg-black/40 sm:hidden"
          />
        )}

        {/* narrow bar with icons (computer screens, chat list closed) */}
        {!sidebarOpen && (
          <aside className={`hidden w-16 shrink-0 flex-col items-center gap-3 border-r px-2 py-4 sm:flex ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
            {railButton('Open recent chats', () => setSidebarOpen(true), <PanelLeftOpen size={16} />)}
            {railButton('Search conversations', openSearch, <Search size={16} />)}
            {railButton('New chat', startNewChat, <Plus size={16} />)}
          </aside>
        )}

        {/* chat list: slides over the page on phones, sits beside the chat on computers */}
        <aside
          aria-hidden={!sidebarOpen}
          className={`absolute inset-y-0 left-0 z-30 flex w-72 max-w-[85%] flex-col border-r shadow-xl transition-all duration-300 ease-out sm:static sm:z-auto sm:max-w-none sm:shadow-none ${
            sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full sm:hidden'
          } ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
        >
          <div className={`flex items-center justify-between border-b px-3 py-3 ${dividerClass}`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Close recent chats"
                onClick={() => setSidebarOpen(false)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${quickActionClass}`}
              >
                <PanelLeftClose size={14} />
              </button>
              <h2 className="text-sm font-semibold sm:text-base">Recent chats</h2>
            </div>
            <button
              type="button"
              aria-label="New chat"
              title="New chat"
              onClick={startNewChat}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${quickActionClass}`}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="px-3 pt-3">
            <div className="relative">
              <Search size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${softText}`} />
              <input
                ref={searchInputRef}
                type="text"
                value={chatSearch}
                onChange={(event) => setChatSearch(event.target.value)}
                placeholder="Search your chats"
                aria-label="Search your chats"
                className={`h-9 w-full rounded-xl border pl-9 pr-8 text-xs outline-none focus:border-slate-400 sm:text-sm ${inputClass}`}
              />
              {chatSearch && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setChatSearch('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 ${softText}`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
            {chatsError && <p role="status" className="text-xs text-red-500">{chatsError}</p>}

            {!chatsError && chats.length === 0 && (
              <p className={`px-1 text-xs ${softText}`}>
                {searching ? 'No chats match your search.' : 'No chats yet. Ask your first question!'}
              </p>
            )}

            {groupedChats.map((group) => (
              <div key={group.label}>
                <p className={`mb-1.5 px-1 text-[10px] uppercase tracking-[0.2em] ${softText}`}>{group.label}</p>
                <ul className="space-y-1">
                  {group.items.map((chat) => (
                    <li key={chat._id} className="group relative">
                      <button
                        type="button"
                        onClick={() => openChat(chat._id)}
                        className={`block w-full rounded-xl px-3 py-2 pr-9 text-left transition ${
                          chat._id === chatId
                            ? isDark ? 'bg-slate-700' : 'bg-slate-200'
                            : isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span className="block truncate text-sm font-medium">{chat.title}</span>
                        {chat.snippet && <span className={`mt-0.5 block truncate text-[11px] ${softText}`}>{chat.snippet}</span>}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete chat ${chat.title}`}
                        onClick={(event) => handleDeleteChat(event, chat._id)}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 opacity-100 transition hover:text-red-500 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${softText}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* slim header: menu, title, new chat, back */}
          <header className={`flex items-center gap-2 border-b px-2.5 py-2 sm:gap-3 sm:px-4 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/80'}`}>
            <button
              type="button"
              aria-label={sidebarOpen ? 'Hide recent chats' : 'Open recent chats'}
              onClick={() => setSidebarOpen((value) => !value)}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition sm:hidden ${quickActionClass}`}
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            <div className="min-w-0 leading-tight">
              <p className={`text-[8px] uppercase tracking-[0.2em] sm:text-[10px] ${softText}`}>StudyHub AI</p>
              <h1 className="text-lg font-semibold sm:text-xl">Ask AI</h1>
            </div>

            {/* one pill shows the current filters; tap it to change them */}
            <button
              type="button"
              onClick={openSheet}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              title="Change subject and marks"
              className={`mx-auto hidden h-9 w-full min-w-0 max-w-sm items-center gap-2 rounded-full border px-3 text-xs transition sm:flex ${pillClass}`}
            >
              <SlidersHorizontal size={14} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{subjectLabel} · {marksLabel}</span>
              <ChevronDown size={14} className="shrink-0" />
            </button>

            <button
              type="button"
              aria-label="New chat"
              title="New chat"
              onClick={startNewChat}
              className={`ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition sm:hidden ${quickActionClass}`}
            >
              <Plus size={16} />
            </button>

            <Link
              to="/dashboard"
              className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium transition sm:gap-2 sm:text-sm ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`}
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Go back to main</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </header>

          {/* phone: the pill sits on its own row under the header */}
          <div className={`border-b px-2.5 py-2 sm:hidden ${dividerClass}`}>
            <button
              type="button"
              onClick={openSheet}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className={`flex h-10 w-full items-center gap-2 rounded-full border px-3 text-xs transition ${pillClass}`}
            >
              <SlidersHorizontal size={14} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{subjectLabel} · {marksLabel}</span>
              <ChevronDown size={14} className="shrink-0" />
            </button>
          </div>

          {subjectsError && (
            <p role="status" className={`px-4 pt-2 text-xs ${softText}`}>{subjectsError}</p>
          )}

          {/* messages: the whole middle of the screen */}
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className={`relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${isDark ? 'bg-slate-950/40' : 'bg-[#f9faf8]'}`}
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-2.5 py-3 sm:gap-4 sm:px-4 sm:py-5">
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                const waiting = message.streaming && !message.text;
                return (
                  <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      style={{ overflowWrap: 'anywhere' }}
                      className={`overflow-hidden whitespace-pre-wrap wrap-break-word rounded-2xl px-3 py-2.5 text-xs leading-5 sm:px-4 sm:py-3 sm:text-sm sm:leading-6 ${
                        isUser ? 'max-w-[88%] sm:max-w-[75%]' : 'max-w-[96%] sm:max-w-[92%]'
                      } ${isUser ? userBubble : message.error ? errorBubble : assistantBubble}`}
                    >
                      {waiting ? (
                        <span className={`animate-pulse ${softText}`}>
                          {message.stage === 'writing' ? 'Writing the answer…' : 'Searching your notes…'}
                        </span>
                      ) : (
                        message.text
                      )}
                      {message.streaming && message.text && <span className="ml-0.5 animate-pulse">▍</span>}

                      {message.requestOptions && (
                        <p className={`mt-2 border-t pt-2 text-[10px] ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-200 text-slate-500'}`}>
                          Subject: {message.requestOptions.subjectName || 'All subjects'}
                          {' · '}
                          Marks: {message.requestOptions.marks ? `${message.requestOptions.marks} marks` : 'No preference'}
                        </p>
                      )}

                      {!isUser && !message.streaming && message.sources?.length > 0 && (
                        <div className={`mt-3 border-t pt-2 ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                          <p className={`mb-1.5 text-[10px] uppercase tracking-[0.15em] ${softText}`}>Sources</p>
                          <div className="flex flex-wrap gap-1.5">
                            {message.sources.slice(0, 6).map((source) => (
                              <span
                                key={`${source.resource_id}-${source.page}`}
                                className={`max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] ${chipClass}`}
                              >
                                {source.title || source.subject || 'Notes'}
                                {source.page ? ` · p.${source.page}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isUser && !message.streaming && !message.error && message.text && index >= initialMessages.length && (
                        <button
                          type="button"
                          onClick={() => handleCopy(message.text, index)}
                          className={`mt-2 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] transition ${softText} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                        >
                          {copiedIndex === index ? <Check size={12} /> : <Copy size={12} />}
                          {copiedIndex === index ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* tip + message box */}
          <div className={`border-t px-2.5 pb-2.5 pt-2 sm:px-4 sm:pb-4 ${dividerClass} ${isDark ? 'bg-slate-950/40' : 'bg-white'}`}>
            <div className="mx-auto w-full max-w-4xl">
              {tipOpen && (
                <div className={`mb-2 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-4 ${isDark ? 'bg-indigo-950/50 text-slate-300' : 'bg-indigo-50 text-slate-600'}`}>
                  <p className="min-w-0 flex-1">
                    Asking several questions at once? Number them (1. 2. 3.) so each one gets its own full answer.
                  </p>
                  <button
                    type="button"
                    aria-label="Dismiss tip"
                    onClick={() => setTipOpen(false)}
                    className={`shrink-0 rounded-md p-0.5 ${softText}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 sm:gap-3">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  maxLength={MAX_QUESTION_CHARS}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask anything about your course, notes, or assignments..."
                  className={`min-h-11 min-w-0 flex-1 resize-none rounded-3xl border px-4 py-2.5 text-xs outline-none focus:border-slate-400 sm:text-sm ${inputClass}`}
                />

                {streaming ? (
                  <button
                    type="button"
                    onClick={stopStreaming}
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${actionButton}`}
                    aria-label="Stop answer"
                    title="Stop answer"
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${actionButton}`}
                    aria-label="Send message"
                  >
                    <SendHorizontal size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* filters: bottom sheet on phones, centered card on larger screens */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Subject and marks">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className={`relative w-full max-w-md rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl ${sheetPanel}`}>
            <div className={`mx-auto mb-4 h-1 w-10 rounded-full sm:hidden ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />

            <label htmlFor="ask-ai-subject" className={`mb-1.5 block text-xs ${softText}`}>Subject</label>
            <select
              id="ask-ai-subject"
              value={draftSubject}
              onChange={(event) => setDraftSubject(event.target.value)}
              className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${inputClass}`}
            >
              <option value="all">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject._id} value={subject._id}>{subject.name}</option>
              ))}
            </select>

            <fieldset className="mt-4">
              <legend className={`mb-1.5 text-xs ${softText}`}>Marks (optional)</legend>
              <div className="grid grid-cols-2 gap-2">
                {MARKS_OPTIONS.map(({ value, words, pages }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={draftMarks === value}
                    title={`About ${words} words (${pages} pages)`}
                    onClick={() => setDraftMarks((current) => (current === value ? '' : value))}
                    className={`h-11 rounded-full border text-sm font-medium transition-colors ${
                      draftMarks === value
                        ? 'border-indigo-600! bg-indigo-600! text-white!'
                        : isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {value} marks
                  </button>
                ))}
              </div>
              <p className={`mt-2 text-[11px] ${softText}`}>
                {draftMarksInfo
                  ? `About ${draftMarksInfo.words} words (${draftMarksInfo.pages} pages) per question. Tap again to clear.`
                  : 'Pick marks to set how long the answer should be.'}
              </p>
            </fieldset>

            <button
              type="button"
              onClick={applyFilters}
              className="mt-5 h-12 w-full rounded-full bg-indigo-600! text-sm font-semibold text-white! transition hover:bg-indigo-500!"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AskAIPage;