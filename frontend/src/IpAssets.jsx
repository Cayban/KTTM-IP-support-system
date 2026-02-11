// src/pages/IpAssetsPage.jsx
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export default function IpAssetsPage() {
  const [now, setNow] = useState(() => new Date());

  // Filters
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const [campusFilter, setCampusFilter] = useState("All");

  // Data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // Sorting (client-side)
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  // Sorting helpers (defined early so useEffect can call them)
  function sortRows(arr, field, dir) {
    if (!field) return arr;
    return [...arr].sort((a, b) => {
      const va = a[field] ?? "";
      const vb = b[field] ?? "";
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return dir === "asc" ? -1 : 1;
      if (sa > sb) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }

  function toggleSort(field) {
    let newDir = "asc";
    if (sortField === field) newDir = sortDir === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDir(newDir);
    setRows((curr) => sortRows(curr, field, newDir));
  }

  // Modal / Form
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [activeRow, setActiveRow] = useState(null);

  const [form, setForm] = useState({
    ip_type: "Patent",
    title: "",
    inventors: "",
    shil_id_number: "",
    registration_date: "",
    next_due_date: "", // renewal / due date (manual override)
    link: "", // gdrive link
    remarks: "Unregistered",
    campus: "",
  });

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

  const [campusOptions, setCampusOptions] = useState(["All"]);

  // Load full campus list once so the dropdown doesn't shrink when filtering
  useEffect(() => {
    let mounted = true;
    (async function fetchCampuses() {
      try {
        const params = new URLSearchParams();
        params.set("limit", "5000");
        params.set("offset", "0");
        const res = await fetch(`${API_BASE}/api/ipassets?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.ok) return;

        const s = new Set();
        (data.rows || []).forEach((r) => {
          const c = r.campus ?? r.location ?? null;
          if (c && String(c).trim() && String(c) !== "—") s.add(String(c));
        });

        if (!mounted) return;
        setCampusOptions(["All", ...Array.from(s).sort()]);
      } catch (e) {
        // ignore; campus dropdown remains at default
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load rows
  useEffect(() => {
    const ac = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setErrMsg("");

        const params = new URLSearchParams();
        if (type !== "All") params.set("type", type);
        if (campusFilter !== "All") params.set("campus", campusFilter);
        if (status !== "All") params.set("status", status);
        if (q.trim()) params.set("q", q.trim());
        params.set("limit", "1000");
        params.set("offset", "0");

        const res = await fetch(`${API_BASE}/api/ipassets?${params.toString()}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to load records");

        const mapped = (data.rows || []).map((r) => ({
          id: r.id,
          title: r.title ?? r.of_applicant ?? "",
          ip_type: r.ip_type ?? "",
          remarks: r.remarks ?? "",
          inventors: r.inventors ?? "",
          shil_id_number: r.shil_id_number ?? r.ipophil_id_number ?? r.ipophl_id ?? "—",
          registration_date: r.registration_date ?? "—",
          next_due_date: r.next_due_date ?? r.renewal_date ?? "—",
          link: r.gdrive_link ?? r.link ?? "—",
          campus: r.campus ?? r.location ?? "—",
        }));

        setRows(sortRows(mapped, sortField, sortDir));
      } catch (e) {
        if (e.name !== "AbortError") setErrMsg(e.message || "Error");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => ac.abort();
  }, [type, status, q, campusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Auto-compute next due date when IP type / registration date changes (only if empty)
  useEffect(() => {
    if (!modalOpen) return;

    const reg = parseDateFlexible(form.registration_date);
    if (!reg) return;

    // If user already typed a value, keep it
    if (String(form.next_due_date || "").trim()) return;

    // If status is Recently Filed, don't compute due date yet
    if (String(form.remarks || "").trim() === "Recently Filed") return;

    const computed = computeNextDueDate(form.ip_type, reg);
    if (computed) {
      setForm((f) => ({ ...f, next_due_date: formatDateISO(computed) }));
    }
  }, [modalOpen, form.ip_type, form.registration_date, form.remarks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers
  const openCreate = () => {
    const next = {
      ip_type: "Patent",
      title: "",
      inventors: "",
      shil_id_number: "",
      registration_date: "",
      next_due_date: "",
      link: "",
      remarks: "Unregistered",
      campus: "",
    };
    setMode("create");
    setActiveRow(null);
    setForm(next);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    const regVal = row.registration_date === "—" ? "" : row.registration_date;
    const regParsed = parseDateFlexible(regVal);
    const nextFromDb = row.next_due_date === "—" ? "" : row.next_due_date;

    // if DB has no next_due_date, compute it (except Recently Filed)
    const computed =
      String(row.remarks || "").trim() === "Recently Filed"
        ? ""
        : regParsed
        ? formatDateISO(computeNextDueDate(row.ip_type || "Patent", regParsed) || regParsed)
        : "";

    setMode("edit");
    setActiveRow(row);
    setForm({
      ip_type: row.ip_type || "Patent",
      title: row.title || "",
      inventors: row.inventors || "",
      shil_id_number: row.shil_id_number === "—" ? "" : row.shil_id_number,
      registration_date: regVal,
      next_due_date: nextFromDb || computed || "",
      link: row.link === "—" ? "" : row.link,
      remarks: row.remarks || "Unregistered",
      campus: row.campus === "—" ? "" : row.campus,
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  async function saveForm() {
    try {
      setErrMsg("");

      // NOTE:
      // If your backend uses gdrive_link, change `link: form.link` to `gdrive_link: form.link`
      const payload = {
        ip_type: form.ip_type,
        title: form.title,
        inventors: form.inventors,
        shil_id_number: form.shil_id_number,
        registration_date: form.registration_date,
        next_due_date: form.next_due_date,
        link: form.link,
        remarks: form.remarks,
        campus: form.campus,
      };

      if (mode === "create") {
        const res = await fetch(`${API_BASE}/api/ipassets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to create record");
      } else {
        const res = await fetch(`${API_BASE}/api/ipassets/${activeRow.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to update record");
      }

      closeModal();
      await reloadNow();
    } catch (e) {
      setErrMsg(e.message || "Save failed");
    }
  }

  async function reloadNow() {
    const params = new URLSearchParams();
    if (type !== "All") params.set("type", type);
    if (campusFilter !== "All") params.set("campus", campusFilter);
    if (status !== "All") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "1000");
    params.set("offset", "0");

    const res = await fetch(`${API_BASE}/api/ipassets?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to load records");

    const mapped = (data.rows || []).map((r) => ({
      id: r.id,
      title: r.title ?? r.of_applicant ?? "",
      ip_type: r.ip_type ?? "",
      remarks: r.remarks ?? "",
      inventors: r.inventors ?? "",
      shil_id_number: r.shil_id_number ?? r.ipophil_id_number ?? r.ipophl_id ?? "—",
      registration_date: r.registration_date ?? "—",
      next_due_date: r.next_due_date ?? r.renewal_date ?? "—",
      link: r.gdrive_link ?? r.link ?? "—",
      campus: r.campus ?? r.location ?? "—",
    }));

    setRows(sortRows(mapped, sortField, sortDir));
  }

  async function deleteRow(row) {
    const ok = window.confirm(`Delete this record?\n\n${row.title}`);
    if (!ok) return;

    try {
      setErrMsg("");

      const res = await fetch(`${API_BASE}/api/ipassets/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || "Failed to delete record");

      await reloadNow();
    } catch (e) {
      setErrMsg(e.message || "Delete failed");
    }
  }

  function exportCSV() {
    const header = [
      "Title",
      "Inventors",
      "IP Type",
      "Status",
      "IPOPHL ID",
      "Registration Date",
      "Next Due / Renewal Date",
      "Computed Next Due (if empty)",
      "Validity",
      "GDrive Link",
      "Campus",
    ];

    const lines = rows.map((r) => {
      const v = computeValidity(r);
      return [
        safeCSV(r.title),
        safeCSV(r.inventors),
        safeCSV(r.ip_type),
        safeCSV(r.remarks),
        safeCSV(r.shil_id_number),
        safeCSV(String(r.registration_date ?? "")),
        safeCSV(String(r.next_due_date ?? "")),
        safeCSV(getComputedNextDueString(r)),
        safeCSV(v.label),
        safeCSV(r.link),
        safeCSV(r.campus),
      ];
    });

    const csv = [header.join(","), ...lines.map((x) => x.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `kttm-ipassets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function safeCSV(v) {
    const s = String(v ?? "");
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  }

  function printTable() {
    window.print();
  }

  function printRecord(row) {
    const printWindow = window.open("", "", "height=700,width=900");
    const validity = computeValidity(row);
    const computedNextDue = getComputedNextDueString(row);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print - ${escapeHtml(row.title)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .record { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; }
            .value { font-size: 14px; margin-top: 4px; white-space: pre-wrap; }
            h1 { color: #1e293b; margin: 0 0 20px 0; text-align:center; }
            a { color: #2563eb; }
            .pill { display:inline-block; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; border:1px solid #ddd; }
            .ok { background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
            .soon { background:#fffbeb; border-color:#fde68a; color:#92400e; }
            .overdue { background:#fef2f2; border-color:#fecaca; color:#991b1b; }
            .note { font-size: 12px; color:#555; background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <h1>IP Asset Record</h1>
          <div class="record">
            <div class="note">
              <b>Note:</b> "Recently Filed" means not registered yet, so renewal/next due is not applicable until registration.
            </div>

            <div class="field">
              <div class="label">Title</div>
              <div class="value">${escapeHtml(row.title || "—")}</div>
            </div>

            <div class="field">
              <div class="label">Inventors / Applicants</div>
              <div class="value">${escapeHtml(row.inventors || "—")}</div>
            </div>

            <div class="field">
              <div class="label">IP Type</div>
              <div class="value">${escapeHtml(row.ip_type || "—")}</div>
            </div>

            <div class="field">
              <div class="label">Status</div>
              <div class="value">${escapeHtml(row.remarks || "—")}</div>
            </div>

            <div class="field">
              <div class="label">IPOPHL ID</div>
              <div class="value">${escapeHtml(row.shil_id_number || "—")}</div>
            </div>

            <div class="field">
              <div class="label">Registration Date</div>
              <div class="value">${escapeHtml(formatDate(row.registration_date))}</div>
            </div>

            <div class="field">
              <div class="label">Next Due / Renewal Date (Saved)</div>
              <div class="value">${escapeHtml(formatDate(row.next_due_date))}</div>
            </div>

            <div class="field">
              <div class="label">Next Due (Computed if Saved is empty)</div>
              <div class="value">${escapeHtml(computedNextDue || "—")}</div>
            </div>

            <div class="field">
              <div class="label">Validity</div>
              <div class="value">
                <span class="pill ${validity.tone}">${escapeHtml(validity.label)}</span>
              </div>
            </div>

            <div class="field">
              <div class="label">Campus</div>
              <div class="value">${escapeHtml(row.campus || "—")}</div>
            </div>

            <div class="field">
              <div class="label">Google Drive Link</div>
              <div class="value">${
                row.link && row.link !== "—"
                  ? `<a href="${escapeAttr(row.link)}" target="_blank" rel="noreferrer">${escapeHtml(
                      row.link
                    )}</a>`
                  : "—"
              }</div>
            </div>

            <div class="footer">
              © ${new Date().getFullYear()} KTTM Unit · Printed on ${new Date().toLocaleDateString()}
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  function formatDate(v) {
    if (!v || v === "—") return "—";
    try {
      const t = Date.parse(v);
      if (!Number.isFinite(t)) return String(v);
      const d = new Date(t);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return String(v);
    }
  }

  // ✅ Next Due rendering rules for the TABLE cell
  function renderNextDueCell(row) {
    const st = String(row.remarks || "").trim();

    // Recently Filed: not registered yet, so due schedule not applicable
    if (st === "Recently Filed") {
      return <span className="text-xs font-semibold text-slate-500">Not registered yet</span>;
    }

    // If due date is stored, show it
    const dueStored = parseDateFlexible(row.next_due_date);
    if (dueStored) return <span>{formatDateISO(dueStored)}</span>;

    // Otherwise compute
    const reg = parseDateFlexible(row.registration_date);
    if (!reg) return <span className="text-slate-400">—</span>;

    const computed = computeNextDueDate(row.ip_type, reg);
    if (!computed) return <span className="text-xs text-slate-500">No renewal</span>;

    return <span>{formatDateISO(computed)}</span>;
  }

  // Used for export/print: returns STRING
  function getComputedNextDueString(row) {
    const st = String(row.remarks || "").trim();
    if (st === "Recently Filed") return "Not registered yet";

    const dueStored = parseDateFlexible(row.next_due_date);
    if (dueStored) return formatDateISO(dueStored);

    const reg = parseDateFlexible(row.registration_date);
    if (!reg) return "";

    const computed = computeNextDueDate(row.ip_type, reg);
    if (!computed) return "No renewal";

    return formatDateISO(computed);
  }

  // ✅ Validity logic (renewal/expiry)
  function computeValidity(row) {
    const today = startOfDay(new Date());

    const st = String(row.remarks || "").trim();
    if (st === "Recently Filed") {
      return { label: "Not registered yet", tone: "soon" };
    }

    const ipType = row.ip_type || "";
    const reg = parseDateFlexible(row.registration_date);
    const dueFromDb = parseDateFlexible(row.next_due_date);

    const due = dueFromDb || (reg ? computeNextDueDate(ipType, reg) : null);
    const expiry = reg ? computeExpiryDate(ipType, reg) : null;

    if (expiry && startOfDay(expiry) < today) return { label: "Expired", tone: "overdue" };
    if (!due) return { label: "No schedule", tone: "ok" };

    const daysLeft = Math.ceil((startOfDay(due) - today) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Overdue", tone: "overdue" };
    if (daysLeft <= 90) return { label: `Due soon (${daysLeft}d)`, tone: "soon" };
    return { label: `OK (${daysLeft}d)`, tone: "ok" };
  }

  function formatInventors(v) {
    const s = String(v ?? "").trim();
    if (!s) return "—";
    if (s.includes(",")) {
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .join("\n");
    }
    return s;
  }

  // ✅ Date helpers
  function parseDateFlexible(v) {
    const s = String(v ?? "").trim();
    if (!s || s === "—") return null;

    // ISO date: 2024-09-27
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

  /**
   * ✅ Next Due / Renewal logic (simple & practical)
   * - Trademark: renewal cycle every 10 years
   * - Industrial Design: renew every 5 years (up to 15 total) → show next 5-year renewal
   * - Patent: maintenance/annuity reminder yearly (simple)
   * - Utility Model: term is limited → show "review/expiry" at 7 years
   * - Copyright: usually no renewal schedule → null
   */
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

  /**
   * ✅ Expiry estimation (simple reminders; real-world rules can be more detailed)
   * - Patent: ~20 years
   * - Utility Model: 7 years
   * - Industrial Design: 15 years max
   * - Trademark: end of current 10-year cycle
   * - Copyright: not handled here
   */
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

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(str) {
    return String(str ?? "").replaceAll('"', "%22");
  }

  return (
    <div className="h-screen overflow-hidden text-slate-900 bg-cover bg-center" style={{ backgroundImage: "url('/bsuBG.jpg')" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 print:hidden">
        <div className="backdrop-blur-md bg-slate-950/55 border-b border-white/10">
          <div className="w-full px-6 lg:px-10 xl:px-14 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                  <img src="/kttm.jpg" alt="KTTM Logo" className="h-full w-full object-contain scale-125" />
                </div>

                <div className="leading-tight">
                  <div className="text-white text-lg sm:text-xl font-black">IP Assets</div>
                  <div className="text-white/75 text-xs sm:text-sm">Add · Update · Delete · Print · Download</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-white/90">
                <span className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15">{dateStr}</span>
                <span className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15">{timeStr}</span>

                <Link to="/kttmHome" className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15 hover:bg-white/15 transition text-white">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Layout */}
      <main className="w-full px-6 lg:px-10 xl:px-14 py-6 h-[calc(100vh-88px)] print:h-auto print:px-0 print:py-0">
        <div className="h-full rounded-3xl bg-white/90 backdrop-blur-sm border border-white/30 shadow-2xl p-6 lg:p-8 flex flex-col min-h-0 print:shadow-none print:border-0 print:p-0">
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full lg:max-w-5xl">
              <div>
                <div className="text-[11px] font-semibold text-slate-500">SEARCH</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Title / inventors / ID..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500">IP TYPE</div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {["All", "Patent", "Utility Model", "Industrial Design", "Trademark", "Copyright"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500">CAMPUS</div>
                <select
                  value={campusFilter}
                  onChange={(e) => setCampusFilter(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {campusOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500">STATUS</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {["All", "Recently Filed", "Registered", "Unregistered", "Close to Expiration"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={openCreate}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
                type="button"
              >
                + Add Record
              </button>

              <button
                onClick={printTable}
                className="px-4 py-2 rounded-xl bg-white text-slate-800 border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition"
                type="button"
              >
                Print
              </button>

              <button
                onClick={exportCSV}
                className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-sm font-semibold hover:bg-blue-100 transition"
                type="button"
              >
                Download CSV
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="mt-4 print:hidden">
            {loading && <div className="text-sm text-slate-600">Loading records…</div>}
            {errMsg && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {errMsg}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="mt-4 flex-1 min-h-0">
            <div className="h-full border border-slate-200 rounded-2xl overflow-auto bg-white">
              <div className="min-w-[1600px]">
                {/* Sticky header */}
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-semibold text-slate-600 bg-slate-100 border-b border-slate-200">
                  <div className="col-span-3">Title</div>
                  <div className="col-span-3">Inventor/s</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">
                    <button type="button" onClick={() => toggleSort("shil_id_number")} className="flex items-center gap-1 text-left">
                      <span>IPOPHL ID</span>
                      <span className="text-xs">{sortField === "shil_id_number" ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
                    </button>
                  </div>
                  <div className="col-span-1">Registration Date</div>

                  <div className="col-span-1">
                    <div>Next Due</div>
                   
                  </div>

                  <div className="col-span-1">Validity</div>
                  <div className="col-span-1">Link</div>
                  <div className="col-span-1">Actions</div>
                </div>

                {!loading && !errMsg && rows.length === 0 && (
                  <div className="px-4 py-4 text-sm text-slate-600">No records found.</div>
                )}

                {!loading &&
                  !errMsg &&
                  rows.map((r) => {
                    const validity = computeValidity(r);
                    return (
                      <div
                        key={r.id ?? `${r.title}-${r.shil_id_number}`}
                        className="px-4 py-3 grid grid-cols-12 gap-2 text-sm border-b border-slate-200 bg-white hover:bg-slate-50 transition"
                      >
                        {/* Title */}
                        <div className="col-span-3 font-medium text-slate-900">
                          <div className="leading-snug">{r.title || "—"}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            Campus: <span className="font-semibold">{r.campus || "—"}</span>
                          </div>
                        </div>

                        {/* Inventors */}
                        <div className="col-span-3 text-slate-800">
                          <div className="whitespace-pre-line leading-snug text-sm">{formatInventors(r.inventors)}</div>
                        </div>

                        {/* Type */}
                        <div className="col-span-1">
                          <TypePill type={r.ip_type} />
                        </div>

                        {/* Status */}
                        <div className="col-span-1">
                          <IpStatusPill status={r.remarks} />
                        </div>

                        {/* IPOPHL ID */}
                        <div className="col-span-1 text-slate-700 break-words">{r.shil_id_number || "—"}</div>

                        {/* Registration Date */}
                        <div className="col-span-1 text-slate-700">{formatDate(r.registration_date)}</div>

                        {/* ✅ Next Due (computed if empty, note for Recently Filed) */}
                        <div className="col-span-1 text-slate-700">{renderNextDueCell(r)}</div>

                        {/* Validity */}
                        <div className="col-span-1">
                          <ValidityPill tone={validity.tone} label={validity.label} />
                        </div>

                        {/* Link */}
                        <div className="col-span-1">
                          {r.link && r.link !== "—" ? (
                            <a
                              href={r.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-700 underline text-sm block truncate max-w-[160px]"
                              title={r.link}
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 flex items-center flex-nowrap gap-2 print:hidden">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 whitespace-nowrap"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => printRecord(r)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 whitespace-nowrap"
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(r)}
                            className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 whitespace-nowrap"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Print footer */}
          <div className="mt-4 text-center text-xs text-slate-500 hidden print:block">
            © {new Date().getFullYear()} KTTM Unit · IP Asset List
          </div>
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <Modal onClose={closeModal}>
          <div className="text-lg font-black text-slate-900">{mode === "create" ? "Add IP Asset" : "Edit IP Asset"}</div>
          <div className="text-sm text-slate-600 mt-1">
            Fill up the fields then click <span className="font-semibold">Save</span>.
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="IP Type">
              <select
                value={form.ip_type}
                onChange={(e) => setForm((f) => ({ ...f, ip_type: e.target.value, next_due_date: "" }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                {["Patent", "Utility Model", "Industrial Design", "Trademark", "Copyright"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 mt-1">
                Trademark: 10y · Ind. Design: 5y · Patent: yearly reminder · Utility Model: 7y term
              </div>
            </Field>

            <Field label="Status">
              <select
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value, next_due_date: "" }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                {["Recently Filed", "Registered", "Unregistered", "Close to Expiration"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-500 mt-1">Note: Recently Filed = not registered yet (no renewal schedule).</div>
            </Field>

            <Field label="Title / Application Title">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="e.g., Dual-operated condiment grinding machine"
              />
            </Field>

            <Field label="Inventors / Applicants">
              <textarea
                value={form.inventors}
                onChange={(e) => setForm((f) => ({ ...f, inventors: e.target.value }))}
                className="w-full min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder={"One per line, or comma-separated\ne.g.\nJuan Dela Cruz\nMaria Santos"}
              />
            </Field>

            <Field label="IPOPHL ID">
              <input
                value={form.shil_id_number}
                onChange={(e) => setForm((f) => ({ ...f, shil_id_number: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="1/2019/000408"
              />
            </Field>

            <Field label="Registration Date">
              <input
                value={form.registration_date}
                onChange={(e) => setForm((f) => ({ ...f, registration_date: e.target.value, next_due_date: "" }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="YYYY-MM-DD (recommended) or Sep 27, 2024"
              />
            </Field>

            <Field label="Next Due / Renewal Date">
              <input
                value={form.next_due_date}
                onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Auto-calculated (you can override)"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-40"
                  disabled={String(form.remarks || "").trim() === "Recently Filed"}
                  onClick={() => {
                    const reg = parseDateFlexible(form.registration_date);
                    if (!reg) return;
                    if (String(form.remarks || "").trim() === "Recently Filed") return;
                    const computed = computeNextDueDate(form.ip_type, reg);
                    setForm((f) => ({
                      ...f,
                      next_due_date: computed ? formatDateISO(computed) : "",
                    }));
                  }}
                >
                  Auto-calc
                </button>
                <div className="text-[11px] text-slate-500 self-center">Best format: YYYY-MM-DD</div>
              </div>
            </Field>

            <Field label="Google Drive Link">
              <input
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="https://drive.google.com/..."
              />
            </Field>

            <Field label="Campus (Box / Folder / Shelf)">
              <input
                value={form.campus}
                onChange={(e) => setForm((f) => ({ ...f, campus: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Box 2-A / Folder TM-1"
              />
            </Field>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 rounded-xl bg-white text-slate-800 border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveForm}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------- UI Bits ----------------- */

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

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function ValidityPill({ tone, label }) {
  const styles =
    tone === "overdue"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "soon"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles}`} title={label}>
      {label}
    </span>
  );
}

function IpStatusPill({ status }) {
  const s = status || "—";
  const styles =
    s === "Registered"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "Recently Filed"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles}`}>
      {s}
    </span>
  );
}

function TypePill({ type }) {
  const t = type || "—";
  const map = {
    Patent: "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Utility Model": "bg-cyan-50 text-cyan-700 border-cyan-200",
    "Industrial Design": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    Trademark: "bg-rose-50 text-rose-700 border-rose-200",
    Copyright: "bg-amber-50 text-amber-800 border-amber-200",
  };

  const styles = map[t] ?? "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles}`} title={t}>
      {t}
    </span>
  );
}
