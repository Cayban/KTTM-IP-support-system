/**
 * KTTM IP Records API (Two Tables)
 * ✅ AUTO record_id (KTTM-###) + TRIM-safe + UNIQUE retry
 * ✅ Fix: next-id computation is TRIM-safe + CASE-INSENSITIVE + DIGITS extraction
 * ✅ Fix: prevents wrong next id (e.g. showing 007 when DB has 20)
 * ✅ Adds optional columns support (ipophl_id / shil_id_number / ipophil_id_number, gdrive_link)
 * ✅ Fixes /api/ipassets to actually SELECT + SAVE optional fields
 * ✅ Adds proper /api/ipassets/stats alias route (no app._router hack)
 *
 * Tables (actual):
 *  - ip_records(record_id, ip_title, category, owner_inventor_summary, campus, status, date_registered, ipophl_id?, gdrive_link?)
 *  - ip_contributors(contributor_id, record_id, contributor_name, role) // role = Male/Female (gender)
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

// ✅ Record ID format controls (optional envs)
const RECORD_PREFIX = process.env.RECORD_PREFIX || "KTTM-"; // "KTTM-"
const RECORD_PAD = Number(process.env.RECORD_PAD ?? 0); // ✅ set 0 => KTTM-21, set 3 => KTTM-021

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

// ✅ Optional columns (auto-detected)
const OPT = {
  ip_id_col: null,
  gdrive_col: null,
};

function pickFirstExisting(recCols, candidates) {
  for (const c of candidates) if (recCols.has(c)) return c;
  return null;
}

// ✅ For SELECT queries that have aliases (FROM ip_records r)
function buildRecordsSelect(alias = "r") {
  const base = [
    `${alias}.${COL_R.record_id} AS record_id`,
    `${alias}.${COL_R.ip_title} AS ip_title`,
    `${alias}.${COL_R.category} AS category`,
    `${alias}.${COL_R.owner_summary} AS owner_inventor_summary`,
    `${alias}.${COL_R.campus} AS campus`,
    `${alias}.${COL_R.status} AS status`,
    `${alias}.${COL_R.date_registered} AS date_registered`,
  ];

  if (OPT.ip_id_col) base.push(`${alias}.${OPT.ip_id_col} AS ipophl_id`);
  if (OPT.gdrive_col) base.push(`${alias}.${OPT.gdrive_col} AS gdrive_link`);

  return base.join(",\n        ");
}

// ✅ For INSERT/UPDATE/DELETE RETURNING (no alias available)
function buildRecordsReturningNoAlias() {
  const base = [
    `${COL_R.record_id} AS record_id`,
    `${COL_R.ip_title} AS ip_title`,
    `${COL_R.category} AS category`,
    `${COL_R.owner_summary} AS owner_inventor_summary`,
    `${COL_R.campus} AS campus`,
    `${COL_R.status} AS status`,
    `${COL_R.date_registered} AS date_registered`,
  ];

  if (OPT.ip_id_col) base.push(`${OPT.ip_id_col} AS ipophl_id`);
  if (OPT.gdrive_col) base.push(`${OPT.gdrive_col} AS gdrive_link`);

  return base.join(",\n        ");
}

// ✅ For SELECT queries that have aliases (FROM ip_contributors c)
function buildContribSelect(alias = "c") {
  return [
    `${alias}.${COL_C.contributor_id} AS contributor_id`,
    `${alias}.${COL_C.record_id} AS record_id`,
    `${alias}.${COL_C.contributor_name} AS contributor_name`,
    `${alias}.${COL_C.role} AS role`,
  ].join(",\n        ");
}

// ✅ For INSERT/UPDATE/DELETE RETURNING (no alias available)
function buildContribReturningNoAlias() {
  return [
    `${COL_C.contributor_id} AS contributor_id`,
    `${COL_C.record_id} AS record_id`,
    `${COL_C.contributor_name} AS contributor_name`,
    `${COL_C.role} AS role`,
  ].join(",\n        ");
}

// ✅ record_id generator helpers
function formatRecordId(n) {
  const pad = Number.isFinite(RECORD_PAD) ? RECORD_PAD : 0;
  if (pad <= 0) return `${RECORD_PREFIX}${n}`; // ✅ KTTM-21
  return `${RECORD_PREFIX}${String(n).padStart(pad, "0")}`; // ✅ KTTM-021
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ✅ FIXED: Computes next record number (MAX + 1) for IDs like PREFIX + digits.
 * - TRIM-safe: BTRIM(record_id)
 * - CASE-insensitive: ~*
 * - Correct digits extraction: SUBSTRING(... FROM '^KTTM-(\d+)$')
 */
async function getNextRecordNumber(client) {
  const prefix = RECORD_PREFIX;
  const digitCapture = `^${escapeRegex(prefix)}(\\d+)$`; // capture digits
  const fullMatch = `^${escapeRegex(prefix)}\\d+$`;      // validate format

  const sql = `
    SELECT COALESCE(
      MAX( (SUBSTRING(BTRIM(${COL_R.record_id}) FROM $1))::int ),
      0
    ) + 1 AS next_num
    FROM ip_records
    WHERE BTRIM(${COL_R.record_id}) ~* $2;  -- ✅ case-insensitive
  `;

  const r = await client.query(sql, [digitCapture, fullMatch]);
  const nextNum = Number(r.rows?.[0]?.next_num || 1);
  return Number.isFinite(nextNum) && nextNum > 0 ? nextNum : 1;
}

/**
 * Generate next record_id safely using:
 * - transaction
 * - pg_advisory_xact_lock so concurrent inserts don't collide
 */
async function generateNextRecordIdTx(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    "kttm_ip_records_record_id_lock",
  ]);

  const nextNum = await getNextRecordNumber(client);
  return formatRecordId(nextNum);
}

async function boot() {
  const recCols = await getColumns("ip_records");
  const conCols = await getColumns("ip_contributors");

  HAS.ip_records = recCols.size > 0;
  HAS.ip_contributors = conCols.size > 0;

  REC_COLS = recCols;

  if (!HAS.ip_records) {
    console.error("❌ Table ip_records not found in public schema.");
    process.exit(1);
  }

  const requiredRec = Object.values(COL_R);
  const missingRec = requiredRec.filter((c) => !recCols.has(c));
  if (missingRec.length) {
    console.error("❌ ip_records missing columns:", missingRec);
    console.error("✅ Found columns:", [...recCols].join(", "));
    process.exit(1);
  }

  OPT.ip_id_col = pickFirstExisting(recCols, [
    "ipophl_id",
    "ipophil_id_number",
    "ipophl_id_number",
    "shil_id_number",
  ]);
  OPT.gdrive_col = pickFirstExisting(recCols, ["gdrive_link"]);

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
  console.log(
    `✅ record_id format: ${RECORD_PREFIX}${RECORD_PAD > 0 ? "0".repeat(RECORD_PAD) : "N"} (e.g., ${formatRecordId(1)})`
  );
  console.log("✅ Optional columns:");
  console.log(`   - ip id column: ${OPT.ip_id_col || "(none)"}`);
  console.log(`   - gdrive link:  ${OPT.gdrive_col || "(none)"}`);
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

// ✅ Next ID preview for frontend modal (read-only)
app.get("/api/records/next-id", async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "kttm_ip_records_record_id_lock",
    ]);
    const nextNum = await getNextRecordNumber(client);
    const nextId = formatRecordId(nextNum);
    await client.query("COMMIT");
    res.json({ ok: true, next_id: nextId });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to compute next record id" });
  } finally {
    client.release();
  }
});

// -------------------- CORE: ip_records --------------------
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

/**
 * POST /api/records
 * ✅ auto-generate record_id
 * ✅ retries on unique_violation (23505)
 */
app.post("/api/records", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      ip_title,
      category,
      owner_inventor_summary,
      campus,
      status,
      date_registered,
      ipophl_id,
      gdrive_link,
      contributors = [],
    } = req.body;

    if (!ip_title || !ip_title.trim()) {
      return res.status(400).json({ ok: false, error: "ip_title is required" });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ ok: false, error: "category is required" });
    }

    await client.query("BEGIN");

    let newRecord = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const newRecordId = await generateNextRecordIdTx(client);

      try {
        const cols = [
          COL_R.record_id,
          COL_R.ip_title,
          COL_R.category,
          COL_R.owner_summary,
          COL_R.campus,
          COL_R.status,
          COL_R.date_registered,
        ];

        const vals = [
          newRecordId,
          ip_title.trim(),
          category.trim(),
          owner_inventor_summary ? owner_inventor_summary.trim() : null,
          campus ? campus.trim() : null,
          status ? status.trim() : "Unregistered",
          date_registered ? date_registered.trim() : null,
        ];

        if (OPT.ip_id_col) {
          cols.push(OPT.ip_id_col);
          vals.push(ipophl_id ? String(ipophl_id).trim() : null);
        }
        if (OPT.gdrive_col) {
          cols.push(OPT.gdrive_col);
          vals.push(gdrive_link ? String(gdrive_link).trim() : null);
        }

        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");

        const insertSql = `
          INSERT INTO ip_records (${cols.join(", ")})
          VALUES (${placeholders})
          RETURNING ${buildRecordsReturningNoAlias()}
        `;

        const result = await client.query(insertSql, vals);
        newRecord = result.rows[0];
        break;
      } catch (e) {
        if (e?.code === "23505" && attempt < 9) continue;
        throw e;
      }
    }

    if (!newRecord) throw new Error("Failed to allocate a unique record_id after retries.");

    if (HAS.ip_contributors && Array.isArray(contributors) && contributors.length > 0) {
      const contribSql = `
        INSERT INTO ip_contributors (
          ${COL_C.record_id},
          ${COL_C.contributor_name},
          ${COL_C.role}
        )
        VALUES ($1, $2, $3)
      `;

      for (const contrib of contributors) {
        if (contrib.contributor_name && contrib.contributor_name.trim()) {
          await client.query(contribSql, [
            newRecord.record_id,
            contrib.contributor_name.trim(),
            contrib.role ? contrib.role.trim() : null,
          ]);
        }
      }
    }

    await client.query("COMMIT");

    res.status(201).json({ ok: true, message: "Record created successfully", row: newRecord });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error(err);
    res.status(500).json({ ok: false, error: `Failed to create record: ${err.message}` });
  } finally {
    client.release();
  }
});

app.put("/api/records/:record_id", async (req, res) => {
  try {
    const { record_id } = req.params;
    const {
      ip_title,
      category,
      owner_inventor_summary,
      campus,
      status,
      date_registered,
      ipophl_id,
      gdrive_link,
    } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (ip_title !== undefined && ip_title !== null) {
      params.push(String(ip_title).trim());
      updates.push(`${COL_R.ip_title} = $${paramIndex++}`);
    }
    if (category !== undefined && category !== null) {
      params.push(String(category).trim());
      updates.push(`${COL_R.category} = $${paramIndex++}`);
    }
    if (owner_inventor_summary !== undefined && owner_inventor_summary !== null) {
      params.push(String(owner_inventor_summary).trim());
      updates.push(`${COL_R.owner_summary} = $${paramIndex++}`);
    }
    if (campus !== undefined && campus !== null) {
      params.push(String(campus).trim());
      updates.push(`${COL_R.campus} = $${paramIndex++}`);
    }
    if (status !== undefined && status !== null) {
      params.push(String(status).trim());
      updates.push(`${COL_R.status} = $${paramIndex++}`);
    }
    if (date_registered !== undefined && date_registered !== null) {
      params.push(String(date_registered).trim());
      updates.push(`${COL_R.date_registered} = $${paramIndex++}`);
    }

    if (OPT.ip_id_col && ipophl_id !== undefined) {
      params.push(ipophl_id === null ? null : String(ipophl_id).trim());
      updates.push(`${OPT.ip_id_col} = $${paramIndex++}`);
    }
    if (OPT.gdrive_col && gdrive_link !== undefined) {
      params.push(gdrive_link === null ? null : String(gdrive_link).trim());
      updates.push(`${OPT.gdrive_col} = $${paramIndex++}`);
    }

    if (updates.length === 0) return res.status(400).json({ ok: false, error: "No fields to update" });

    params.push(record_id);

    const sql = `
      UPDATE ip_records
      SET ${updates.join(", ")}
      WHERE ${COL_R.record_id} = $${paramIndex}
      RETURNING ${buildRecordsReturningNoAlias()};
    `;

    const result = await pool.query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "Record not found" });

    res.json({ ok: true, message: "Record updated successfully", row: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: `Failed to update record: ${err.message}` });
  }
});

app.delete("/api/records/:record_id", async (req, res) => {
  try {
    const { record_id } = req.params;

    const checkSql = `
      SELECT ${COL_R.record_id} FROM ip_records
      WHERE ${COL_R.record_id} = $1
      LIMIT 1;
    `;

    const checkResult = await pool.query(checkSql, [record_id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ ok: false, error: "Record not found" });

    if (HAS.ip_contributors) {
      await pool.query(`DELETE FROM ip_contributors WHERE ${COL_C.record_id} = $1;`, [record_id]);
    }

    const deleteSql = `
      DELETE FROM ip_records
      WHERE ${COL_R.record_id} = $1
      RETURNING ${buildRecordsReturningNoAlias()};
    `;

    const result = await pool.query(deleteSql, [record_id]);

    res.json({ ok: true, message: "Record deleted successfully", row: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: `Failed to delete record: ${err.message}` });
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
      ${whereSQL ? `${whereSQL} AND` : "WHERE"} r.${COL_R.date_registered} IS NOT NULL
      GROUP BY year
      ORDER BY year ASC;
    `;

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

app.post("/api/contributors", async (req, res) => {
  try {
    if (!HAS.ip_contributors) {
      return res.status(400).json({ ok: false, error: "ip_contributors table not found" });
    }

    const { record_id, contributor_name, role } = req.body;

    if (!record_id || !record_id.trim()) return res.status(400).json({ ok: false, error: "record_id is required" });
    if (!contributor_name || !contributor_name.trim()) return res.status(400).json({ ok: false, error: "contributor_name is required" });

    const recordExists = await pool.query(
      `SELECT ${COL_R.record_id} FROM ip_records WHERE ${COL_R.record_id} = $1 LIMIT 1`,
      [record_id]
    );

    if (recordExists.rows.length === 0) return res.status(404).json({ ok: false, error: "Record not found" });

    const insertSql = `
      INSERT INTO ip_contributors (
        ${COL_C.record_id},
        ${COL_C.contributor_name},
        ${COL_C.role}
      )
      VALUES ($1, $2, $3)
      RETURNING ${buildContribReturningNoAlias()};
    `;

    const params = [record_id.trim(), contributor_name.trim(), role ? role.trim() : null];

    const result = await pool.query(insertSql, params);

    res.status(201).json({ ok: true, message: "Contributor added successfully", row: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: `Failed to add contributor: ${err.message}` });
  }
});

app.get("/api/gender/stats", async (_req, res) => {
  try {
    if (!HAS.ip_contributors) return res.status(400).json({ ok: false, error: "ip_contributors table not found" });

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

app.get("/api/gender/by-category", async (_req, res) => {
  try {
    if (!HAS.ip_contributors) return res.status(400).json({ ok: false, error: "ip_contributors table not found" });

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
app.get("/api/ipassets", async (req, res) => {
  try {
    const { type, status, campus, q, limit = "2000", offset = "0" } = req.query;

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

    const optSelects = [];
    if (OPT.ip_id_col) optSelects.push(`r.${OPT.ip_id_col} AS ipophl_id`);
    if (OPT.gdrive_col) optSelects.push(`r.${OPT.gdrive_col} AS gdrive_link`);

    const sql = `
      SELECT
        r.${COL_R.record_id} AS id,
        r.${COL_R.ip_title} AS title,
        r.${COL_R.category} AS ip_type,
        r.${COL_R.status} AS remarks,
        r.${COL_R.owner_summary} AS inventors,
        r.${COL_R.date_registered} AS registration_date,
        r.${COL_R.campus} AS location
        ${optSelects.length ? `, ${optSelects.join(", ")}` : ""}
        ${
          HAS.ip_contributors
            ? ", COALESCE(g.male_count,0) AS male_count, COALESCE(g.female_count,0) AS female_count"
            : ""
        }
      FROM ip_records r
      ${genderJoin}
      ${whereSQL}
      ORDER BY r.${COL_R.date_registered} DESC NULLS LAST, r.${COL_R.record_id} DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const r = await pool.query(sql, params);

    const rows = r.rows.map((x) => {
      let sex = "";
      if (HAS.ip_contributors) {
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
        sex,

        shil_id_number: x.ipophl_id ?? null,
        ipophil_id_number: x.ipophl_id ?? null,
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

app.post("/api/ipassets", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      title,
      ip_type,
      inventors,
      remarks,
      location,
      campus,
      registration_date,
      shil_id_number,
      gdrive_link,
    } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ ok: false, error: "title is required" });
    if (!ip_type || !ip_type.trim()) return res.status(400).json({ ok: false, error: "ip_type is required" });

    await client.query("BEGIN");

    let newRecord = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const newRecordId = await generateNextRecordIdTx(client);

      await client.query("SAVEPOINT sp_insert_ipasset");

      try {
        const cols = [
          COL_R.record_id,
          COL_R.ip_title,
          COL_R.category,
          COL_R.owner_summary,
          COL_R.status,
          COL_R.campus,
          COL_R.date_registered,
        ];

        // accept either `campus` (preferred) or legacy `location`
        const campusVal = campus !== undefined ? campus : location;

        const vals = [
          newRecordId,
          title.trim(),
          ip_type.trim(),
          inventors ? String(inventors).trim() : null,
          remarks ? String(remarks).trim() : "Unregistered",
          campusVal ? String(campusVal).trim() : null,
          registration_date ? String(registration_date).trim() : null,
        ];

        if (OPT.ip_id_col) {
          cols.push(OPT.ip_id_col);
          vals.push(shil_id_number ? String(shil_id_number).trim() : null);
        }
        if (OPT.gdrive_col) {
          cols.push(OPT.gdrive_col);
          vals.push(gdrive_link ? String(gdrive_link).trim() : null);
        }

        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");

        const insertSql = `
          INSERT INTO ip_records (${cols.join(", ")})
          VALUES (${placeholders})
          RETURNING ${buildRecordsReturningNoAlias()};
        `;

        const result = await client.query(insertSql, vals);
        newRecord = result.rows[0];

        await client.query("RELEASE SAVEPOINT sp_insert_ipasset");
        break;
      } catch (e) {
        if (e?.code === "23505") {
          await client.query("ROLLBACK TO SAVEPOINT sp_insert_ipasset");
          await client.query("RELEASE SAVEPOINT sp_insert_ipasset");
          continue;
        }
        throw e;
      }
    }

    if (!newRecord) throw new Error("Failed to allocate a unique record_id after retries.");

    await client.query("COMMIT");

    const row = {
      id: newRecord.record_id,
      title: newRecord.ip_title,
      ip_type: newRecord.category,
      remarks: newRecord.status,
      inventors: newRecord.owner_inventor_summary,
      registration_date: newRecord.date_registered,
      location: newRecord.campus,
      shil_id_number: newRecord.ipophl_id ?? null,
      gdrive_link: newRecord.gdrive_link ?? null,
      next_due_date: null,
      renewal_date: null,
      link: null,
    };

    return res.status(201).json({ ok: true, message: "IP asset created successfully", row });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error(err);
    return res.status(500).json({ ok: false, error: `Failed to create IP asset: ${err.message}` });
  } finally {
    client.release();
  }
});

app.put("/api/ipassets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      ip_type,
      inventors,
      remarks,
      location,
      campus,
      registration_date,
      shil_id_number,
      gdrive_link,
    } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined && title !== null) {
      params.push(String(title).trim());
      updates.push(`${COL_R.ip_title} = $${paramIndex++}`);
    }
    if (ip_type !== undefined && ip_type !== null) {
      params.push(String(ip_type).trim());
      updates.push(`${COL_R.category} = $${paramIndex++}`);
    }
    if (inventors !== undefined && inventors !== null) {
      params.push(String(inventors).trim());
      updates.push(`${COL_R.owner_summary} = $${paramIndex++}`);
    }
    if (remarks !== undefined && remarks !== null) {
      params.push(String(remarks).trim());
      updates.push(`${COL_R.status} = $${paramIndex++}`);
    }
    if (campus !== undefined || location !== undefined) {
      const campusVal = campus !== undefined ? campus : location;
      params.push(campusVal === null ? null : String(campusVal).trim());
      updates.push(`${COL_R.campus} = $${paramIndex++}`);
    }
    if (registration_date !== undefined && registration_date !== null) {
      params.push(String(registration_date).trim());
      updates.push(`${COL_R.date_registered} = $${paramIndex++}`);
    }

    if (OPT.ip_id_col && shil_id_number !== undefined) {
      params.push(shil_id_number === null ? null : String(shil_id_number).trim());
      updates.push(`${OPT.ip_id_col} = $${paramIndex++}`);
    }
    if (OPT.gdrive_col && gdrive_link !== undefined) {
      params.push(gdrive_link === null ? null : String(gdrive_link).trim());
      updates.push(`${OPT.gdrive_col} = $${paramIndex++}`);
    }

    if (updates.length === 0) return res.status(400).json({ ok: false, error: "No fields to update" });

    params.push(id);

    const sql = `
      UPDATE ip_records
      SET ${updates.join(", ")}
      WHERE ${COL_R.record_id} = $${paramIndex}
      RETURNING ${buildRecordsReturningNoAlias()};
    `;

    const result = await pool.query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "IP asset not found" });

    const newRecord = result.rows[0];
    const row = {
      id: newRecord.record_id,
      title: newRecord.ip_title,
      ip_type: newRecord.category,
      remarks: newRecord.status,
      inventors: newRecord.owner_inventor_summary,
      registration_date: newRecord.date_registered,
      location: newRecord.campus,
      shil_id_number: newRecord.ipophl_id ?? null,
      gdrive_link: newRecord.gdrive_link ?? null,
      next_due_date: null,
      renewal_date: null,
      link: null,
    };

    res.json({ ok: true, message: "IP asset updated successfully", row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: `Failed to update IP asset: ${err.message}` });
  }
});

app.delete("/api/ipassets/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const checkSql = `SELECT ${COL_R.record_id} FROM ip_records WHERE ${COL_R.record_id} = $1 LIMIT 1;`;
    const checkResult = await pool.query(checkSql, [id]);
    if (checkResult.rows.length === 0) return res.status(404).json({ ok: false, error: "IP asset not found" });

    if (HAS.ip_contributors) {
      await pool.query(`DELETE FROM ip_contributors WHERE ${COL_C.record_id} = $1;`, [id]);
    }

    const deleteSql = `
      DELETE FROM ip_records
      WHERE ${COL_R.record_id} = $1
      RETURNING ${buildRecordsReturningNoAlias()};
    `;

    await pool.query(deleteSql, [id]);

    res.json({ ok: true, message: "IP asset deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: `Failed to delete IP asset: ${err.message}` });
  }
});

app.get("/api/ipassets/stats", async (req, res) => {
  req.query.category = req.query.type;
  delete req.query.type;
  req.url = "/api/records/stats";
  app.handle(req, res);
});

// -------------------- START --------------------
app.listen(PORT, () => {
  console.log(`✅ KTTM API running on http://localhost:${PORT}`);
  console.log(`✅ Health:        http://localhost:${PORT}/api/health`);
  console.log(`✅ Tables:        http://localhost:${PORT}/api/tables`);
  console.log(`✅ Next ID:       http://localhost:${PORT}/api/records/next-id`);
  console.log(`✅ Records:       http://localhost:${PORT}/api/records`);
  console.log(`✅ Contributors:  http://localhost:${PORT}/api/contributors`);
  console.log(`✅ IP Assets:     http://localhost:${PORT}/api/ipassets`);
  console.log(`✅ Gender stats:  http://localhost:${PORT}/api/gender/stats`);
});
