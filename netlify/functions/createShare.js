const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL || !SERVICE_ROLE)
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing server env vars" }) };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: "Missing bearer token" }) };

    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Invalid token" }) };
    const user = authData.user;

    const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!prof?.is_admin) return { statusCode: 403, headers, body: JSON.stringify({ error: "Admin only" }) };

    const { path, code, seconds = 3600, bucket = "vault-docs" } = JSON.parse(event.body || "{}");
    if (!path || !code) return { statusCode: 400, headers, body: JSON.stringify({ error: "path and code required" }) };

    const code_hash = crypto.createHash("sha256").update(code).digest("hex");
    const expires_at = new Date(Date.now() + Number(seconds) * 1000).toISOString();

    const { data: row, error: insErr } = await admin
      .from("shares")
      .insert({ bucket, path, code_hash, expires_at, max_uses: 1, created_by: user.id })
      .select("id")
      .single();

    if (insErr) return { statusCode: 500, headers, body: JSON.stringify({ error: insErr.message }) };

    const proto = event.headers["x-forwarded-proto"] || "https";
    const host = event.headers.host;
    const viewerUrl = `${proto}://${host}/viewer.html?id=${row.id}`;

    return { statusCode: 200, headers, body: JSON.stringify({ id: row.id, viewerUrl }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};
