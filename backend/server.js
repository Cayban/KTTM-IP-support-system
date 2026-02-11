/**
 * KTTM IP Records API (Two Tables) - UPDATED to match your DB
 * ES Module compatible ("type":"module")
 *
 * Tables (actual):
 *  - ip_records(record_id, ip_title, category, owner_inventor_summary, campus, status, date_registered)
 *  - ip_contributors(contributor_id, record_id, contributor_name, role)  // role = Male/Female (gender)
 */

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;
const app = express();

const PORT = Number(process.env.PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing in .env");
  console.error("✅ Example:");
  console.error("DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/KttmDB");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// middleware
app.use(express.json({ limit: "2mb" }));

// allow "*" or single origin or comma-separated list
const originList = String(CORS_ORIGIN)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      originList.length === 0
        ? true
        : originList.includes("*")
        ? true
        : originList,
    credentials: true,
  })
);

// ---- helpers: detect columns so we don't crash ----
async function getColumns(tableName) {
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
  `;
  const r = await pool.query(sql, [tableName]);
  return new Set(r.rows.map((x) => x.column_name));
}

let HAS = {
  ip_records: false,
  ip_contributors: false,
};

// detected record columns (populated at boot)
let REC_COLS = new Set();

const COL_R = {
  record_id: "record_id",
  ip_title: "ip_title",
  category: "category",
  owner_summary: "owner_inventor_summary",
  campus: "campus",
  status: "status",
  date_registered: "date_registered",
};

const COL_C = {
  contributor_id: "contributor_id",
  record_id: "record_id",
  contributor_name: "contributor_name",
  role: "role", // Male/Female (gender)
};

function buildRecordsSelect(alias = "r") {
  return [
    `${alias}.${COL_R.record_id} AS record_id`,
    `${alias}.${COL_R.ip_title} AS ip_title`,
    `${alias}.${COL_R.category} AS category`,
    `${alias}.${COL_R.owner_summary} AS owner_inventor_summary`,
    `${alias}.${COL_R.campus} AS campus`,
    `${alias}.${COL_R.status} AS status`,
    `${alias}.${COL_R.date_registered} AS date_registered`,
  ].join(",\n        ");
}

function buildContribSelect(alias = "c") {
  return [
    `${alias}.${COL_C.contributor_id} AS contributor_id`,
    `${alias}.${COL_C.record_id} AS record_id`,
    `${alias}.${COL_C.contributor_name} AS contributor_name`,
    `${alias}.${COL_C.role} AS role`,
  ].join(",\n        ");
}

async function boot() {
  const recCols = await getColumns("ip_records");
  const conCols = await getColumns("ip_contributors");

  HAS.ip_records = recCols.size > 0;
  HAS.ip_contributors = conCols.size > 0;

  // store detected record columns for runtime checks
  REC_COLS = recCols;

  if (!HAS.ip_records) {
    console.error("❌ Table ip_records not found in public schema.");
    process.exit(1);
  }

  // sanity check required columns for ip_records
  const requiredRec = Object.values(COL_R);
  const missingRec = requiredRec.filter((c) => !recCols.has(c));
  if (missingRec.length) {
    console.error("❌ ip_records missing columns:", missingRec);
    console.error("✅ Found columns:", [...recCols].join(", "));
    process.exit(1);
  }

  // ip_contributors is optional for endpoints that need gender stats
  if (HAS.ip_contributors) {
    const requiredCon = Object.values(COL_C);
    const missingCon = requiredCon.filter((c) => !conCols.has(c));
    if (missingCon.length) {
      console.error("❌ ip_contributors missing columns:", missingCon);
      console.error("✅ Found columns:", [...conCols].join(", "));
      process.exit(1);
    }
  } else {
    console.warn("⚠️ Table ip_contributors not found. Gender endpoints will be limited.");
  }

  console.log("✅ Connected to DB and detected tables:");
  console.log("   - ip_records ✅");
  console.log(`   - ip_contributors ${HAS.ip_contributors ? "✅" : "❌ (not found)"}`);
}

await boot();

// -------------------- BASIC --------------------
app.get("/api/health", async (_req, res) => {
  try {
    const r = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "DB connection failed" });
  }
});

app.get("/api/tables", async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    res.json({ ok: true, tables: r.rows.map((x) => x.tablename) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to list tables" });
  }
});

// -------------------- CORE: ip_records --------------------
/**
 * GET /api/records
 * Query params:
 * - category: Patent | Utility Model | Industrial Design | Trademark | Copyright | All
 * - campus: string | All
 * - status: Recently Filed | Registered | Unregistered | Close to Expiration | All
 * - q: search over title / owner summary / record_id
 * - limit, offset
 */
app.get("/api/records", async (req, res) => {
  try {
    const { category, campus, status, q, limit = "200", offset = "0" } = req.query;

    const where = [];
    const params = [];

    if (category && category !== "All") {
      params.push(category);
      where.push(`r.${COL_R.category} = $${params.length}`);
    }

    if (campus && campus !== "All") {
      params.push(campus);
      where.push(`r.${COL_R.campus} = $${params.length}`);
    }

    if (status && status !== "All") {
      params.push(status);
      where.push(`r.${COL_R.status} = $${params.length}`);
    }

    if (q && String(q).trim() !== "") {
      params.push(`%${String(q).trim()}%`);
      const p = `$${params.length}`;
      where.push(`(
        r.${COL_R.ip_title} ILIKE ${p}
        OR r.${COL_R.owner_summary} ILIKE ${p}
        OR r.${COL_R.record_id} ILIKE ${p}
      )`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 2000);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    params.push(lim);
    params.push(off);

    const sql = `
      SELECT
        ${buildRecordsSelect("r")}
      FROM ip_records r
      ${whereSQL}
      ORDER BY r.${COL_R.date_registered} DESC NULLS LAST, r.${COL_R.record_id} DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const result = await pool.query(sql, params);
    res.json({ ok: true, rows: result.rows, count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch records" });
  }
});

app.get("/api/records/:record_id", async (req, res) => {
  try {
    const { record_id } = req.params;
    const sql = `
      SELECT
        ${buildRecordsSelect("r")}
      FROM ip_records r
      WHERE r.${COL_R.record_id} = $1
      LIMIT 1;
    `;
    const r = await pool.query(sql, [record_id]);
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, row: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch record" });
  }
});

app.get("/api/records/sample", async (_req, res) => {
  try {
    const sql = `
      SELECT
        ${buildRecordsSelect("r")}
      FROM ip_records r
      ORDER BY r.${COL_R.date_registered} DESC NULLS LAST, r.${COL_R.record_id} DESC
      LIMIT 10;
    `;
    const r = await pool.query(sql);
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch sample rows" });
  }
});

/**
 * GET /api/records/stats
 * Returns basic stats that match your real fields:
 * - total
 * - by_category
 * - by_status
 * - by_campus
 * - by_year (based on date_registered)
 */
app.get("/api/records/stats", async (req, res) => {
  try {
    const { category, campus, status, q } = req.query;

    const where = [];
    const params = [];

    if (category && category !== "All") {
      params.push(category);
      where.push(`r.${COL_R.category} = $${params.length}`);
    }
    if (campus && campus !== "All") {
      params.push(campus);
      where.push(`r.${COL_R.campus} = $${params.length}`);
    }
    if (status && status !== "All") {
      params.push(status);
      where.push(`r.${COL_R.status} = $${params.length}`);
    }
    if (q && String(q).trim() !== "") {
      params.push(`%${String(q).trim()}%`);
      const p = `$${params.length}`;
      where.push(`(
        r.${COL_R.ip_title} ILIKE ${p}
        OR r.${COL_R.owner_summary} ILIKE ${p}
        OR r.${COL_R.record_id} ILIKE ${p}
      )`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM ip_records r
      ${whereSQL};
    `;

    const byCategorySql = `
      SELECT r.${COL_R.category} AS label, COUNT(*)::int AS value
      FROM ip_records r
      ${whereSQL}
      GROUP BY r.${COL_R.category}
      ORDER BY value DESC, label ASC;
    `;

    const byStatusSql = `
      SELECT r.${COL_R.status} AS label, COUNT(*)::int AS value
      FROM ip_records r
      ${whereSQL}
      GROUP BY r.${COL_R.status}
      ORDER BY value DESC, label ASC;
    `;

    const byCampusSql = `
      SELECT r.${COL_R.campus} AS label, COUNT(*)::int AS value
      FROM ip_records r
      ${whereSQL}
      GROUP BY r.${COL_R.campus}
      ORDER BY value DESC, label ASC;
    `;

    const byYearSql = `
      SELECT
        EXTRACT(YEAR FROM r.${COL_R.date_registered})::int AS year,
        COUNT(*)::int AS value
      FROM ip_records r
      ${whereSQL}
      AND r.${COL_R.date_registered} IS NOT NULL
      GROUP BY year
      ORDER BY year ASC;
    `.replace(`${whereSQL}\n      AND`, whereSQL ? `${whereSQL}\n      AND` : `WHERE`);

    const [totalR, catR, statusR, campusR, yearR] = await Promise.all([
      pool.query(totalSql, params),
      pool.query(byCategorySql, params),
      pool.query(byStatusSql, params),
      pool.query(byCampusSql, params),
      pool.query(byYearSql, params),
    ]);

    res.json({
      ok: true,
      stats: {
        total: totalR.rows[0]?.total ?? 0,
        by_category: catR.rows,
        by_status: statusR.rows,
        by_campus: campusR.rows,
        by_year: yearR.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch record stats" });
  }
});

// -------------------- CORE: ip_contributors --------------------
/**
 * GET /api/contributors
 * Query params:
 * - record_id
 * - role: Male | Female | All
 * - q: search contributor_name
 * - limit, offset
 */
app.get("/api/contributors", async (req, res) => {
  try {
    if (!HAS.ip_contributors) {
      return res.status(400).json({ ok: false, error: "ip_contributors table not found" });
    }

    const { record_id, role, q, limit = "200", offset = "0" } = req.query;

    const where = [];
    const params = [];

    if (record_id) {
      params.push(record_id);
      where.push(`c.${COL_C.record_id} = $${params.length}`);
    }

    if (role && role !== "All") {
      params.push(role);
      where.push(`c.${COL_C.role} = $${params.length}`);
    }

    if (q && String(q).trim() !== "") {
      params.push(`%${String(q).trim()}%`);
      where.push(`c.${COL_C.contributor_name} ILIKE $${params.length}`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 2000);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    params.push(lim);
    params.push(off);

    const sql = `
      SELECT
        ${buildContribSelect("c")}
      FROM ip_contributors c
      ${whereSQL}
      ORDER BY c.${COL_C.contributor_id} ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const r = await pool.query(sql, params);
    res.json({ ok: true, rows: r.rows, count: r.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch contributors" });
  }
});

/**
 * GET /api/gender/stats
 * - total contributors by gender (role)
 * - unique IP records per gender
 */
app.get("/api/gender/stats", async (_req, res) => {
  try {
    if (!HAS.ip_contributors) {
      return res.status(400).json({ ok: false, error: "ip_contributors table not found" });
    }

    const sql = `
      SELECT
        c.${COL_C.role} AS gender,
        COUNT(*)::int AS contributor_count,
        COUNT(DISTINCT c.${COL_C.record_id})::int AS unique_ip_records
      FROM ip_contributors c
      GROUP BY c.${COL_C.role}
      ORDER BY contributor_count DESC;
    `;

    const r = await pool.query(sql);
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch gender stats" });
  }
});

/**
 * GET /api/gender/by-category
 * contributor counts per (category, gender)
 */
app.get("/api/gender/by-category", async (_req, res) => {
  try {
    if (!HAS.ip_contributors) {
      return res.status(400).json({ ok: false, error: "ip_contributors table not found" });
    }

    const sql = `
      SELECT
        r.${COL_R.category} AS category,
        c.${COL_C.role} AS gender,
        COUNT(*)::int AS contributor_count
      FROM ip_records r
      JOIN ip_contributors c
        ON c.${COL_C.record_id} = r.${COL_R.record_id}
      GROUP BY r.${COL_R.category}, c.${COL_C.role}
      ORDER BY r.${COL_R.category}, c.${COL_C.role};
    `;

    const r = await pool.query(sql);
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch gender by category" });
  }
});

// -------------------- COMPAT ROUTES FOR YOUR FRONTEND --------------------
/**
 * Your dashboard currently calls:
 *   GET /api/ipassets?type=...&status=...&q=...&limit=...&offset=...
 *
 * We'll map:
 *  - type   -> category
 *  - status -> status
 *  - q      -> search
 *
 * And return fields the frontend expects:
 *  id, title, ip_type, remarks, inventors, registration_date, location, sex
 *
 * Notes:
 *  - sex is NOT in ip_records; we expose "sex" as contributor gender summary if available.
 *  - next_due_date / renewal_date / link etc. do not exist in your shown schema -> returned as null/— if needed later.
 */
app.get("/api/ipassets", async (req, res) => {
  try {
    const {
      type, // category
      status,
      campus,
      q,
      limit = "2000",
      offset = "0",
    } = req.query;

    const where = [];
    const params = [];

    if (type && type !== "All") {
      params.push(type);
      where.push(`r.${COL_R.category} = $${params.length}`);
    }

    if (campus && campus !== "All") {
      params.push(campus);
      where.push(`r.${COL_R.campus} = $${params.length}`);
    }

    if (status && status !== "All") {
      params.push(status);
      where.push(`r.${COL_R.status} = $${params.length}`);
    }

    if (q && String(q).trim() !== "") {
      params.push(`%${String(q).trim()}%`);
      const p = `$${params.length}`;
      where.push(`(
        r.${COL_R.ip_title} ILIKE ${p}
        OR r.${COL_R.owner_summary} ILIKE ${p}
        OR r.${COL_R.record_id} ILIKE ${p}
      )`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const lim = Math.min(Math.max(parseInt(limit, 10) || 2000, 1), 5000);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    params.push(lim);
    params.push(off);

    // If contributors exist, create a gender summary per record (Male/Female counts)
    // This avoids heavy joins per row in JS.
    const genderJoin = HAS.ip_contributors
      ? `
        LEFT JOIN (
          SELECT
            c.${COL_C.record_id} AS record_id,
            SUM(CASE WHEN c.${COL_C.role} = 'Male' THEN 1 ELSE 0 END)::int AS male_count,
            SUM(CASE WHEN c.${COL_C.role} = 'Female' THEN 1 ELSE 0 END)::int AS female_count
          FROM ip_contributors c
          GROUP BY c.${COL_C.record_id}
        ) g ON g.record_id = r.${COL_R.record_id}
      `
      : "";

    const extraCols = REC_COLS.has("ipophl_id") ? ", r.ipophl_id AS ipophl_id" : "";
    const gdriveLinkCol = REC_COLS.has("gdrive_link") ? ", r.gdrive_link AS gdrive_link" : "";

    const sql = `
      SELECT
        r.${COL_R.record_id} AS id,
        r.${COL_R.ip_title} AS title,
        r.${COL_R.category} AS ip_type,
        r.${COL_R.status} AS remarks,
        r.${COL_R.owner_summary} AS inventors,
        r.${COL_R.date_registered} AS registration_date,
        r.${COL_R.campus} AS location
        ${extraCols}
        ${gdriveLinkCol}
        ${HAS.ip_contributors ? ", COALESCE(g.male_count,0) AS male_count, COALESCE(g.female_count,0) AS female_count" : ""}
      FROM ip_records r
      ${genderJoin}
      ${whereSQL}
      ORDER BY r.${COL_R.date_registered} DESC NULLS LAST, r.${COL_R.record_id} DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const r = await pool.query(sql, params);

    // Map to a shape that won’t break your current frontend mapper.
    const rows = r.rows.map((x) => {
      let sex = "";
      if (HAS.ip_contributors) {
        // pick the majority gender for quick display (optional)
        const m = Number(x.male_count || 0);
        const f = Number(x.female_count || 0);
        sex = m === 0 && f === 0 ? "" : m >= f ? "Male" : "Female";
      }
      return {
        id: x.id,
        title: x.title,
        ip_type: x.ip_type,
        remarks: x.remarks,
        inventors: x.inventors,
        registration_date: x.registration_date,
        location: x.location,
        sex, // optional: derived
        // include any identifier columns if present
        shil_id_number: x.shil_id_number ?? null,
        ipophil_id_number: x.ipophil_id_number ?? null,
        ipophl_id: x.ipophl_id ?? null,
        next_due_date: null,
        renewal_date: null,
        link: null,
        gdrive_link: x.gdrive_link ?? null,
      };
    });

    res.json({ ok: true, rows, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch ipassets" });
  }
});

// alias (if your frontend ever calls these old ones)
app.get("/api/ipassets/stats", async (req, res) => {
  // just proxy to records/stats with mapped params
  req.query.category = req.query.type;
  return app._router.handle(req, res, () => {});
});

// -------------------- START --------------------
app.listen(PORT, () => {
  console.log(`✅ KTTM API running on http://localhost:${PORT}`);
  console.log(`✅ Health:        http://localhost:${PORT}/api/health`);
  console.log(`✅ Tables:        http://localhost:${PORT}/api/tables`);
  console.log(`✅ Records:       http://localhost:${PORT}/api/records`);
  console.log(`✅ Contributors:  http://localhost:${PORT}/api/contributors`);
  console.log(`✅ IP Assets:     http://localhost:${PORT}/api/ipassets`);
  console.log(`✅ Gender stats:  http://localhost:${PORT}/api/gender/stats`);
});
