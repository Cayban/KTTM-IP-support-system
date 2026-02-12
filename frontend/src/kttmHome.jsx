// src/pages/KttmDashboardPage.jsx
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import rmsLogo from "./assets/rmslogo.png";

// API base — use Vite env `VITE_API_URL` or fallback to localhost:3001
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function KttmDashboardPage() {
  const [now, setNow] = useState(() => new Date());

  // Filters (match your real DB)
  const [type, setType] = useState("All"); // -> ip_records.category
  const [status, setStatus] = useState("All"); // -> ip_records.status
  const [q, setQ] = useState("");
  const [analyticsView, setAnalyticsView] = useState("year"); // "year" | "ipType"

  // Records panel controls
  const [recordView, setRecordView] = useState("latest"); // "latest" | "attention"
  const [recordLimit, setRecordLimit] = useState(30);

  // DB rows
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // gender stats
  const [genderStats, setGenderStats] = useState([]);
  const [genderLoading, setGenderLoading] = useState(false);
  const [genderErr, setGenderErr] = useState("");

  // calendar state
  const [calCursor, setCalCursor] = useState(() => new Date()); // month to display
  const [dayModal, setDayModal] = useState({ open: false, dateKey: "", items: [] });

  // ✅ lock body scroll (page itself not scrollable)
  // You can keep this; but with the flex layout below, it's already safe.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = useMemo(
    () =>
      now.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [now]
  );

  const timeStr = useMemo(
    () =>
      now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [now]
  );

  // fetch records
  useEffect(() => {
    const ac = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setErrMsg("");

        const params = new URLSearchParams();
        if (type && type !== "All") params.set("category", type);
        if (status && status !== "All") params.set("status", status);
        if (q.trim()) params.set("q", q.trim());
        params.set("limit", "2000");
        params.set("offset", "0");

        const res = await fetch(`${API_BASE}/api/records?${params.toString()}`, {
          signal: ac.signal,
        });

        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to load records");

        // map from ip_records fields
        const mapped = (data.rows || []).map((r) => ({
          id: r.record_id,
          title: r.ip_title ?? "—",
          type: r.category ?? "—",
          status: r.status ?? "—",
          inventors: r.owner_inventor_summary ?? "—",
          ipId: r.record_id ?? "—",
          regDate: r.date_registered ?? "—",
          location: r.campus ?? "—",
        }));

        setRows(mapped);
      } catch (e) {
        if (e.name !== "AbortError") setErrMsg(e.message || "Error");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => ac.abort();
  }, [type, status, q]);

  // fetch gender stats (contributors)
  useEffect(() => {
    const ac = new AbortController();
    async function loadGender() {
      try {
        setGenderLoading(true);
        setGenderErr("");
        const res = await fetch(`${API_BASE}/api/gender/stats`, { signal: ac.signal });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to load gender stats");
        setGenderStats(data.rows || []);
      } catch (e) {
        if (e.name !== "AbortError") setGenderErr(e.message || "Error");
      } finally {
        setGenderLoading(false);
      }
    }

    loadGender();
    return () => ac.abort();
  }, []);

  // server already filtered, but keep the name
  const filtered = rows;

  // KPIs + analytics derived from filtered
  const analytics = useMemo(() => {
    const total = filtered.length;

    const byType = {
      Patent: filtered.filter((r) => r.type === "Patent").length,
      "Utility Model": filtered.filter((r) => r.type === "Utility Model").length,
      "Industrial Design": filtered.filter((r) => r.type === "Industrial Design").length,
      Trademark: filtered.filter((r) => r.type === "Trademark").length,
      Copyright: filtered.filter((r) => r.type === "Copyright").length,
    };

    const byStatus = {
      "Recently Filed": filtered.filter((r) => r.status === "Recently Filed").length,
      Registered: filtered.filter((r) => r.status === "Registered").length,
      Unregistered: filtered.filter((r) => r.status === "Unregistered").length,
      "Close to Expiration": filtered.filter((r) => r.status === "Close to Expiration").length,
      Other: filtered.filter(
        (r) =>
          !["Recently Filed", "Registered", "Unregistered", "Close to Expiration"].includes(r.status)
      ).length,
    };

    // last 6 months registrations (date_registered)
    const monthsBack = 6;
    const monthBuckets = buildMonthBuckets(monthsBack);
    const byMonth = monthBuckets.map((b) => ({ key: b.key, label: b.label, count: 0 }));

    for (const r of filtered) {
      const d = parseDateFlexible(r.regDate);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const idx = byMonth.findIndex((x) => x.key === key);
      if (idx >= 0) byMonth[idx].count += 1;
    }

    // top campuses (location)
    const locMap = new Map();
    for (const r of filtered) {
      const loc = String(r.location || "—").trim() || "—";
      locMap.set(loc, (locMap.get(loc) || 0) + 1);
    }
    const topLocations = [...locMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));

    // Registrations by year
    const yearMap = new Map();
    const allYears = new Set();
    for (const r of filtered) {
      const d = parseDateFlexible(r.regDate);
      if (!d) continue;
      const year = d.getFullYear();
      allYears.add(year);
      yearMap.set(year, (yearMap.get(year) || 0) + 1);
    }
    const byYear = Array.from(allYears)
      .sort((a, b) => a - b)
      .map((year) => ({ label: String(year), value: yearMap.get(year) || 0 }));

    // Registrations by IP type per year
    const byYearAndType = [];
    const yearTypeMap = new Map();
    for (const r of filtered) {
      const d = parseDateFlexible(r.regDate);
      if (!d) continue;
      const year = d.getFullYear();
      const ipType = r.type || "Unknown";
      const key = `${year}-${ipType}`;
      yearTypeMap.set(key, (yearTypeMap.get(key) || 0) + 1);
    }
    for (const year of Array.from(allYears).sort((a, b) => a - b)) {
      const typeBreakdown = {};
      for (const ipType of ["Patent", "Utility Model", "Industrial Design", "Trademark", "Copyright"]) {
        const key = `${year}-${ipType}`;
        typeBreakdown[ipType] = yearTypeMap.get(key) || 0;
      }
      byYearAndType.push({ year, breakdown: typeBreakdown });
    }

    return { total, byType, byStatus, byMonth, topLocations, byYear, byYearAndType };
  }, [filtered]);

  // Records panel data
  const recordsPanel = useMemo(() => {
    const withMeta = filtered.map((r) => {
      const reg = parseDateFlexible(r.regDate);
      return { ...r, _reg: reg };
    });

    const latest = [...withMeta].sort((a, b) => {
      const at = a._reg ? a._reg.getTime() : -Infinity;
      const bt = b._reg ? b._reg.getTime() : -Infinity;
      if (bt !== at) return bt - at;
      return String(a.title).localeCompare(String(b.title));
    });

    const attention = withMeta
      .filter((r) => ["Close to Expiration", "Unregistered"].includes(r.status))
      .sort((a, b) => {
        const aRank = a.status === "Close to Expiration" ? 0 : 1;
        const bRank = b.status === "Close to Expiration" ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        const at = a._reg ? a._reg.getTime() : -Infinity;
        const bt = b._reg ? b._reg.getTime() : -Infinity;
        return bt - at;
      });

    const base = recordView === "attention" ? attention : latest;
    const shown = base.slice(0, recordLimit);

    return { totalShown: shown.length, totalBase: base.length, items: shown };
  }, [filtered, recordView, recordLimit]);

  const pct = (part, whole) => (whole <= 0 ? 0 : Math.round((part / whole) * 100));
  const regPct = pct(analytics.byStatus.Registered, analytics.total);
  const unregPct = pct(analytics.byStatus.Unregistered, analytics.total);
  const filedPct = pct(analytics.byStatus["Recently Filed"], analytics.total);
  const closePct = pct(analytics.byStatus["Close to Expiration"], analytics.total);
  const maxMonth = Math.max(1, ...analytics.byMonth.map((x) => x.count));
  const maxYear = Math.max(1, ...analytics.byYear.map((x) => x.value));

  // ✅ Calendar events: expiry + renewal (computed from date_registered + type)
  const calendarEvents = useMemo(() => {
    const map = new Map(); // dateKey -> events[]
    const push = (dateKey, ev) => {
      if (!dateKey) return;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(ev);
    };

    for (const r of filtered) {
      const reg = parseDateFlexible(r.regDate);
      const st = String(r.status || "").trim();
      if (st === "Recently Filed") continue; // no schedule until registered
      if (!reg) continue;

      const due = computeNextDueDate(r.type, reg);
      const exp = computeExpiryDate(r.type, reg);

      if (due) {
        push(formatDateISO(due), {
          kind: "due",
          title: r.title,
          ipId: r.ipId,
          type: r.type,
          status: r.status,
          campus: r.location,
          dateKey: formatDateISO(due),
        });
      }
      if (exp) {
        push(formatDateISO(exp), {
          kind: "expiry",
          title: r.title,
          ipId: r.ipId,
          type: r.type,
          status: r.status,
          campus: r.location,
          dateKey: formatDateISO(exp),
        });
      }
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ar = a.kind === "expiry" ? 0 : 1;
        const br = b.kind === "expiry" ? 0 : 1;
        if (ar !== br) return ar - br;
        return String(a.title).localeCompare(String(b.title));
      });
      map.set(k, arr);
    }

    return map;
  }, [filtered]);

  // ✅ Upcoming events (sorted by date)
  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const events = [];

    for (const [dateKey, items] of calendarEvents.entries()) {
      const eventDate = parseDateFlexible(dateKey);
      if (eventDate && eventDate >= today) {
        events.push(
          ...items.map((ev) => ({
            ...ev,
            eventDate,
            dateKey,
          }))
        );
      }
    }

    events.sort((a, b) => {
      if (a.eventDate.getTime() !== b.eventDate.getTime()) return a.eventDate.getTime() - b.eventDate.getTime();
      const ar = a.kind === "expiry" ? 0 : 1;
      const br = b.kind === "expiry" ? 0 : 1;
      if (ar !== br) return ar - br;
      return String(a.title).localeCompare(String(b.title));
    });

    return events;
  }, [calendarEvents]);

  const calYear = calCursor.getFullYear();
  const calMonth = calCursor.getMonth();
  const calLabel = calCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const calGrid = useMemo(() => buildCalendarGrid(calYear, calMonth), [calYear, calMonth]);

  function openDayModal(dateKey) {
    const items = calendarEvents.get(dateKey) || [];
    setDayModal({ open: true, dateKey, items });
  }

  function jumpToDateAndOpenModal(dateKey) {
    const [yyyy, mm, dd] = dateKey.split("-");
    setCalCursor(new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)));
    setTimeout(() => openDayModal(dateKey), 80);
  }

  function closeDayModal() {
    setDayModal({ open: false, dateKey: "", items: [] });
  }

  return (
    // ✅ KEY FIX: flex column page; no hardcoded header height math
    <div className="h-screen overflow-hidden flex flex-col text-slate-900 bg-cover bg-center" style={{ backgroundImage: "url('/bsuBG.jpg')" }}>
      {/* dark overlay for readability */}
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px] -z-10" />

      {/* Header (shrink-0, fixed) */}
      <header className="fixed top-0 left-0 right-0 z-20 shrink-0">
        <div className="backdrop-blur-md bg-slate-950/55 border-b border-white/10">
          <div className="w-full px-5 md:px-8 xl:px-10 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={rmsLogo} alt="RMS Logo" className="h-full w-full object-contain scale-125" />
                </div>

                <div className="leading-tight min-w-0">
                  <div className="text-white text-lg font-black truncate">KTTM Dashboard</div>
                  <div className="text-white/75 text-xs">IP Records · Analytics · Calendar</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-white/90">
                <span className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15">{dateStr}</span>
                <span className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15">{timeStr}</span>

                <Link to="/" className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15 hover:bg-white/15 transition text-white">
                  Back to Landing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ✅ KEY FIX: main is flex-1 min-h-0 so internal scroll works and bottom won't get cut */}
      <main className="flex-1 min-h-0 overflow-hidden px-5 md:px-8 xl:px-10 py-4 pt-[70px]">
        {/* Outer shell */}
        <div className="h-full rounded-3xl bg-white/90 backdrop-blur-sm border border-white/30 shadow-2xl overflow-hidden">
          {/* Two-column layout */}
          <div className="h-full grid grid-cols-1 xl:grid-cols-12 gap-0">
            {/* LEFT: scrollable sidebar */}
            <aside className="xl:col-span-3 h-full min-h-0 border-r border-slate-200/70 bg-white/60">
              <div className="h-full min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
                <Card>
                  <CardHeader title="Quick Actions" subtitle="Shortcuts for KTTM workflow" />
                  <div className="p-4 pt-0 space-y-3">
                    <Link
                      to="/IpAssets"
                      className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold text-white bg-slate-900 hover:bg-slate-800 transition"
                    >
                      Open Full List
                    </Link>

                    <button
                      type="button"
                      className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
                      onClick={() => window.alert("Export can be added later (CSV / PDF).")}
                    >
                      Export (Soon)
                    </button>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Chip>Search</Chip>
                      <Chip>Campus</Chip>
                      <Chip>Status</Chip>
                      <Chip>Calendar</Chip>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Filters" subtitle="Applies to analytics & calendar" />
                  <div className="p-4 pt-0 space-y-4 max-h-[500px] overflow-y-auto">
                   

                    <div>
                      <div className="text-[11px] font-semibold text-slate-500">IP TYPE</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["All", "Patent", "Utility Model", "Industrial Design", "Trademark", "Copyright"].map((t) => (
                          <ToggleButton key={t} active={type === t} onClick={() => setType(t)}>
                            {t}
                          </ToggleButton>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-500">STATUS</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["All", "Recently Filed", "Registered", "Unregistered", "Close to Expiration"].map((s) => (
                          <ToggleButton key={s} active={status === s} onClick={() => setStatus(s)}>
                            {s}
                          </ToggleButton>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] font-semibold text-slate-600 mb-2">LEGEND</div>
                      <div className="flex flex-wrap gap-2">
                        <TypePill type="Patent" />
                        <TypePill type="Utility Model" />
                        <TypePill type="Industrial Design" />
                        <TypePill type="Trademark" />
                        <TypePill type="Copyright" />
                      </div>
                      <div className="mt-3 text-[11px] text-slate-600">
                        <b>Calendar note:</b> “Recently Filed” has no renewal/expiry schedule until registered.
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </aside>

            {/* RIGHT: fixed top + scroll body */}
            <section className="xl:col-span-9 h-full min-h-0 overflow-hidden flex flex-col">
              {/* Fixed top strip */}
              <div className="shrink-0 p-4 border-b border-slate-200/70 bg-white/70">
                {loading && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600 mb-3">
                    Loading analytics from database...
                  </div>
                )}
                {errMsg && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">
                    {errMsg}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Metric title="Records (Filtered)" value={analytics.total} />
                  <Metric title="Registered" value={analytics.byStatus.Registered} />
                  <Metric title="Unregistered" value={analytics.byStatus.Unregistered} />
                  <Metric title="Selected Type" value={type} text />
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold">Status Overview</div>
                      <div className="text-xs text-slate-500">Distribution under current filters</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <MiniStat label="Recently Filed" value={analytics.byStatus["Recently Filed"]} pct={filedPct} tone="info" />
                      <MiniStat label="Registered" value={analytics.byStatus.Registered} pct={regPct} tone="good" />
                      <MiniStat label="Unregistered" value={analytics.byStatus.Unregistered} pct={unregPct} tone="danger" />
                      <MiniStat label="Close to Exp." value={analytics.byStatus["Close to Expiration"]} pct={closePct} tone="warn" />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Progress label="Registered" pct={regPct} tone="good" />
                    <Progress label="Unregistered" pct={unregPct} tone="danger" />
                    <Progress label="Recently Filed" pct={filedPct} tone="info" />
                    <Progress label="Close to Expiration" pct={closePct} tone="warn" />
                  </div>
                </div>
              </div>

              {/* ✅ This is the only scrollbar for the RIGHT content */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* ✅ Calendar: NO internal scrollbar now */}
                  <div className="lg:col-span-7">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold">IP Calendar</div>
                          <div className="text-xs text-slate-500 line-clamp-2">
                            Renewal (Next Due) + Expiry based on date_registered + IP type.
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCalCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                            className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold"
                          >
                            ←
                          </button>
                          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800">
                            {calLabel}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCalCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                            className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      {/* ✅ Removed overflow-y-auto here */}
                      <div className="p-4">
                        <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold text-slate-500 mb-2">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                            <div key={d} className="text-center">
                              {d}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                          {calGrid.map((cell) => {
                            const dateKey = cell.dateKey;
                            const items = calendarEvents.get(dateKey) || [];
                            const isToday = dateKey === formatDateISO(startOfDay(new Date()));
                            const dim = !cell.inMonth;

                            return (
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => openDayModal(dateKey)}
                                className={[
                                  "rounded-xl border p-2 text-left min-h-[78px] transition",
                                  "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-inset",
                                  isToday ? "border-slate-900" : "border-slate-200",
                                  dim ? "bg-slate-50/60 text-slate-400" : "bg-white text-slate-800",
                                ].join(" ")}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className={["text-xs font-bold", dim ? "text-slate-400" : "text-slate-800"].join(" ")}>
                                    {cell.day}
                                  </div>
                                  {items.length > 0 && (
                                    <div className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                      {items.length}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-2 space-y-1">
                                  {items.slice(0, 1).map((ev, idx) => (
                                    <div
                                      key={idx}
                                      className={[
                                        "text-[11px] px-2 py-1 rounded-lg border truncate",
                                        ev.kind === "expiry"
                                          ? "bg-red-50 text-red-700 border-red-200"
                                          : "bg-amber-50 text-amber-800 border-amber-200",
                                      ].join(" ")}
                                    >
                                      {ev.kind === "expiry" ? "Expiry" : "Due"}: {ev.title}
                                    </div>
                                  ))}
                                  {items.length > 1 && <div className="text-[11px] text-slate-500">+{items.length - 1} more</div>}
                                  {!items.length && <div className="text-[11px] text-slate-400">—</div>}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Due
                          </span>
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Expiry
                          </span>
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                            Tip: click a date
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Upcoming Events: keep internal scroll (your choice) */}
                  <div className="lg:col-span-5">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[560px]">
                      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-slate-900">Upcoming Events</div>
                            <div className="text-xs text-slate-500 mt-0.5">Click to jump to calendar date</div>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {upcomingEvents.length} item{upcomingEvents.length === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Expiry
                          </span>
                          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Due
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto">
                        {upcomingEvents.length === 0 ? (
                          <div className="p-5 text-sm text-slate-500">No upcoming events.</div>
                        ) : (
                          <div className="divide-y divide-slate-200">
                            {upcomingEvents.map((ev, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => jumpToDateAndOpenModal(ev.dateKey)}
                                className="w-full p-3 text-left hover:bg-blue-50 transition border-l-4 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-inset"
                                style={{
                                  borderLeftColor: ev.kind === "expiry" ? "rgb(239, 68, 68)" : "rgb(217, 119, 6)",
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold text-blue-700">
                                      {ev.eventDate.toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </div>

                                    <div className="mt-0.5 text-sm font-semibold text-slate-900 truncate">{ev.title}</div>

                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                      <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">
                                        {ev.type}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">
                                        {ev.campus}
                                      </span>
                                    </div>
                                  </div>

                                  <span
                                    className={[
                                      "inline-flex h-7 items-center px-2.5 rounded-full text-[11px] font-semibold border",
                                      ev.kind === "expiry"
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-amber-50 text-amber-800 border-amber-200",
                                    ].join(" ")}
                                  >
                                    {ev.kind === "expiry" ? "Expiry" : "Due"}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-3 border-t border-slate-200 bg-white">
                        <div className="text-[11px] text-slate-500">Tip: Use filters to narrow calendar + events.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Campuses + Gender */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div>
                      <div className="text-sm font-bold">Top Campuses</div>
                      <div className="text-xs text-slate-500">Most records by campus</div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {analytics.topLocations.length === 0 ? (
                        <div className="text-sm text-slate-600">No campus data yet.</div>
                      ) : (
                        analytics.topLocations.map((x) => {
                          const max = Math.max(1, ...analytics.topLocations.map((t) => t.value));
                          const w = Math.round((x.value / max) * 100);
                          return (
                            <div key={x.label} className="flex items-center gap-3">
                              <div className="w-36 text-[11px] font-semibold text-slate-700 truncate">{x.label}</div>
                              <div className="flex-1 h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                                <div className="h-full bg-slate-500/80" style={{ width: `${w}%` }} />
                              </div>
                              <div className="w-10 text-right text-xs font-bold text-slate-700">{x.value}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold">Gender Breakdown</div>
                        <div className="text-xs text-slate-500">Contributors by gender</div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {genderLoading
                          ? "Loading..."
                          : `${(genderStats || []).reduce((s, x) => s + (x.contributor_count || 0), 0)} contributors`}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {genderErr ? (
                        <div className="text-sm text-red-600">{genderErr}</div>
                      ) : (function () {
                          const male = Number(
                            (genderStats.find((g) => String(g.gender).toLowerCase() === "male") || {}).contributor_count || 0
                          );
                          const female = Number(
                            (genderStats.find((g) => String(g.gender).toLowerCase() === "female") || {}).contributor_count || 0
                          );
                          const other = Number(
                            (genderStats.find((g) => !["male", "female"].includes(String(g.gender).toLowerCase())) || {}).contributor_count || 0
                          );

                          const total = male + female + other;
                          const pctOf = (n) => (total === 0 ? 0 : Math.round((n / total) * 100));
                          const majority =
                            total === 0 ? "No data" : male === female && male > 0 ? "Tie" : male > female ? "Male" : "Female";

                          return (
                            <>
                              <BarRow label="Male" value={male} pct={pctOf(male)} tone="good" />
                              <BarRow label="Female" value={female} pct={pctOf(female)} tone="accent" />
                              {other > 0 && <BarRow label="Other" value={other} pct={pctOf(other)} tone="warn" />}

                              <div className="mt-2 text-xs text-slate-600">
                                Majority: <span className="font-semibold text-slate-800">{majority}</span>
                              </div>
                            </>
                          );
                        })()}
                    </div>
                  </div>
                </div>

                {/* Records by IP Type */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">Records by IP Type</div>
                      <div className="text-xs text-slate-500">Distribution under current filters</div>
                    </div>
                    <div className="text-xs text-slate-500">Total: {analytics.total}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <TypeCard label="Patent" value={analytics.byType.Patent} />
                    <TypeCard label="Utility Model" value={analytics.byType["Utility Model"]} />
                    <TypeCard label="Industrial Design" value={analytics.byType["Industrial Design"]} />
                    <TypeCard label="Trademark" value={analytics.byType.Trademark} />
                    <TypeCard label="Copyright" value={analytics.byType.Copyright} />
                  </div>
                </div>

                {/* Registrations Over Time + Registrations Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div>
                      <div className="text-sm font-bold">Registrations Over Time</div>
                      <div className="text-xs text-slate-500">Last 6 months (date_registered)</div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {analytics.byMonth.map((m) => {
                        const w = Math.round((m.count / maxMonth) * 100);
                        return (
                          <div key={m.key} className="flex items-center gap-3">
                            <div className="w-20 text-[11px] font-semibold text-slate-600">{m.label}</div>
                            <div className="flex-1 h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                              <div className="h-full bg-slate-500/80" style={{ width: `${w}%` }} />
                            </div>
                            <div className="w-10 text-right text-xs font-bold text-slate-700">{m.count}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500">
                      If date_registered is missing/invalid, it won’t be counted here.
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-sm font-bold">Registrations Analytics</div>
                        <div className="text-xs text-slate-500">By Year or IP Type</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAnalyticsView("year")}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                            analyticsView === "year"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                          type="button"
                        >
                          By Year
                        </button>
                        <button
                          onClick={() => setAnalyticsView("ipType")}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                            analyticsView === "ipType"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                          type="button"
                        >
                          By Type
                        </button>
                      </div>
                    </div>

                    <div className="relative overflow-hidden">
                      <div
                        className={`flex transition-transform duration-500 ease-in-out ${
                          analyticsView === "year" ? "translate-x-0" : "-translate-x-1/2"
                        }`}
                        style={{ width: "200%" }}
                      >
                        <div className="w-1/2 pr-2">
                          <div className="space-y-3">
                            {analytics.byYear.length === 0 ? (
                              <div className="text-sm text-slate-600">No registration data yet.</div>
                            ) : (
                              analytics.byYear.map((x) => {
                                const w = Math.round((x.value / maxYear) * 100);
                                return (
                                  <div key={x.label} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="font-semibold text-slate-700">{x.label}</div>
                                      <div className="font-bold text-slate-800">{x.value}</div>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                                      <div className="h-full bg-indigo-500/80" style={{ width: `${w}%` }} />
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="w-1/2 pl-2">
                          <div className="space-y-4">
                            {analytics.byYearAndType.length === 0 ? (
                              <div className="text-sm text-slate-600">No registration data yet.</div>
                            ) : (
                              analytics.byYearAndType.map((yearData) => {
                                const maxInYear = Math.max(1, ...Object.values(yearData.breakdown));
                                return (
                                  <div key={yearData.year} className="border-t border-slate-100 pt-3">
                                    <div className="text-xs font-bold text-slate-800 mb-2">{yearData.year}</div>
                                    <div className="space-y-2">
                                      {Object.entries(yearData.breakdown).map(([ipType, count]) =>
                                        count > 0 ? (
                                          <div key={ipType} className="flex items-center gap-2">
                                            <div className="w-20 text-[10px] font-semibold text-slate-600 truncate">
                                              {ipType}
                                            </div>
                                            <div className="flex-1 h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                                              <div
                                                className="h-full bg-slate-400/80"
                                                style={{ width: `${Math.round((count / maxInYear) * 100)}%` }}
                                              />
                                            </div>
                                            <div className="w-6 text-right text-[10px] font-bold text-slate-700">
                                              {count}
                                            </div>
                                          </div>
                                        ) : null
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500">
                      {analyticsView === "year"
                        ? "Shows total registrations per year based on date_registered."
                        : "Shows registrations breakdown by IP type per year."}
                    </div>
                  </div>
                </div>

                {/* ✅ Footer won't get cut now; right column scroll reaches it */}
                <div className="text-center text-xs text-slate-500 py-6">
                  © {new Date().getFullYear()} KTTM Unit · Dashboard Analytics
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Calendar Day Modal */}
      {dayModal.open && (
        <Modal onClose={closeDayModal}>
          <div className="text-lg font-black text-slate-900">Events · {prettyDate(dayModal.dateKey)}</div>
          <div className="text-sm text-slate-600 mt-1">
            Renewal (Due) and Expiry reminders based on your computed rules.
          </div>

          <div className="mt-5 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {dayModal.items.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No events for this date.
              </div>
            ) : (
              dayModal.items.map((ev, idx) => (
                <div
                  key={idx}
                  className={[
                    "rounded-2xl border p-4",
                    ev.kind === "expiry" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-700">{ev.kind === "expiry" ? "EXPIRY" : "RENEWAL / DUE"}</div>
                      <div className="mt-1 font-black text-slate-900 truncate">{safeText(ev.title)}</div>
                      <div className="mt-1 text-xs text-slate-700">
                        <b>ID:</b> {safeText(ev.ipId)} · <b>Campus:</b> {safeText(ev.campus)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TypePill type={ev.type} />
                      <StatusPill status={ev.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={closeDayModal}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- calendar + IP scheduling helpers ---------- */

function computeNextDueLabel(r) {
  const st = String(r.status || "").trim();
  if (st === "Recently Filed") return "Not registered yet";
  const reg = parseDateFlexible(r.regDate);
  if (!reg) return "—";
  const d = computeNextDueDate(r.type, reg);
  if (!d) return "No renewal";
  return formatDateISO(d);
}

function computeExpiryLabel(r) {
  const st = String(r.status || "").trim();
  if (st === "Recently Filed") return "Not registered yet";
  const reg = parseDateFlexible(r.regDate);
  if (!reg) return "—";
  const d = computeExpiryDate(r.type, reg);
  if (!d) return "No expiry";
  return formatDateISO(d);
}

function computeNextDueDate(ipType, regDate) {
  const t = String(ipType || "").trim();
  if (!regDate) return null;

  if (t === "Trademark") return addYears(regDate, 10);
  if (t === "Industrial Design") return addYears(regDate, 5);
  if (t === "Patent") return addYears(regDate, 1);
  if (t === "Utility Model") return addYears(regDate, 7);
  if (t === "Copyright") return null;

  return null;
}

function computeExpiryDate(ipType, regDate) {
  const t = String(ipType || "").trim();
  if (!regDate) return null;

  if (t === "Patent") return addYears(regDate, 20);
  if (t === "Utility Model") return addYears(regDate, 7);
  if (t === "Industrial Design") return addYears(regDate, 15);
  if (t === "Trademark") return addYears(regDate, 10);
  if (t === "Copyright") return null;

  return null;
}

function buildCalendarGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const start = new Date(year, month, 1 - startDay);

  const out = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push({
      day: d.getDate(),
      dateKey: formatDateISO(startOfDay(d)),
      inMonth: d.getMonth() === month,
    });
  }
  return out;
}

/* ---------- general helpers ---------- */

function safeText(v) {
  const s = String(v ?? "").trim();
  return !s || s === "—" ? "—" : s;
}

function prettyDate(dateKey) {
  const d = parseDateFlexible(dateKey);
  if (!d) return dateKey;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatShortDate(v) {
  const d = parseDateFlexible(v);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function parseDateFlexible(v) {
  const s = String(v ?? "").trim();
  if (!s || s === "—") return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function formatDateISO(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildMonthBuckets(monthsBack) {
  const out = [];
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    out.push({ key, label });
  }
  return out;
}

/* ---------- Small components ---------- */

function Card({ children }) {
  return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">{children}</div>;
}

function CardHeader({ title, subtitle }) {
  return (
    <div className="p-5 border-b border-slate-200">
      <div className="text-xs font-semibold text-slate-500">{String(title || "").toUpperCase()}</div>
      {subtitle && <div className="mt-1 text-sm font-bold text-slate-900">{subtitle}</div>}
    </div>
  );
}

function Metric({ title, value, text }) {
  const colorMap = {
    "Records (Filtered)": "bg-slate-100 border-slate-300",
    Registered: "bg-emerald-100 border-emerald-300",
    Unregistered: "bg-red-100 border-red-300",
    "Selected Type": "bg-violet-100 border-violet-300",
  };

  const textColorMap = {
    "Records (Filtered)": "text-slate-900",
    Registered: "text-emerald-900",
    Unregistered: "text-red-900",
    "Selected Type": "text-violet-900",
  };

  const labelColorMap = {
    "Records (Filtered)": "text-slate-700",
    Registered: "text-emerald-700",
    Unregistered: "text-red-700",
    "Selected Type": "text-violet-700",
  };

  const bgStyle = colorMap[title] || "bg-white border-slate-200";
  const textStyle = textColorMap[title] || "text-slate-900";
  const labelStyle = labelColorMap[title] || "text-slate-600";

  return (
    <div className={`rounded-2xl border-2 ${bgStyle} shadow-sm p-4`}>
      <div className={`text-[11px] font-bold ${labelStyle}`}>{title}</div>
      <div className={"mt-2 font-black " + (text ? "text-xl" : "text-3xl") + " " + textStyle}>{value}</div>
    </div>
  );
}

function ToggleButton({ children, active, onClick }) {
  const colorMap = {
    Patent: {
      active: "bg-indigo-600 text-white border-indigo-600",
      inactive: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    "Utility Model": {
      active: "bg-cyan-600 text-white border-cyan-600",
      inactive: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    "Industrial Design": {
      active: "bg-fuchsia-600 text-white border-fuchsia-600",
      inactive: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    },
    Trademark: {
      active: "bg-rose-600 text-white border-rose-600",
      inactive: "bg-rose-50 text-rose-700 border-rose-200",
    },
    Copyright: {
      active: "bg-amber-600 text-white border-amber-600",
      inactive: "bg-amber-50 text-amber-800 border-amber-200",
    },

    "Recently Filed": {
      active: "bg-sky-600 text-white border-sky-600",
      inactive: "bg-sky-50 text-sky-700 border-sky-200",
    },
    Registered: {
      active: "bg-emerald-600 text-white border-emerald-600",
      inactive: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    Unregistered: {
      active: "bg-red-600 text-white border-red-600",
      inactive: "bg-red-50 text-red-700 border-red-200",
    },
    "Close to Expiration": {
      active: "bg-amber-600 text-white border-amber-600",
      inactive: "bg-amber-50 text-amber-800 border-amber-200",
    },

    All: {
      active: "bg-slate-900 text-white border-slate-900",
      inactive: "bg-white text-slate-700 border-slate-200",
    },
  };

  const styles = colorMap[children] || colorMap.All;
  const buttonStyle = active ? styles.active : styles.inactive;

  return (
    <button type="button" onClick={onClick} className={`px-3 py-2 rounded-xl text-sm font-semibold border transition ${buttonStyle}`}>
      {children}
    </button>
  );
}

function BarRow({ label, value, pct, tone }) {
  const barTone =
    tone === "good"
      ? "bg-emerald-500/80"
      : tone === "warn"
      ? "bg-amber-500/80"
      : tone === "danger"
      ? "bg-red-500/80"
      : tone === "accent"
      ? "bg-sky-500/80"
      : "bg-slate-500/80";

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="font-semibold">{label}</div>
        <div>
          <span className="font-bold text-slate-800">{value}</span> · {pct}%
        </div>
      </div>

      <div className="mt-1 h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
        <div className={"h-full " + barTone} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles =
    status === "Registered"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "Unregistered"
      ? "bg-red-50 text-red-700 border-red-200"
      : status === "Recently Filed"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : status === "Close to Expiration"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles}`}>
      {status || "—"}
    </span>
  );
}

function TypeCard({ label, value }) {
  const colorMap = {
    Patent: "bg-indigo-50 border-indigo-200",
    "Utility Model": "bg-cyan-50 border-cyan-200",
    "Industrial Design": "bg-fuchsia-50 border-fuchsia-200",
    Trademark: "bg-rose-50 border-rose-200",
    Copyright: "bg-amber-50 border-amber-200",
  };

  const textColorMap = {
    Patent: "text-indigo-700",
    "Utility Model": "text-cyan-700",
    "Industrial Design": "text-fuchsia-700",
    Trademark: "text-rose-700",
    Copyright: "text-amber-800",
  };

  const bgStyle = colorMap[label] || "bg-slate-50 border-slate-200";
  const textStyle = textColorMap[label] || "text-slate-700";

  return (
    <div className={`rounded-2xl border ${bgStyle} p-4`}>
      <div className={`text-xs font-semibold ${textStyle}`}>{label}</div>
      <div className={`mt-1 text-2xl font-black ${textStyle}`}>{value}</div>
    </div>
  );
}

function TypePill({ type }) {
  const map = {
    Patent: "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Utility Model": "bg-cyan-50 text-cyan-700 border-cyan-200",
    "Industrial Design": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    Trademark: "bg-rose-50 text-rose-700 border-rose-200",
    Copyright: "bg-amber-50 text-amber-800 border-amber-200",
  };

  const styles = map[type] ?? "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles}`} title={type}>
      {type || "—"}
    </span>
  );
}

function Chip({ children }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 text-center">
      {children}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --- Added small UI helpers --- */

function MiniStat({ label, value, pct, tone }) {
  const toneStyles =
    tone === "good"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "warn"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : tone === "danger"
      ? "bg-red-50 border-red-200 text-red-800"
      : tone === "info"
      ? "bg-sky-50 border-sky-200 text-sky-800"
      : "bg-slate-50 border-slate-200 text-slate-800";

  return (
    <div className={`px-3 py-2 rounded-xl border ${toneStyles}`}>
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <div className="text-sm font-black">{value}</div>
        <div className="text-[11px] font-semibold opacity-70">{pct}%</div>
      </div>
    </div>
  );
}

function Progress({ label, pct, tone }) {
  const bar =
    tone === "good"
      ? "bg-emerald-500/80"
      : tone === "warn"
      ? "bg-amber-500/80"
      : tone === "danger"
      ? "bg-red-500/80"
      : tone === "info"
      ? "bg-sky-500/80"
      : "bg-slate-500/80";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-center justify-between text-xs">
        <div className="font-semibold text-slate-700">{label}</div>
        <div className="font-bold text-slate-800">{pct}%</div>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-white border border-slate-200 overflow-hidden">
        <div className={"h-full " + bar} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
