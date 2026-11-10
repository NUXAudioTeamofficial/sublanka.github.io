// SubLanka Edge Function: drive-check
// Admin-only. Checks from the server side (no Google login, no cookies) whether a
// Google Drive file can really be downloaded by an anonymous visitor, and can
// return the text of small subtitle files for preview / validation.
//
// Body: { file_id: string, want_text?: boolean }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function isAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const base = Deno.env.get("SUPABASE_URL");
  if (!auth.startsWith("Bearer ") || !base || !apikey) return false;
  try {
    const r = await fetch(`${base}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { Authorization: auth, apikey, "Content-Type": "application/json" },
      body: "{}",
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

const MAX_TEXT_BYTES = 1_500_000;
const isAllowedHost = (h: string) => h === "drive.google.com" || h === "drive.usercontent.google.com" || h.endsWith(".googleusercontent.com");

function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = disposition.match(/filename[*] *= *UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch { /* fall through */ }
  }
  const plain = disposition.match(/filename *= *"?([^";]+)"?/i);
  return plain ? plain[1] : null;
}

function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "not-utf8" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await isAdmin(req))) return json({ error: "Not authorized. Sign in as an admin." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const fileId = String(body.file_id ?? "");
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(fileId)) return json({ error: "That does not look like a Google Drive file id." }, 400);
  const wantText = body.want_text === true;

  try {
    let url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    let res: Response | null = null;
    for (let hop = 0; hop < 6; hop++) {
      res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; SubLankaLinkCheck/1.0)" } });
      if (res.status < 300 || res.status >= 400) break;
      const next = res.headers.get("location");
      await res.body?.cancel();
      if (!next) break;
      const target = new URL(next, url);
      if (target.hostname === "accounts.google.com") {
        return json({ accessible: false, reason: "private", message: "Google asks for a sign-in. Share the file as “Anyone with the link — Viewer”." });
      }
      if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) {
        return json({ accessible: false, reason: "unexpected_redirect", message: "Google Drive redirected somewhere unexpected." });
      }
      url = target.toString();
      res = null;
    }
    if (!res) return json({ accessible: false, reason: "too_many_redirects", message: "Too many redirects from Google Drive." });

    if (res.status === 404) {
      await res.body?.cancel();
      return json({ accessible: false, reason: "not_found", status: 404, message: "Google Drive says this file does not exist (deleted, or the id is wrong)." });
    }
    if (res.status === 401 || res.status === 403) {
      await res.body?.cancel();
      return json({ accessible: false, reason: "private", status: res.status, message: "The file is private. Share it as “Anyone with the link — Viewer”." });
    }
    if (res.status === 429) {
      await res.body?.cancel();
      return json({ accessible: false, reason: "rate_limited", status: 429, message: "Google Drive is rate-limiting downloads of this file right now. Try again later." });
    }
    if (!res.ok) {
      await res.body?.cancel();
      return json({ accessible: false, reason: "http_error", status: res.status, message: `Google Drive answered with HTTP ${res.status}.` });
    }

    const contentType = res.headers.get("content-type") ?? "";
    const disposition = res.headers.get("content-disposition");
    const filename = filenameFrom(disposition);
    const size = Number(res.headers.get("content-length")) || null;

    // A real file download always carries Content-Disposition. An HTML page without it is
    // either the "can't scan for viruses" confirmation (still public) or an error / sign-in page.
    if (!disposition && contentType.includes("text/html")) {
      const html = (await res.text()).slice(0, 200_000);
      if (/download-form|uc-download-link|virus scan|Virus scan/i.test(html)) {
        return json({ accessible: true, note: "large_file", message: "Public, but Google shows a “can’t scan for viruses” confirmation page before the download (large file).", filename: null, size: null, contentType });
      }
      const quota = /quota|too many users/i.test(html);
      return json({
        accessible: false,
        reason: quota ? "quota" : "private",
        message: quota
          ? "Google Drive download quota for this file is exceeded right now."
          : "Google returned a web page instead of the file — it is not shared publicly. Share it as “Anyone with the link — Viewer”.",
      });
    }

    const result: Record<string, unknown> = { accessible: true, filename, size, contentType };
    if (wantText) {
      if (size && size > MAX_TEXT_BYTES) {
        await res.body?.cancel();
        result.text = null;
        result.message = "File is too large to preview (limit 1.5 MB).";
      } else {
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length > MAX_TEXT_BYTES) {
          result.text = null;
          result.message = "File is too large to preview (limit 1.5 MB).";
        } else if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
          result.text = null;
          result.message = "This is a ZIP archive — it cannot be previewed.";
        } else {
          const { text, encoding } = decodeText(bytes);
          result.text = text;
          result.encoding = encoding;
          result.size = bytes.length;
        }
      }
    } else {
      await res.body?.cancel();
    }
    return json(result);
  } catch (e) {
    return json({ accessible: false, reason: "network", message: `Could not reach Google Drive: ${(e as Error).message}` });
  }
});
