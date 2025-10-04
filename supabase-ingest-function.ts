// supabase/functions/ingest_inventory/index.ts
// Deno Edge Function for Excel ingestion to Supabase

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

type Row = {
  sku: string | number;
  name: string;
  category?: string;
  qty?: number | string;
  cost?: number | string | null;
  price?: number | string | null;
  is_active?: boolean | string | number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_INGEST_SECRET"); // optional hard gate

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: any): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  if (["true", "yes", "1", "active"].includes(s)) return true;
  if (["false", "no", "0", "inactive"].includes(s)) return false;
  return null;
}

Deno.serve(async (req) => {
  try {
    // CORS headers for browser requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      });
    }

    // Optional secret header gate (recommended)
    if (ADMIN_SECRET) {
      const h = req.headers.get("x-admin-secret");
      if (h !== ADMIN_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
    } else {
      // If not using secret, fall back to checking JWT profile
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "No auth token" }), { 
          status: 401,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
      
      const token = authHeader.split(" ")[1];
      const userClient = createClient(SUPABASE_URL, token, {
        global: { headers: { Authorization: authHeader } },
      });
      
      const { data: { user }, error: uErr } = await userClient.auth.getUser();
      if (uErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthenticated" }), { 
          status: 401,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
      
      const { data: prof } = await adminClient.from("profiles").select("is_admin").eq("id", user.id).single();
      if (!prof?.is_admin) {
        return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), { 
          status: 403,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const path: string = body?.path ?? "current.xlsx"; // default

    // 1) Download Excel file from the 'inventory' bucket
    const { data: fileData, error: dlErr } = await adminClient.storage
      .from("inventory")
      .download(path);
      
    if (dlErr) {
      return new Response(JSON.stringify({ error: `download: ${dlErr.message}` }), { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    const buf = await fileData.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    // Use the first sheet
    const ws = wb.Sheets[wb.SheetNames[0]];
    let rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });

    if (!rows.length) {
      return new Response(JSON.stringify({ error: "No rows found in sheet" }), { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    // Normalize rows
    const normalized = rows.map((r) => ({
      sku: String(r.sku ?? "").trim(),
      name: String(r.name ?? "").trim(),
      category: r.category ? String(r.category).trim() : null,
      qty: toNum(r.qty) ?? 0,
      cost: toNum(r.cost),
      price: toNum(r.price),
      is_active: toBool(r.is_active) ?? true,
      updated_at: new Date().toISOString(),
    })).filter(r => r.sku && r.name);

    console.log(`Processing ${normalized.length} items from Excel`);

    // 2) Chunked upserts to avoid payload limits
    const chunkSize = 500;
    let totalProcessed = 0;
    
    for (let i = 0; i < normalized.length; i += chunkSize) {
      const chunk = normalized.slice(i, i + chunkSize);
      const { error: upErr } = await adminClient
        .from("inventory_items")
        .upsert(chunk, { onConflict: "sku" });
        
      if (upErr) {
        return new Response(JSON.stringify({ 
          error: `upsert error: ${upErr.message}`, 
          at: i,
          processed: totalProcessed 
        }), { 
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
      
      totalProcessed += chunk.length;
      console.log(`Processed ${totalProcessed}/${normalized.length} items`);
    }

    // Optional: reconcile deletions by marking items missing from file as inactive
    if (body?.reconcileMissing === true) {
      const skus = normalized.map(r => r.sku);
      const { error: recErr } = await adminClient.rpc("deactivate_missing_inventory", { p_skus: skus });
      if (recErr) {
        // non-fatal
        console.warn("reconcile error", recErr.message);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      rows: normalized.length,
      message: `Successfully processed ${normalized.length} inventory items`
    }), { 
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
    
  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  }
});