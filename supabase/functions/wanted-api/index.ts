// Wanted.fun backend: free (gasless) submissions + private submission viewing.
// Money stays on-chain in WantedEscrow. This function only stores the WORK people submit.
// Auth = wallet signatures (personal_sign, free). The poster is read from the escrow contract on-chain.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicClient, http, isAddress, parseAbi } from "npm:viem@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const BUCKET = "submissions";
const MB = 1024 * 1024;
const MAX_NOTE = 1000;
const MAX_LINKS = 5;
const MAX_FILES = 4;
const MAX_SUBMISSIONS_PER_BOUNTY = 200;
const SIGNED_URL_SECONDS = 3600;

const TYPES: Record<string, { ext: string; max: number }> = {
  "image/png": { ext: "png", max: 5 * MB },
  "image/jpeg": { ext: "jpg", max: 5 * MB },
  "image/webp": { ext: "webp", max: 5 * MB },
  "video/mp4": { ext: "mp4", max: 25 * MB },
  "video/webm": { ext: "webm", max: 25 * MB },
};

const ABI = parseAbi([
  "function getBounty(uint256 id) view returns ((uint256 id, address poster, bytes title, bytes description, uint256 rewardPerWinner, uint256 maxWinners, uint256 winnersApproved, uint64 deadline, uint256 escrowRemaining, bool reclaimedUnused, bool cancelled))",
]);

// ---- message formats (the frontend builds the exact same strings) ----
const submitMessage = (chainId: number, contract: string, bountyId: number, hash: string, signedAt: number) =>
  `Wanted.fun submission\nChain: ${chainId}\nContract: ${contract}\nBounty: ${bountyId}\nContent hash: ${hash}\nSigned at: ${signedAt}`;
const readMessage = (chainId: number, contract: string, scope: string, signedAt: number) =>
  `Wanted.fun read access\nChain: ${chainId}\nContract: ${contract}\nScope: ${scope}\nSigned at: ${signedAt}`;

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Clean = {
  note: string;
  links: string[];
  files: { name: string; type: string; size: number; object: string }[];
};

function cleanContent(b: any): Clean {
  const note = String(b.note ?? "").trim();
  if (note.length > MAX_NOTE) fail(400, `Note is too long (max ${MAX_NOTE} characters).`);

  const rawLinks: unknown[] = Array.isArray(b.links) ? b.links : [];
  if (rawLinks.length > MAX_LINKS) fail(400, `Too many links (max ${MAX_LINKS}).`);
  const links = rawLinks.map((l) => {
    const s = String(l).trim();
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      return fail(400, "One of the links is not a valid URL.");
    }
    if (u.protocol !== "https:" || s.length > 500) fail(400, "Links must start with https:// and be under 500 characters.");
    return s;
  });

  const rawFiles: any[] = Array.isArray(b.files) ? b.files : [];
  if (rawFiles.length > MAX_FILES) fail(400, `Too many files (max ${MAX_FILES}).`);
  const files = rawFiles.map((f, i) => {
    const type = String(f?.type ?? "");
    const rule = TYPES[type];
    if (!rule) fail(400, "Only png, jpg, webp images and mp4, webm videos are allowed.");
    const size = Number(f?.size);
    if (!Number.isInteger(size) || size <= 0 || size > rule.max) {
      fail(400, `File too large (max ${rule.max / MB} MB for ${type.split("/")[0]}s). Paste a link for bigger files.`);
    }
    const name = String(f?.name ?? "file").replace(/[^\w.\- ]/g, "_").slice(0, 80) || "file";
    return { name, type, size, object: `${i}.${rule.ext}` };
  });

  if (!note && !links.length && !files.length) fail(400, "Add a note, a link or a file.");
  return { note, links, files };
}

const contentHash = (c: Clean) =>
  sha256Hex(JSON.stringify({ note: c.note, links: c.links, files: c.files.map((f) => ({ type: f.type, size: f.size })) }));

function checkTime(signedAt: number, maxAgeSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(signedAt) || signedAt > now + 300 || now - signedAt > maxAgeSeconds) {
    fail(401, "Signature expired. Please sign again.");
  }
}

async function chainCtx(chainIdRaw: unknown, contractRaw: unknown) {
  const chainId = Number(chainIdRaw);
  if (!Number.isSafeInteger(chainId)) fail(400, "Bad chain.");
  const contract = String(contractRaw ?? "").toLowerCase();
  if (!isAddress(contract)) fail(400, "Bad contract.");
  const { data } = await db.from("chains").select("rpc_url, contracts").eq("chain_id", chainId).maybeSingle();
  if (!data || !data.contracts.includes(contract)) fail(400, "This contract is not supported by the backend.");
  const client = createPublicClient({ transport: http(data.rpc_url) });
  return { chainId, contract, client };
}

async function readBounty(client: any, contract: string, bountyId: number) {
  try {
    return await client.readContract({
      address: contract as `0x${string}`,
      abi: ABI,
      functionName: "getBounty",
      args: [BigInt(bountyId)],
    });
  } catch {
    return fail(404, "Bounty not found (or the network is busy). Try again.");
  }
}

async function verifySig(client: any, address: string, message: string, signature: unknown) {
  let ok = false;
  try {
    ok = await client.verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` });
  } catch {
    ok = false;
  }
  if (!ok) fail(401, "Signature check failed.");
}

const bountyIdOf = (v: unknown) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? n : fail(400, "Bad bounty id.");
};
const addrOf = (v: unknown) => {
  const s = String(v ?? "").toLowerCase();
  return isAddress(s) ? s : fail(400, "Bad address.");
};
const folderOf = (chainId: number, contract: string, bountyId: number, id: string) =>
  `${chainId}/${contract}/${bountyId}/${id}`;

// ---- actions ----
async function counts(b: any) {
  const { chainId, contract } = await chainCtx(b.chainId, b.contract);
  const ids: number[] = (Array.isArray(b.bountyIds) ? b.bountyIds : []).slice(0, 100).map(bountyIdOf);
  if (!ids.length) return { counts: {} };
  const { data } = await db
    .from("submissions")
    .select("bounty_id")
    .eq("chain_id", chainId)
    .eq("contract", contract)
    .eq("status", "ready")
    .in("bounty_id", ids)
    .range(0, 9999);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[String(r.bounty_id)] = (out[String(r.bounty_id)] ?? 0) + 1;
  return { counts: out };
}

async function prepare(b: any) {
  const bountyId = bountyIdOf(b.bountyId);
  const submitter = addrOf(b.submitter);
  const { chainId, contract, client } = await chainCtx(b.chainId, b.contract);
  const content = cleanContent(b);
  const signedAt = Number(b.signedAt);
  checkTime(signedAt, 600);
  await verifySig(client, submitter, submitMessage(chainId, contract, bountyId, await contentHash(content), signedAt), b.signature);

  const bounty = (await readBounty(client, contract, bountyId)) as any;
  if (bounty.cancelled) fail(409, "This bounty was cancelled.");
  if (Math.floor(Date.now() / 1000) >= Number(bounty.deadline)) fail(409, "The deadline has passed.");
  if (bounty.winnersApproved >= bounty.maxWinners) fail(409, "All winner spots are already filled.");
  if (String(bounty.poster).toLowerCase() === submitter) fail(403, "You can't submit to your own bounty.");

  const { count } = await db
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("chain_id", chainId)
    .eq("contract", contract)
    .eq("bounty_id", bountyId)
    .eq("status", "ready");
  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_BOUNTY) fail(429, "This bounty has reached its submission limit.");

  const { data: existing } = await db
    .from("submissions")
    .select("id, status")
    .eq("chain_id", chainId)
    .eq("contract", contract)
    .eq("bounty_id", bountyId)
    .eq("submitter", submitter)
    .maybeSingle();
  if (existing?.status === "ready") fail(409, "You already submitted to this bounty.");
  if (existing) await db.from("submissions").delete().eq("id", existing.id); // abandoned half-finished attempt

  const { data: row, error } = await db
    .from("submissions")
    .insert({
      chain_id: chainId,
      contract,
      bounty_id: bountyId,
      submitter,
      note: content.note,
      links: content.links,
      files: content.files,
      signature: String(b.signature),
      signed_at: signedAt,
    })
    .select("id")
    .single();
  if (error || !row) return fail(500, "Could not save the submission.");

  const folder = folderOf(chainId, contract, bountyId, row.id);
  const uploads = [];
  for (const f of content.files) {
    const { data, error: e } = await db.storage.from(BUCKET).createSignedUploadUrl(`${folder}/${f.object}`);
    if (e || !data) return fail(500, "Could not prepare the upload.");
    uploads.push({ type: f.type, signedUrl: data.signedUrl });
  }
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const uploadHeaders: Record<string, string> = anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {};
  return { submissionId: row.id, uploads, uploadHeaders };
}

async function finalize(b: any) {
  const bountyId = bountyIdOf(b.bountyId);
  const submitter = addrOf(b.submitter);
  const { chainId, contract } = await chainCtx(b.chainId, b.contract);
  const { data: row } = await db
    .from("submissions")
    .select("id, files, status")
    .eq("id", String(b.submissionId))
    .eq("chain_id", chainId)
    .eq("contract", contract)
    .eq("bounty_id", bountyId)
    .eq("submitter", submitter)
    .maybeSingle();
  if (!row) return fail(404, "Submission not found.");
  if (row.status === "ready") return { ok: true };

  const files = row.files as Clean["files"];
  if (files.length) {
    const { data: listed } = await db.storage.from(BUCKET).list(folderOf(chainId, contract, bountyId, row.id), { limit: 20 });
    for (const f of files) {
      const hit = (listed ?? []).find((o: any) => o.name === f.object);
      if (!hit) return fail(409, `Upload incomplete: ${f.name}`);
      if (Number((hit as any).metadata?.size) !== f.size) return fail(409, `Upload size mismatch: ${f.name}`);
    }
  }
  await db.from("submissions").update({ status: "ready" }).eq("id", row.id);
  return { ok: true };
}

async function signedFiles(chainId: number, contract: string, rows: any[]) {
  const out: any[] = [];
  for (const r of rows) {
    const folder = folderOf(chainId, contract, r.bounty_id, r.id);
    const files = (r.files as Clean["files"]) ?? [];
    const paths = files.map((f) => `${folder}/${f.object}`);
    const signed = paths.length ? (await db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)).data ?? [] : [];
    out.push({
      id: r.id,
      bountyId: Number(r.bounty_id),
      submitter: r.submitter,
      note: r.note,
      links: r.links,
      createdAt: r.created_at,
      files: files.map((f, i) => ({ name: f.name, type: f.type, size: f.size, url: signed[i]?.signedUrl ?? null })),
    });
  }
  return out;
}

async function list(b: any) {
  const bountyId = bountyIdOf(b.bountyId);
  const requester = addrOf(b.requester);
  const { chainId, contract, client } = await chainCtx(b.chainId, b.contract);
  const signedAt = Number(b.signedAt);
  checkTime(signedAt, 3600);
  await verifySig(client, requester, readMessage(chainId, contract, `bounty:${bountyId}`, signedAt), b.signature);

  const bounty = (await readBounty(client, contract, bountyId)) as any;
  const isPoster = String(bounty.poster).toLowerCase() === requester;

  let q = db
    .from("submissions")
    .select("id, bounty_id, submitter, note, links, files, created_at")
    .eq("chain_id", chainId)
    .eq("contract", contract)
    .eq("bounty_id", bountyId)
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(MAX_SUBMISSIONS_PER_BOUNTY);
  if (!isPoster) q = q.eq("submitter", requester); // workers only ever see their own submission
  const { data } = await q;
  return { role: isPoster ? "poster" : "worker", submissions: await signedFiles(chainId, contract, data ?? []) };
}

async function mine(b: any) {
  const requester = addrOf(b.requester);
  const { chainId, contract, client } = await chainCtx(b.chainId, b.contract);
  const signedAt = Number(b.signedAt);
  checkTime(signedAt, 3600);
  await verifySig(client, requester, readMessage(chainId, contract, "mine", signedAt), b.signature);
  const { data } = await db
    .from("submissions")
    .select("id, bounty_id, created_at")
    .eq("chain_id", chainId)
    .eq("contract", contract)
    .eq("submitter", requester)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(200);
  return { submissions: (data ?? []).map((r) => ({ id: r.id, bountyId: Number(r.bounty_id), createdAt: r.created_at })) };
}

const ACTIONS: Record<string, (b: any) => Promise<unknown>> = { counts, prepare, finalize, list, mine };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json();
    const handler = ACTIONS[String(body?.action)];
    if (!handler) return json({ error: "Unknown action." }, 400);
    return json(await handler(body));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong." }, 500);
  }
});
