// server/controllers/ingestionController.js
// Admin-only view of the background PDF work (OCR -> embeddings -> Qdrant).
// It only READS what the Python service already saves in MongoDB, so nothing here can slow the worker down.
const mongoose = require("mongoose");
const Resource = require("../models/Resource");
const { inngest } = require("../config/inngest");

const NOT_STARTED_MIN = 15; // a queued file nobody has touched for this long is not really "starting"
const NO_PROGRESS_MIN = 20; // a processing file with no progress for this long is stuck

const minutesSince = (date, now) => (date ? Math.max(0, Math.round((now - new Date(date)) / 60000)) : null);
const clock = (date) => new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

// Pure function: one resource + facts about the queue -> {state, message}.
// state: done | failed | duplicate | skipped | waiting | starting | running | paused | retrying | stalled
function describe(r, { now = new Date(), position = 0, head = null } = {}) {
  if (r.status === "indexed") {
    const bad = r.failedPages?.length || 0;
    return { state: "done", message: bad ? `Finished. ${bad} page(s) could not be read: ${r.failedPages.join(", ")}` : "Finished. All pages are searchable." };
  }
  if (r.status === "failed") return { state: "failed", message: r.ingestError || r.lastError || "Failed (no reason was saved)." };
  if (r.status === "duplicate") return { state: "duplicate", message: "This file is a duplicate of one already uploaded, so it was not processed." };
  if (r.status === "skipped") return { state: "skipped", message: "Not a PDF, so no text extraction is needed." };
  if (r.status === "deleting" || r.status === "cancelled") return { state: "skipped", message: "Being deleted." };

  const idle = minutesSince(r.updatedAt, now);
  if (position > 0) {
    return { state: "waiting", message: `Waiting in line behind ${position} file(s). Now working on: ${head || "another file"}.` };
  }
  if (r.waitingUntil && new Date(r.waitingUntil) > now) {
    return { state: "paused", message: `Paused because the AI rate limit is used up. It continues by itself at ${clock(r.waitingUntil)}.` };
  }
  if (r.lastError) {
    return { state: "retrying", message: `A step failed and is being retried. Last error: ${r.lastError}` };
  }
  if (r.status === "queued" && idle >= NOT_STARTED_MIN) {
    return {
      state: "stalled",
      message: `Not started for ${idle} min. The worker was probably offline when this was uploaded. Press Retry, or the hourly check will restart it.`,
    };
  }
  if (r.status === "processing" && idle >= NO_PROGRESS_MIN) {
    return { state: "stalled", message: `No progress for ${idle} min. The worker may have stopped. Press Retry.` };
  }
  if (r.status === "queued") return { state: "starting", message: "Queued. The worker will pick it up in a moment." };
  return { state: "running", message: r.stage || "Working..." };
}

// ---------------------------------------------------------------- GET /admin/ingestion
exports.getIngestionStatus = async (req, res) => {
  try {
    const now = new Date();
    const fields = "title originalName status pageCount pagesDone failedPages ingestError waitingUntil stage lastError lastErrorAt createdAt updatedAt indexedAt";

    const active = await Resource.find({ status: { $in: ["queued", "processing"] } }).select(fields).sort({ createdAt: 1, _id: 1 }).lean();
    const failed = await Resource.find({ status: "failed" }).select(fields).sort({ updatedAt: -1 }).limit(10).lean();
    const recent = await Resource.find({ status: { $in: ["indexed", "duplicate"] } }).select(fields).sort({ updatedAt: -1 }).limit(8).lean();
    const rows = [...active, ...failed, ...recent];

    // pages whose text was already read (OCR): one document per page in the Python service's page_texts collection
    const ocr = new Map();
    const ids = rows.map((r) => String(r._id));
    if (ids.length) {
      const counts = await mongoose.connection.db
        .collection("page_texts")
        .aggregate([{ $match: { resourceId: { $in: ids } } }, { $group: { _id: "$resourceId", n: { $sum: 1 } } }])
        .toArray();
      counts.forEach((c) => ocr.set(c._id, c.n));
    }

    const head = active[0]?.title || null;
    const activeIndex = new Map(active.map((r, i) => [String(r._id), i]));

    const items = rows.map((r) => {
      const total = r.pageCount || 0;
      const done = r.status === "indexed" ? total : r.pagesDone || 0;
      const read = r.status === "indexed" ? total : Math.min(ocr.get(String(r._id)) || 0, total || Infinity);
      const info = describe(r, { now, position: activeIndex.get(String(r._id)) ?? 0, head });
      return {
        _id: r._id,
        title: r.title || r.originalName,
        status: r.status,
        state: info.state,
        message: info.message,
        stage: r.stage || null,
        totalPages: total,
        pagesRead: total ? read : 0,   // OCR finished
        pagesIndexed: total ? done : 0, // saved in the search index
        failedPages: r.failedPages || [],
        uploadedAt: r.createdAt,
        updatedAt: r.updatedAt,
        idleMinutes: minutesSince(r.updatedAt, now),
        canRetry: ["failed", "queued"].includes(r.status),
      };
    });
    res.json({ serverTime: now, items });
  } catch (err) {
    console.error("getIngestionStatus failed:", err.message);
    res.status(500).json({ message: "Could not load ingestion status" });
  }
};

// ---------------------------------------------------------------- POST /admin/ingestion/:id/retry
exports.retryIngestion = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid resource" });
  try {
    const updated = await Resource.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ["failed", "queued"] } },
      { $set: { status: "queued", ingestError: null, lastError: null, lastErrorAt: null, waitingUntil: null, updatedAt: new Date() } },
      { new: true }
    ).select("_id");
    if (!updated) return res.status(409).json({ message: "Only failed or waiting files can be retried." });

    await inngest.send({
      id: `manual-${updated._id}-${Date.now()}`, // new id every time, so Inngest never treats it as a duplicate
      name: "resource/uploaded",
      data: { resourceId: String(updated._id) },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("retryIngestion failed:", err.message);
    res.status(500).json({ message: "Could not restart. Check that the Inngest event key is set." });
  }
};

exports._describe = describe; // exported for tests