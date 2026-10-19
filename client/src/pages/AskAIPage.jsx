import { useState } from 'react';
import {
  ArrowLeft,
  PanelLeftOpen,
  PanelLeftClose,
  Search,
  Plus,
  SendHorizontal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

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

const AskAIPage = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shellClass = isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#f5f7f3] text-slate-900';
  const panelClass = isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white';
  const drawerClass = isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white';
  const assistantBubble = isDark ? 'border border-slate-700 bg-slate-800/80 text-slate-100' : 'border border-slate-200 bg-white text-slate-800';
  const userBubble = isDark ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white';
  const softText = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputClass = isDark
    ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500';
  const quickActionClass = isDark
    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
    : 'bg-slate-100 text-slate-700 hover:bg-slate-200';
  const promptButton = isDark
    ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100';
  const actionButton = isDark
    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
    : 'bg-slate-800 text-white hover:bg-slate-700';

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage = { role: 'user', text: trimmed };
    const reply = {
      role: 'assistant',
      text: `I can help with “${trimmed}”. For this prototype, I’ve captured your message and prepared a study-focused response flow for the final AI integration.`,
    };

    setMessages((current) => [...current, userMessage, reply]);
    setInput('');
  };

  const handlePromptClick = (prompt) => setInput(prompt);

  return (
    <div className={`h-screen overflow-hidden ${shellClass}`}>
      <div className="mx-auto box-border h-full max-w-7xl px-3 py-4 md:px-6 md:py-6">
        <div className={`relative flex h-full overflow-hidden rounded-[28px] border shadow-[0_24px_60px_rgba(15,23,42,0.12)] ${panelClass}`}>
          <aside
            className={`hidden shrink-0 flex-col items-center gap-3 border-r px-2 py-4 transition-all duration-300 ease-out sm:flex ${
              sidebarOpen ? 'w-0 overflow-hidden border-r-0 px-0 opacity-0' : 'w-[72px] opacity-100'
            } ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}
          >
            <div
              className={`flex flex-col items-center gap-3 transition-all duration-300 ease-out ${
                sidebarOpen ? '-translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
              }`}
            >
              <button
                type="button"
                aria-label={sidebarOpen ? 'Hide recent chats' : 'Open recent chats'}
                onClick={() => setSidebarOpen((value) => !value)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition sm:h-10 sm:w-10 ${quickActionClass}`}
              >
                {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>

              <button
                type="button"
                aria-label="Search conversations"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition sm:h-10 sm:w-10 ${quickActionClass}`}
              >
                <Search size={16} />
              </button>

              <button
                type="button"
                aria-label="New chat"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition sm:h-10 sm:w-10 ${quickActionClass}`}
              >
                <Plus size={16} />
              </button>
            </div>
          </aside>

          <aside
            className={`absolute inset-y-0 left-0 z-20 w-[220px] border-r shadow-xl transition-all duration-300 ease-out sm:w-[260px] ${
              sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[110%] opacity-0 pointer-events-none'
            } ${drawerClass}`}
          >
            <div className={`flex items-center justify-between border-b px-3 py-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
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
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${quickActionClass}`}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="space-y-3 p-3">
              <div className={`rounded-2xl border p-3 ${isDark ? 'border-slate-800 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${softText}`}>Today</p>
                <p className="mt-2 text-sm font-medium">AI tutor summary</p>
              </div>

              <div className={`rounded-2xl border p-3 ${isDark ? 'border-slate-800 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${softText}`}>Yesterday</p>
                <p className="mt-2 text-sm font-medium">DBMS concept review</p>
              </div>

              <div className={`rounded-2xl border p-3 ${isDark ? 'border-slate-800 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${softText}`}>Last week</p>
                <p className="mt-2 text-sm font-medium">Research notes recap</p>
              </div>
            </div>
          </aside>

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <header className={`flex items-center justify-between gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 md:px-6 md:py-4 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/80'}`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  aria-label={sidebarOpen ? 'Hide recent chats' : 'Open recent chats'}
                  onClick={() => setSidebarOpen((value) => !value)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl transition sm:hidden ${quickActionClass}`}
                >
                  {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                </button>

                <div>
                  <p className={`text-[8px] uppercase tracking-[0.2em] sm:text-[10px] ${softText}`}>StudyHub AI</p>
                  <h1 className="text-lg font-semibold sm:text-2xl">Ask AI</h1>
                </div>
              </div>

              <Link
                to="/dashboard"
                className={`inline-flex items-center gap-1 text-[10px] font-medium transition sm:gap-2 sm:text-sm ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`}
              >
                <ArrowLeft size={12} className="sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Go back to main</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col gap-3 p-2.5 sm:gap-4 sm:p-3 md:p-5">
              <div className={`relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-[20px] border p-2.5 sm:gap-4 sm:rounded-[24px] sm:p-3 md:p-4 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-[#f9faf8]'}`}>
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      style={{ overflowWrap: 'anywhere' }}
                      className={`max-w-[90%] overflow-hidden break-words whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-xs leading-5 sm:px-4 sm:py-3 sm:text-sm sm:leading-6 md:max-w-[75%] ${
                        message.role === 'user' ? userBubble : assistantBubble
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className={`rounded-[24px] border p-3 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-end gap-3">
                  <textarea
                    rows={3}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask anything about your course, notes, or assignments..."
                    className={`w-full resize-none rounded-2xl border px-3 py-2.5 text-xs outline-none focus:border-slate-400 sm:px-4 sm:py-3 sm:text-sm ${inputClass}`}
                  />

                  <button
                    type="button"
                    onClick={handleSend}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl transition sm:h-12 sm:w-12 ${actionButton}`}
                    aria-label="Send message"
                  >
                    <SendHorizontal size={16} className="sm:h-[18px] sm:w-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AskAIPage;
