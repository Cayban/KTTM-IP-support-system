import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

export default function KttmLandingPage() {
  const [now, setNow] = useState(() => new Date());

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

  return (
    <div
      className="min-h-screen text-slate-900 bg-cover bg-center"
      style={{ backgroundImage: "url('/bsuBG.jpg')" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20">
        <div className="backdrop-blur-md bg-slate-950/55 border-b border-white/10">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                  <img
                    src="/kttm.jpg"
                    alt="KTTM Logo"
                    className="h-full w-full object-contain scale-125"
                  />
                </div>

                <div className="leading-tight">
                  <div className="text-white text-lg sm:text-xl font-black">
                    Knowledge Technology Transfer Management Unit
                  </div>
                  <div className="text-white/75 text-xs sm:text-sm">
                    KTTM Assistant Directors office
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                <span className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15">
                  {dateStr}
                </span>
                <span className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15">
                  {timeStr}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-6 min-h-[calc(100vh-88px)]">
        <div className="min-h-[calc(100vh-88px)] rounded-3xl bg-white/85 backdrop-blur-sm border border-white/30 shadow-2xl p-4 sm:p-6">
          <div className="h-full grid lg:grid-cols-12 gap-6">
            {/* Sidebar (UNCHANGED) */}
            <aside className="lg:col-span-4">
              <div className="h-full overflow-auto pr-1">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-200">
                    <div className="text-xs font-semibold text-slate-500">
                      QUICK ACTIONS
                    </div>

                    <div className="mt-3 grid gap-2">
                      <Link
                        to="/kttmHome"
                        className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
                      >
                        Login
                      </Link>

                      <Link
                        to="/request-access"
                        className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                      >
                        Request Access
                      </Link>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Chip>Search</Chip>
                      <Chip>Track</Chip>
                      <Chip>Campus</Chip>
                      <Chip>Reports</Chip>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-sm font-bold text-slate-900">
                      Purpose of the system
                    </div>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      Manage IP records using standard fields, search quickly,
                      and generate reports by campus, category, and status.
                      Contributor details are stored separately for analytics and
                      participation reporting.
                    </p>

                    <div className="mt-4 grid gap-3">
                      <InfoRow label="Primary Use" value="IP Records + Reporting" />
                      <InfoRow label="Unit" value="KTTM / RMS" />
                      <InfoRow label="Access" value="Role-based (Admin/Staff)" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="text-sm font-bold">Need help finding a record?</div>
                  <p className="mt-2 text-sm text-slate-600">
                    Search by title, campus, IP type, status, or record ID. For
                    contributor reports, use the analytics dashboard.
                  </p>
                  <div className="mt-3 text-xs text-slate-500">
                    Tip: Use standard IP types (Patent / Utility Model /
                    Industrial Design / Copyright).
                  </div>
                </div>
              </div>
            </aside>

            {/* Content (RIGHT SIDE REDESIGNED — COMPACT) */}
            <section className="lg:col-span-8 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* HERO (compact) */}
                <div className="p-6 sm:p-8 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        KTTM IP RECORDS TRACKING
                      </div>
                      <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                        Track IP records faster with clean, standardized data.
                      </h1>
                      <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
                        Search by title, campus, and IP type; monitor status;
                        and generate reports for KTTM/RMS. Full features are
                        inside the dashboard after login.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Pill>Fast Search</Pill>
                      <Pill>Status Tracking</Pill>
                      <Pill>Campus Reports</Pill>
                      <Pill>Contributor Analytics</Pill>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/IpAssets"
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 transition text-white font-semibold text-sm"
                      >
                        Open Dashboard Search
                      </Link>
                      <Link
                        to="/about"
                        className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-700 font-semibold text-sm"
                      >
                        Learn More
                      </Link>
                    </div>
                  </div>
                </div>

                {/* BODY (compact two-column cards; no long list) */}
                <div className="p-6 sm:p-8 flex-1">
                  <div className="grid lg:grid-cols-12 gap-6 items-start">
                    {/* Left: What you can do */}
                    <div className="lg:col-span-7">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">
                              What you can do inside the system
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Core functions for records and reporting.
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid sm:grid-cols-2 gap-3">
                          <Feature
                            title="Search & Filter"
                            desc="Title, campus, IP type, status, record ID."
                          />
                          <Feature
                            title="Contributors"
                            desc="Maintain inventor/applicant info for analytics."
                          />
                          <Feature
                            title="Reports"
                            desc="Summaries by campus, IP type, and status."
                          />
                          <Feature
                            title="Standardization"
                            desc="Consistent IP types + clean status labels."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Status guide */}
                    <div className="lg:col-span-5">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            Status guide
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Short reference (compact).
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <StatusCard
                            status="Registered"
                            tone="success"
                            desc="Filed/registered and active."
                          />
                          <StatusCard
                            status="Recently Filed"
                            tone="info"
                            desc="Newly filed; monitor updates."
                          />
                          <StatusCard
                            status="Close to Expiration"
                            tone="warn"
                            desc="Needs review/renewal soon."
                          />
                          <StatusCard
                            status="Unregistered"
                            tone="muted"
                            desc="Not yet filed; for follow-up."
                          />
                        </div>

                        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                          <div className="text-xs font-semibold text-slate-700">
                            Suggested IP Types
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <TypePill>Patent</TypePill>
                            <TypePill>Utility Model</TypePill>
                            <TypePill>Industrial Design</TypePill>
                            <TypePill>Copyright</TypePill>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 sm:px-8 py-4 text-center text-xs text-slate-500 border-t border-slate-200">
                  © {new Date().getFullYear()} KTTM Unit · IP Records Tracking System
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Small components ---------- */

function Chip({ children }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 text-center">
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-xs font-bold text-slate-800">{value}</div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-600 leading-relaxed">{desc}</div>
    </div>
  );
}

function TypePill({ children }) {
  return (
    <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

/* ✅ FIXED: StatusCard layout (handles long titles cleanly) */
function StatusCard({ status, desc, tone }) {
  const toneStyles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "info"
      ? "border-blue-200 bg-blue-50/60"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50/60"
      : "border-slate-200 bg-slate-50";

  return (
    <div className={`rounded-2xl border p-4 ${toneStyles}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900 leading-snug">
            {status}
          </div>
        </div>

        <div className="shrink-0">
          <StatusPillNew status={status} />
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-600 leading-relaxed">{desc}</div>
    </div>
  );
}

function StatusPillNew({ status }) {
  const styles =
    status === "Registered"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "Recently Filed"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : status === "Close to Expiration"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${styles}`}
    >
      {status}
    </span>
  );
}
