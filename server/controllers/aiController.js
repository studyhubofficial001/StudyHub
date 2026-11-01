// Express never does AI work. It checks the request, adds the student's year and subject filters,
// saves the chat, and passes the AI service's streamed answer through to the browser.
const axios = require("axios");
const mongoose = require("mongoose");
const { StringDecoder } = require("string_decoder");
const Chat = require("../models/Chat");
const Subject = require("../models/Subjects");
const Resource = require("../models/Resource");

const AI_URL = process.env.FASTAPI_URL; // e.g. http://127.0.0.1:8000
const INTERNAL_KEY = process.env.AI_INTERNAL_KEY || "";
const MAX_QUESTION = 2000; // keep equal to MAX_QUESTION_CHARS in the AI service
const MAX_MESSAGES_PER_CHAT = 100;
const VALID_MARKS = [3, 5, 8, 16];

const busyUsers = new Set(); // one answer at a time per student (protects the free-tier limits)

const makeTitle = (q) => {
  const t = q.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}...` : t;
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function parseEvent(raw) {
  let name = "message";
  const dataLines = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { name, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

// Adds the document title to every source, so the page can show "DBMS Unit 3 notes, p.12".
async function withTitles(sources) {
  const ids = [...new Set(sources.map((s) => s.resource_id).filter((id) => mongoose.isValidObjectId(id)))];
  if (!ids.length) return sources;
  try {
    const rows = await Resource.find({ _id: { $in: ids } }).select("title").lean();
    const titles = new Map(rows.map((r) => [String(r._id), r.title]));
    return sources.map((s) => ({ ...s, title: titles.get(String(s.resource_id)) || null }));
  } catch (err) {
    console.error("source titles failed:", err.message);
    return sources;
  }
}

// ---------------------------------------------------------------- POST /ai/chat/stream
exports.chatStream = async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question) return res.status(400).json({ message: "question is required" });
  if (question.length > MAX_QUESTION) {
    return res.status(400).json({ message: `question must be at most ${MAX_QUESTION} characters` });
  }

  let marks = req.body?.marks ?? null;
  if (marks !== null && marks !== "") {
    marks = Number(marks);
    if (!VALID_MARKS.includes(marks)) return res.status(400).json({ message: "marks must be 3, 5, 8 or 16" });
  } else {
    marks = null;
  }

  if (!req.user.year) return res.status(403).json({ message: "Please complete your profile (year) to use Ask AI" });
  const userId = String(req.user._id);
  if (busyUsers.has(userId)) {
    return res.status(429).json({ message: "Please wait for the current answer to finish." });
  }

  // Year always comes from the logged-in student, never from the browser.
  // Subject "all" means: no subject filter, so the whole year is searched.
  let subject = null;
  const subjectId = req.body?.subjectId;
  if (subjectId && subjectId !== "all") {
    if (!mongoose.isValidObjectId(subjectId)) return res.status(400).json({ message: "Invalid subject" });
    subject = await Subject.findOne({ _id: subjectId, year: Number(req.user.year) }).select("name");
    if (!subject) return res.status(400).json({ message: "Unknown subject" });
  }
  const filters = { year: String(req.user.year), ...(subject ? { subject: subject.name } : {}) };

  // ---- save the student's message (new chat, or add to an existing one)
  const userMessage = {
    role: "user",
    text: question,
    options: { subjectId: subject ? String(subject._id) : null, subjectName: subject ? subject.name : null, marks },
  };
  let chat;
  let history = []; // the last messages of this chat, so a follow-up like "what is its output" can be understood
  const chatId = req.body?.chatId;
  if (chatId) {
    if (!mongoose.isValidObjectId(chatId)) return res.status(400).json({ message: "Invalid chat" });
    chat = await Chat.findOne({ _id: chatId, user: req.user._id }).select({ title: 1, messages: { $slice: -4 } });
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    history = (chat.messages || [])
      .filter((m) => m.text && !m.error)
      .map((m) => ({ role: m.role, text: m.text.slice(0, m.role === "assistant" ? 6000 : 1500) }));
    const full = await Chat.exists({ _id: chat._id, [`messages.${MAX_MESSAGES_PER_CHAT - 1}`]: { $exists: true } });
    if (full) return res.status(400).json({ message: "This chat is full. Please start a new chat." });
    await Chat.updateOne({ _id: chat._id }, { $push: { messages: userMessage } });
  } else {
    chat = await Chat.create({ user: req.user._id, title: makeTitle(question), messages: [userMessage] });
  }

  busyUsers.add(userId);
  const controller = new AbortController();
  res.on("close", () => controller.abort()); // student closed the tab or pressed Stop: stop the AI work too

  let text = "";
  let sources = [];
  let failed = null;
  let saved = false;

  const send = (chunk) => {
    if (!res.writableEnded && !res.destroyed) res.write(chunk);
  };
  const finish = async () => {
    if (saved) return;
    saved = true;
    busyUsers.delete(userId);
    const body = text || failed;
    if (body) {
      try {
        await Chat.updateOne(
          { _id: chat._id },
          { $push: { messages: { role: "assistant", text: body, sources, error: !text } } }
        );
      } catch (err) {
        console.error("saving the answer failed:", err.message);
      }
    }
    if (!res.writableEnded) res.end();
  };

  let upstream;
  try {
    upstream = await axios.post(
      `${AI_URL}/chat/stream`,
      { question, marks, filters, history },
      {
        headers: { "x-internal-key": INTERNAL_KEY },
        responseType: "stream",
        signal: controller.signal,
        timeout: 120000,
      }
    );
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error("AI stream failed:", err.message);
      failed = "The AI service is not available right now. Please try again in a moment.";
    }
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" });
    res.flushHeaders();
    send(sse("chat", { chatId: String(chat._id), title: chat.title }));
    if (failed) send(sse("error", { message: failed }));
    return finish();
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tells proxies not to hold the tokens back
  });
  res.flushHeaders();
  send(sse("chat", { chatId: String(chat._id), title: chat.title })); // the page learns the id of a new chat

  // Read the AI service's events, keep a copy for the database, and forward them in order.
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  let queue = Promise.resolve();

  const handle = async (raw) => {
    const ev = parseEvent(raw);
    if (!ev) return;
    if (ev.name === "token") text += ev.data.text || "";
    if (ev.name === "error") failed = ev.data.message || "Something went wrong.";
    if (ev.name === "sources") {
      sources = await withTitles(Array.isArray(ev.data) ? ev.data : []);
      return send(sse("sources", sources));
    }
    send(sse(ev.name, ev.data));
  };

  upstream.data.on("data", (chunk) => {
    buffer += decoder.write(chunk);
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) queue = queue.then(() => handle(part)).catch((e) => console.error(e.message));
  });
  upstream.data.on("end", () => {
    queue = queue.then(finish);
  });
  upstream.data.on("error", () => {
    if (!controller.signal.aborted && !failed && !text) failed = "The connection to the AI service was lost.";
    queue = queue.then(finish);
  });
};

// ---------------------------------------------------------------- GET /ai/chats?q=
exports.getChatStats = async (req, res) => {
  try {
    const [stats] = await Chat.aggregate([
      { $match: { user: req.user._id } },
      { $unwind: "$messages" },
      { $match: { "messages.role": "user" } },
      {
        $group: {
          _id: null,
          questionsAsked: { $sum: 1 },
          subjectIds: { $addToSet: "$messages.options.subjectId" },
        },
      },
    ]);

    res.json({
      questionsAsked: stats?.questionsAsked || 0,
      exploredSubjectIds: (stats?.subjectIds || []).filter(Boolean),
    });
  } catch (err) {
    console.error("getChatStats failed:", err.message);
    res.status(500).json({ message: "Could not load your dashboard stats" });
  }
};

exports.listChats = async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";

    if (!q) {
      const chats = await Chat.find({ user: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(100)
        .select("title updatedAt")
        .lean();
      return res.json(chats.map((c) => ({ _id: c._id, title: c.title, updatedAt: c.updatedAt })));
    }

    // Search: title OR any message text, only the student's own chats.
    const escaped = escapeRegex(q);
    const rows = await Chat.aggregate([
      {
        $match: {
          user: req.user._id,
          $or: [{ title: new RegExp(escaped, "i") }, { "messages.text": new RegExp(escaped, "i") }],
        },
      },
      { $sort: { updatedAt: -1 } },
      { $limit: 30 },
      {
        $project: {
          title: 1,
          updatedAt: 1,
          hit: {
            $first: {
              $filter: {
                input: "$messages",
                as: "m",
                cond: { $regexMatch: { input: "$$m.text", regex: escaped, options: "i" } },
              },
            },
          },
        },
      },
    ]);

    const snippet = (t) => {
      if (!t) return null;
      const i = t.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, i - 40);
      const piece = t.slice(start, i + q.length + 80).replace(/\s+/g, " ");
      return `${start > 0 ? "..." : ""}${piece}${t.length > i + q.length + 80 ? "..." : ""}`;
    };
    res.json(rows.map((r) => ({ _id: r._id, title: r.title, updatedAt: r.updatedAt, snippet: snippet(r.hit?.text) })));
  } catch (err) {
    console.error("listChats failed:", err.message);
    res.status(500).json({ message: "Could not load your chats" });
  }
};

// ---------------------------------------------------------------- GET /ai/chats/:id
exports.getChat = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid chat" });
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json({
      _id: chat._id,
      title: chat.title,
      messages: chat.messages.map((m) => ({
        role: m.role,
        text: m.text,
        sources: m.sources || [],
        options: m.options || null,
        error: !!m.error,
      })),
    });
  } catch (err) {
    console.error("getChat failed:", err.message);
    res.status(500).json({ message: "Could not load this chat" });
  }
};

// ---------------------------------------------------------------- DELETE /ai/chats/:id
exports.deleteChat = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid chat" });
  try {
    await Chat.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteChat failed:", err.message);
    res.status(500).json({ message: "Could not delete this chat" });
  }
};