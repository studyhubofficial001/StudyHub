import { useEffect, useRef, useState } from 'react';
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
import { getUserSubjects } from '../api/subjectsApi';

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
  const messagesContainerRef = useRef(null);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedMarks, setSelectedMarks] = useState('');
  const [subjectsError, setSubjectsError] = useState('');

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

  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

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
  const actionButton = isDark
    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
    : 'bg-slate-800 text-white hover:bg-slate-700';

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const subject = subjects.find((item) => item._id === selectedSubject);
    const requestOptions = {
      subjectId: subject?._id || null,
      subjectName: subject?.name || null,
      marks: selectedMarks ? Number(selectedMarks) : null,
    };
    const userMessage = { role: 'user', text: trimmed, requestOptions };
    const reply = {
      role: 'assistant',
      text: `I can help with “${trimmed}”. For this prototype, I’ve captured your message and prepared a study-focused response flow for the final AI integration.`,
    };

    setMessages((current) => [...current, userMessage, reply]);
    setInput('');
  };

  return (
    <div className={`h-screen h-dvh overflow-hidden ${shellClass}`}>
      <div className="mx-auto box-border h-full max-w-7xl px-2 py-2 sm:px-3 sm:py-4 md:px-6 md:py-6">
        <div className={`relative flex h-full min-h-0 overflow-hidden rounded-2xl border shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:rounded-[28px] ${panelClass}`}>
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
            <header className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b px-2.5 py-2.5 sm:gap-x-3 sm:px-4 sm:py-3 md:px-6 md:py-4 lg:flex-nowrap ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/80'}`}>
              <div className="order-1 flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
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

              <div className="order-3 flex min-w-0 basis-full flex-col gap-2 sm:flex-row sm:items-center lg:order-2 lg:basis-auto lg:flex-1 lg:justify-center">
                <label htmlFor="ask-ai-subject" className="sr-only">Filter by subject</label>
                <select
                  id="ask-ai-subject"
                  value={selectedSubject}
                  onChange={(event) => setSelectedSubject(event.target.value)}
                  className={`h-9 w-full min-w-0 rounded-xl border px-3 text-xs outline-none sm:flex-1 sm:text-sm lg:max-w-52 ${inputClass}`}
                >
                  <option value="all">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject._id} value={subject._id}>{subject.name}</option>
                  ))}
                </select>

                <fieldset className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <legend className="sr-only">Answer length by marks (optional)</legend>
                  <span className={`basis-full text-xs sm:basis-auto sm:self-center sm:pr-1 ${softText}`}>Marks (optional)</span>
                  {['16', '8', '5', '3'].map((marks) => (
                    <label
                      key={marks}
                      className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedMarks === marks
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : `${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`
                      }`}
                    >
                      <input
                        type="radio"
                        name="answer-marks"
                        value={marks}
                        checked={selectedMarks === marks}
                        onChange={(event) => setSelectedMarks(event.target.value)}
                        className="sr-only"
                      />
                      {marks} marks
                    </label>
                  ))}
                  {selectedMarks && (
                    <button
                      type="button"
                      onClick={() => setSelectedMarks('')}
                      className={`rounded-full px-2 py-1 text-xs ${softText}`}
                      aria-label="Clear marks selection"
                    >
                      Clear
                    </button>
                  )}
                </fieldset>
              </div>

              <Link
                to="/dashboard"
                className={`order-2 ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-medium transition sm:gap-2 sm:text-sm lg:order-3 ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`}
              >
                <ArrowLeft size={12} className="sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Go back to main</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </header>

            {subjectsError && (
              <p role="status" className={`px-4 pt-2 text-xs ${softText}`}>{subjectsError}</p>
            )}

            <div className="relative flex min-h-0 flex-1 flex-col gap-3 p-2.5 sm:gap-4 sm:p-3 md:p-5">
              <div
                ref={messagesContainerRef}
                className={`relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-[20px] border p-2.5 sm:gap-4 sm:rounded-[24px] sm:p-3 md:p-4 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-[#f9faf8]'}`}
              >
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
                      {message.requestOptions && (
                        <p className={`mt-2 border-t pt-2 text-[10px] ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-200 text-slate-500'}`}>
                          Subject: {message.requestOptions.subjectName || 'All subjects'}
                          {' · '}
                          Marks: {message.requestOptions.marks ? `${message.requestOptions.marks} marks` : 'No preference'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className={`rounded-[20px] border p-2.5 sm:rounded-[24px] sm:p-3 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-end gap-2 sm:gap-3">
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
                    className={`min-w-0 flex-1 resize-none rounded-2xl border px-3 py-2.5 text-xs outline-none focus:border-slate-400 sm:px-4 sm:py-3 sm:text-sm ${inputClass}`}
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
