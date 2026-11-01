// Talks to the Express server: chat history + the streaming answer.
//
// API_BASE must be the same address your other api files (e.g. subjectsApi.js) use.
// Login is the httpOnly cookie, so every request uses credentials: 'include'.
const API_BASE = (import.meta.env.VITE_API_URL).replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // sends the login cookie
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

export const listChats = (query = '') =>
  request(`/ai/chats${query ? `?q=${encodeURIComponent(query)}` : ''}`);

export const getChatStats = () => request('/ai/chats/stats');

export const getChat = (chatId) => request(`/ai/chats/${chatId}`);

export const deleteChat = (chatId) => request(`/ai/chats/${chatId}`, { method: 'DELETE' });

/**
 * Sends a question and reads the answer as it is written.
 * onEvent(name, data) is called for: chat, status, meta, sources, token, done, error.
 */
export async function streamAnswer({ question, subjectId, marks, chatId, signal, onEvent }) {
  const response = await fetch(`${API_BASE}/ai/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, subjectId, marks, chatId }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleBlock = (block) => {
    let name = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    try {
      onEvent(name, JSON.parse(dataLines.join('\n')));
    } catch {
      /* ignore a broken event */
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop();
    blocks.forEach(handleBlock);
  }
  if (buffer.trim()) handleBlock(buffer);
}