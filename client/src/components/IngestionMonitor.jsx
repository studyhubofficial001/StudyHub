// client/src/components/IngestionMonitor.jsx
// Live view of the background PDF work for the admin: which file, which step, how many pages, and why it is stuck.
import { useCallback, useEffect, useRef, useState } from "react";
import { getIngestionStatus, retryIngestion } from "../api/resourcesApi";

const BADGE = {
    running: ["Working", "bg-emerald-100 text-emerald-800", "bg-emerald-900/40 text-emerald-300"],
    starting: ["Starting", "bg-sky-100 text-sky-800", "bg-sky-900/40 text-sky-300"],
    waiting: ["In line", "bg-slate-200 text-slate-700", "bg-slate-700 text-slate-200"],
    paused: ["Paused (rate limit)", "bg-amber-100 text-amber-800", "bg-amber-900/40 text-amber-300"],
    retrying: ["Retrying", "bg-amber-100 text-amber-800", "bg-amber-900/40 text-amber-300"],
    stalled: ["Stuck", "bg-red-100 text-red-800", "bg-red-900/40 text-red-300"],
    failed: ["Failed", "bg-red-100 text-red-800", "bg-red-900/40 text-red-300"],
    done: ["Done", "bg-teal-100 text-teal-800", "bg-teal-900/40 text-teal-300"],
    duplicate: ["Duplicate", "bg-slate-200 text-slate-700", "bg-slate-700 text-slate-200"],
    skipped: ["Skipped", "bg-slate-200 text-slate-700", "bg-slate-700 text-slate-200"],
};
const ACTIVE = ["running", "starting", "waiting", "paused", "retrying", "stalled"];

const ago = (iso) => {
    if (!iso) return "";
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return `${Math.round(s / 3600)} h ago`;
};

const IngestionMonitor = ({ isDark }) => {
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [open, setOpen] = useState(true);
    const timer = useRef(null);
    const hasActive = items.some((i) => ACTIVE.includes(i.state));

    const load = useCallback(async () => {
        try {
            const res = await getIngestionStatus();
            setItems(res.data.items || []);
            setError("");
        } catch (err) {
            setError(err.response?.data?.message || "Could not load the background work status.");
        } finally {
            setLoaded(true);
        }
    }, []);

    // refresh every 4 s while something is running, every 20 s otherwise; stop while the tab is hidden
    useEffect(() => {
        let stopped = false;
        const tick = async () => {
            if (!document.hidden) await load();
            if (!stopped) timer.current = setTimeout(tick, hasActive ? 4000 : 20000);
        };
        tick();
        return () => {
            stopped = true;
            clearTimeout(timer.current);
        };
    }, [load, hasActive]);

    const retry = async (id) => {
        setBusyId(id);
        try {
            await retryIngestion(id);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || "Retry failed.");
        } finally {
            setBusyId(null);
        }
    };

    const panel = isDark ? "border-slate-700 bg-slate-800 text-slate-100" : "border-gray-200 bg-white text-gray-900";
    const muted = isDark ? "text-slate-300" : "text-gray-600";
    const track = isDark ? "bg-slate-700" : "bg-gray-200";
    const activeCount = items.filter((i) => ACTIVE.includes(i.state)).length;

    return (
        <div className={`my-6 rounded-lg border p-4 ${panel}`}>
            <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="text-lg font-semibold">
                    Background processing
                    <span className={`ml-2 text-sm font-normal ${muted}`}>
                        {activeCount ? `${activeCount} file(s) in progress` : "nothing running"}
                    </span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                    {hasActive && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
                    <span className={muted}>{open ? "Hide" : "Show"}</span>
                </span>
            </button>

            {open && (
                <div className="mt-3 space-y-3">
                    {error && <p className={`text-sm ${isDark ? "text-red-300" : "text-red-700"}`}>{error}</p>}
                    {loaded && !error && items.length === 0 && <p className={`text-sm ${muted}`}>No uploads have been processed yet.</p>}

                    {items.map((item) => {
                        const [label, light, dark] = BADGE[item.state] || BADGE.waiting;
                        const total = item.totalPages || 0;
                        const read = total ? Math.round((item.pagesRead / total) * 100) : 0;
                        const indexed = total ? Math.round((item.pagesIndexed / total) * 100) : 0;
                        const showBars = total > 0 && ["running", "paused", "retrying", "stalled", "done", "waiting", "failed"].includes(item.state);
                        return (
                            <div key={item._id} className={`rounded-md border p-3 ${isDark ? "border-slate-700" : "border-gray-200"}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isDark ? dark : light}`}>{label}</span>
                                    {item.canRetry && item.state !== "waiting" && item.state !== "starting" && (
                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => retry(item._id)}
                                            className="rounded-md bg-teal-700 px-3 py-0.5 text-xs text-white hover:bg-teal-600 disabled:opacity-60"
                                        >
                                            {busyId === item._id ? "Restarting..." : "Retry"}
                                        </button>
                                    )}
                                </div>

                                {showBars && (
                                    <div className="mt-2 space-y-1">
                                        <div className={`flex justify-between text-xs ${muted}`}>
                                            <span>Text read: {item.pagesRead}/{total} pages</span>
                                            <span>Searchable: {item.pagesIndexed}/{total} pages</span>
                                        </div>
                                        <div className={`relative h-2 overflow-hidden rounded-full ${track}`}>
                                            <div className="absolute inset-y-0 left-0 bg-sky-400 transition-all duration-500" style={{ width: `${read}%` }} />
                                            <div className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500" style={{ width: `${indexed}%` }} />
                                        </div>
                                    </div>
                                )}

                                <p className={`mt-2 text-sm ${item.state === "stalled" || item.state === "failed" ? (isDark ? "text-red-300" : "text-red-700") : muted}`}>
                                    {item.message}
                                </p>
                                <p className={`mt-1 text-xs ${muted}`}>
                                    Uploaded {ago(item.uploadedAt)} · last activity {ago(item.updatedAt)}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default IngestionMonitor;