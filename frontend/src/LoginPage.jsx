import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import rmsLogo from "./assets/rmslogo.png";
import kttmLogo from "./assets/KTTM.jpg";

export default function KttmLandingPage() {
  const [now, setNow] = useState(() => new Date());

  // ✅ plaque modal
  const [openPlaque, setOpenPlaque] = useState(false);

  // ✅ Quick summary (replace with real API later if you want)
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryErr, setSummaryErr] = useState("");
  const [summary, setSummary] = useState({
    total: 248,
    registered: 163,
    recentlyFiled: 29,
    closeToExpiration: 14,
    unregistered: 42,
    topCampus: "Alangilan",
    lastUpdated: new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),
  });

  // ✅ Status distribution data for the chart
  const [statusDistribution] = useState([
    { name: "Registered", value: 163, fill: "#10b981" },
    { name: "Recently Filed", value: 29, fill: "#3b82f6" },
    { name: "Close to Expiration", value: 14, fill: "#f59e0b" },
    { name: "Unregistered", value: 42, fill: "#cbd5e1" },
  ]);

  const totalForChart = useMemo(
    () => statusDistribution.reduce((sum, s) => sum + (s.value || 0), 0),
    [statusDistribution]
  );

  // clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ OPTIONAL: demo load (swap to your real endpoint if you have one)
  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      try {
        setSummaryLoading(true);
        setSummaryErr("");

        const fake = {
          total: 248,
          registered: 163,
          recentlyFiled: 29,
          closeToExpiration: 14,
          unregistered: 42,
          topCampus: "Alangilan",
          lastUpdated: new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          }),
        };

        if (mounted) setSummary(fake);
      } catch (e) {
        if (mounted) setSummaryErr(e?.message || "Error loading summary");
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    }

    loadSummary();
    return () => {
      mounted = false;
    };
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

  return (
    <div className="min-h-screen bg-[url('/bsuBG.jpg')] bg-cover bg-center text-slate-900">
      {/* TOP BAR (kept) */}
      <header className="sticky top-0 z-40">
        <div className="bg-slate-950/60 backdrop-blur-xl border-b border-white/10">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shadow-sm">
                  <img
                    src={rmsLogo}
                    alt="RMS Logo"
                    className="h-full w-full object-contain scale-125"
                  />
                </div>

                <div className="min-w-0 leading-tight">
                  <div className="text-white text-base sm:text-lg font-black truncate">
                    Knowledge Technology Transfer Management Unit
                  </div>
                  <div className="text-white/70 text-xs sm:text-sm truncate">
                    KTTM Assistant Directors office
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">
                  {dateStr}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">
                  {timeStr}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-6">
        {/* ✅ NEW DESIGN: split “hero banner” + “cards grid” (NOT the old glass frame) */}
        <div className="grid gap-6">
          {/* HERO BANNER (keep this style) */}
          <div className="rounded-3xl border border-white/30 bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/90">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  KTTM · IP Records Tracking
                </div>

                <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white leading-tight">
                  IP Records Tracking System
                </h1>

                <p className="mt-2 text-sm sm:text-base text-white/75 max-w-3xl">
                  Monitor IP records, statuses, and reporting in one place — then jump
                  into the dashboard for search, filters, and analytics.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <PillDark>Fast Search</PillDark>
                  <PillDark>Status Tracking</PillDark>
                  <PillDark>Campus Reports</PillDark>
                  <PillDark>Contributor Analytics</PillDark>
                </div>
              </div>

              {/* actions on hero */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <Link
                  to="/kttmHome"
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold text-slate-900 bg-white hover:bg-slate-100 transition"
                >
                  Login
                </Link>
                <Link
                  to="/request-access"
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/15 transition"
                >
                  Request Access
                </Link>
              </div>
            </div>

            {/* bottom “chips row” */}
            <div className="px-6 sm:px-8 pb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <HeroChip title="Search" desc="By title, campus, status" />
                <HeroChip title="Track" desc="Monitor deadlines & updates" />
                <HeroChip title="Campus" desc="Summaries by campus" />
                <HeroChip title="Reports" desc="Export-ready insights" />
              </div>
            </div>
          </div>

          {/* CONTENT GRID */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* LEFT: big “purpose” + plaque stacked */}
            <section className="lg:col-span-5 grid gap-6">
              {/* Purpose card */}
              <div className="rounded-3xl border border-white/35 bg-white/85 backdrop-blur-md shadow-xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      ABOUT THIS SYSTEM
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900">
                      Purpose of the system
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
                    Role-based
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Manage IP records using standard fields, search quickly, and generate
                  reports by campus, category, and status. Contributor details are
                  stored separately for analytics and participation reporting.
                </p>

                <div className="mt-5 grid gap-3">
                  <InfoRow label="Primary Use" value="IP Records + Reporting" />
                  <InfoRow label="Unit" value="KTTM / RMS" />
                  <InfoRow label="Access" value="Admin / Staff" />
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-900">
                    Need help finding a record?
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Search by title, campus, IP type, status, or record ID. For
                    contributor reports, use the analytics dashboard.
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Tip: Use standard IP types (Patent / Utility Model / Industrial
                    Design / Copyright).
                  </div>
                </div>
              </div>

              {/* Plaque card (more gallery-like) */}
              <div className="rounded-3xl border border-white/35 bg-white/85 backdrop-blur-md shadow-xl overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        ACKNOWLEDGEMENT
                      </div>
                      <div className="mt-1 text-lg font-black text-slate-900">
                        Facility Development Plaque
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        IP-TBM Office facility development plaque.
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-700 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
                      Official
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenPlaque(true)}
                  className="w-full text-left group"
                  title="Click to view larger"
                >
                  <div className="relative">
                    <img
                      src={kttmLogo}
                      alt="IP-TBM Office facility development plaque"
                      className="w-full h-64 object-cover object-top"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-transparent opacity-95" />
                    <div className="absolute inset-x-0 bottom-0 p-4 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">
                        View plaque
                      </div>
                      <div className="text-[11px] text-white/90 px-2 py-1 rounded-full bg-white/15 border border-white/20">
                        Click to zoom
                      </div>
                    </div>
                  </div>
                </button>

                <div className="px-6 pb-6 text-xs text-slate-500 leading-relaxed">
                  Displayed for transparency and recognition of supporting agencies.
                </div>
              </div>
            </section>

            {/* RIGHT: summary + workflow + chart */}
            <section className="lg:col-span-7 grid gap-6">
              {/* Summary card (different layout: “stats rail”) */}
              <div className="rounded-3xl border border-white/35 bg-white/85 backdrop-blur-md shadow-xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      QUICK SNAPSHOT
                    </div>
                    <div className="mt-1 text-lg font-black text-slate-900">
                      Quick Summary
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Snapshot of records and priority items.
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 text-right">
                    <div className="font-semibold">Last updated</div>
                    <div className="font-bold text-slate-700">
                      {summary.lastUpdated}
                    </div>
                  </div>
                </div>

                {summaryLoading && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Loading summary...
                  </div>
                )}

                {summaryErr && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {summaryErr}
                  </div>
                )}

                {/* new stat layout */}
                <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatTile label="Total" value={summary.total} />
                  <StatTile label="Registered" value={summary.registered} />
                  <StatTile label="Recently Filed" value={summary.recentlyFiled} />
                  <StatTile label="Close to Expiration" value={summary.closeToExpiration} />
                  <StatTile label="Unregistered" value={summary.unregistered} />
                  <StatTile label="Top Campus" value={summary.topCampus} />
                </div>
              </div>

              {/* Two-column: workflow + chart */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Workflow as “checklist” */}
                <div className="rounded-3xl border border-white/35 bg-white/85 backdrop-blur-md shadow-xl p-6">
                  <div className="text-xs font-semibold text-slate-500">
                    WORKFLOW
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-900">
                    How it works
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Simple workflow for KTTM tracking and reporting.
                  </div>

                  <div className="mt-5 grid gap-3">
                    <ChecklistItem
                      n="1"
                      title="Search a record"
                      desc="Find by title, campus, IP type, status, or record ID."
                    />
                    <ChecklistItem
                      n="2"
                      title="Check status"
                      desc="Identify what is active, newly filed, or needs follow-up."
                    />
                    <ChecklistItem
                      n="3"
                      title="Track priorities"
                      desc="Focus on expiring items and unregistered records first."
                    />
                    <ChecklistItem
                      n="4"
                      title="Generate reports"
                      desc="Summaries by campus, IP type, and status for KTTM/RMS."
                    />
                  </div>
                </div>

                {/* Chart card */}
                <div className="rounded-3xl border border-white/35 bg-white/85 backdrop-blur-md shadow-xl p-6 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-500">
                        CHART
                      </div>
                      <div className="mt-1 text-lg font-black text-slate-900">
                        Status Distribution
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Overview of all IP records by status.
                      </div>
                    </div>

                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700">
                      Total: {totalForChart}
                    </span>
                  </div>

                  <div className="mt-4 flex-1 min-h-[260px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={86}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="transparent"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} records`} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-[11px] font-semibold text-slate-500">
                          IP Records
                        </div>
                        <div className="mt-0.5 text-2xl font-black text-slate-900 leading-none">
                          {totalForChart}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          total count
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-2">
                      {statusDistribution.map((s) => {
                        const pct =
                          totalForChart > 0
                            ? Math.round((s.value / totalForChart) * 100)
                            : 0;

                        return (
                          <div
                            key={s.name}
                            className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: s.fill }}
                              />
                              <span className="font-semibold text-slate-700 truncate">
                                {s.name}
                              </span>
                            </div>
                            <span className="shrink-0 font-bold text-slate-700">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500">
                      Tip: Prioritize{" "}
                      <span className="font-semibold">Close to Expiration</span> and{" "}
                      <span className="font-semibold">Unregistered</span>.
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="rounded-3xl border border-white/35 bg-white/85 backdrop-blur-md shadow-xl px-6 py-4 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} KTTM Unit · IP Records Tracking System
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* ✅ Plaque modal */}
      {openPlaque && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Plaque image viewer"
        >
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpenPlaque(false)}
            aria-label="Close"
          />

          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-white/20 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-900 truncate">
                  IP-TBM Office Facility Development Plaque
                </div>
                <div className="text-xs text-slate-500">Click outside to close.</div>
              </div>

              <button
                onClick={() => setOpenPlaque(false)}
                className="shrink-0 px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>

            <div className="bg-slate-50 p-3 sm:p-4">
              <img
                src={kttmLogo}
                alt="IP-TBM Office facility development plaque (large)"
                className="w-full max-h-[78vh] object-contain rounded-2xl border border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Small components ---------- */

function PillDark({ children }) {
  return (
    <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function HeroChip({ title, desc }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
      <div className="text-sm font-black text-white">{title}</div>
      <div className="mt-0.5 text-xs text-white/70">{desc}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-xs font-bold text-slate-800">{value}</div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}

function ChecklistItem({ n, title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm font-black">
          {n}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{title}</div>
          <div className="mt-0.5 text-xs text-slate-600 leading-relaxed">
            {desc}
          </div>
        </div>
      </div>
    </div>
  );
}
