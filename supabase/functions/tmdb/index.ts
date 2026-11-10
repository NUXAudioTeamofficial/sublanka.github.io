// SubLanka Edge Function: tmdb
// Admin-only proxy for The Movie Database API. The TMDB key lives in the
// function secret TMDB_API_KEY and is never sent to the browser or to GitHub.
//
// Body: { action: "search", query, year? } | { action: "details", id } | { action: "status" }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// The caller's own JWT is checked by the database (public.is_admin()); the
// function holds no privileged database key at all.
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

const IMG = "https://image.tmdb.org/t/p";

async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = (Deno.env.get("TMDB_API_KEY") ?? "").trim();
  if (!key) throw { status: 503, message: "TMDB is not configured. Add the secret TMDB_API_KEY to the Supabase project (Edge Functions > Secrets)." };
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // v4 "API Read Access Token"
  else url.searchParams.set("api_key", key); // v3 API key
  const r = await fetch(url, { headers });
  if (r.status === 401) throw { status: 502, message: "TMDB rejected the API key (401). Check the TMDB_API_KEY secret." };
  if (r.status === 404) throw { status: 404, message: "Not found on TMDB." };
  if (r.status === 429) throw { status: 429, message: "TMDB rate limit reached. Try again in a few seconds." };
  if (!r.ok) throw { status: 502, message: `TMDB error ${r.status}.` };
  return r.json();
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

  try {
    if (body.action === "status") {
      return json({ configured: Boolean((Deno.env.get("TMDB_API_KEY") ?? "").trim()) });
    }

    if (body.action === "search") {
      const query = String(body.query ?? "").trim().slice(0, 200);
      if (!query) return json({ error: "Type a movie title." }, 400);
      const year = /^[0-9]{4}$/.test(String(body.year ?? "")) ? String(body.year) : "";
      const data = await tmdb("/search/movie", { query, year, include_adult: "false", language: "en-US", page: "1" });
      return json({
        results: (data.results ?? []).slice(0, 12).map((m: Record<string, any>) => ({
          tmdb_id: m.id,
          title: m.title,
          original_title: m.original_title,
          release_year: m.release_date ? Number(String(m.release_date).slice(0, 4)) : null,
          language: m.original_language,
          poster_url: m.poster_path ? `${IMG}/w185${m.poster_path}` : null,
          overview: m.overview ?? "",
          rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
        })),
      });
    }

    if (body.action === "details") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid TMDB id." }, 400);
      const m = await tmdb(`/movie/${id}`, { append_to_response: "videos", language: "en-US", include_video_language: "en,null,ta,te,hi,ml,kn,si,ko,ja,zh" });
      const trailers = ((m.videos?.results ?? []) as Record<string, any>[])
        .filter((v) => v.site === "YouTube" && /^[A-Za-z0-9_-]{11}$/.test(v.key ?? "") && ["Trailer", "Teaser"].includes(v.type))
        .sort((a, b) => Number(b.official) - Number(a.official) || (a.type === "Trailer" ? -1 : 1) - (b.type === "Trailer" ? -1 : 1) ||
          String(b.published_at).localeCompare(String(a.published_at)))
        .slice(0, 8)
        .map((v) => ({ key: v.key, name: v.name, type: v.type, official: Boolean(v.official), language: v.iso_639_1, published_at: v.published_at }));
      return json({
        movie: {
          tmdb_id: m.id,
          title: m.title,
          original_title: m.original_title,
          release_year: m.release_date ? Number(String(m.release_date).slice(0, 4)) : null,
          language: m.original_language,
          poster_url: m.poster_path ? `${IMG}/w500${m.poster_path}` : null,
          backdrop_url: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : null,
          genres: (m.genres ?? []).map((g: Record<string, any>) => g.name),
          rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
          vote_count: m.vote_count ?? null,
          runtime: m.runtime || null,
          overview: m.overview ?? "",
        },
        trailers,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return json({ error: err.message ?? "Unexpected error" }, err.status ?? 500);
  }
});
