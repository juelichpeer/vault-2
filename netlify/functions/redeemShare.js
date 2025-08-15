import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

  try {
    const { id, code } = JSON.parse(event.body || "{}");
    if (!id || !code) return { statusCode: 400, headers, body: JSON.stringify({ error: "id and code required" }) };

    const { data: share, error: selErr } = await admin.from("shares").select("*").eq("id", id).maybeSingle();
    if (selErr || !share) return { statusCode: 404, headers, body: JSON.stringify({ error: "Share not found" }) };

    if (new Date(share.expires_at).getTime() < Date.now())
      return { statusCode: 410, headers, body: JSON.stringify({ error: "Expired" }) };
    if (share.uses >= share.max_uses)
      return { statusCode: 410, headers, body: JSON.stringify({ error: "Already used" }) };

    const hash = crypto.createHash("sha256").update(code).digest("hex");
    if (hash !== share.code_hash) return { statusCode: 401, headers, body: JSON.stringify({ error: "Invalid code" }) };

    const { data: signed, error: signErr } =
      await admin.storage.from(share.bucket).createSignedUrl(share.path, 60);
    if (signErr) return { statusCode: 500, headers, body: JSON.stringify({ error: signErr.message }) };

    await admin.from("shares").update({ uses: share.uses + 1 }).eq("id", id);

    return { statusCode: 200, headers, body: JSON.stringify({ url: signed.signedUrl }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || String(e) }) };
  }
}
