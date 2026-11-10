// SubLanka Edge Function: ai
// Admin-only AI helper (Google Gemini API). The key lives in the function
// secret GEMINI_API_KEY. Nothing here publishes anything: every result goes
// back to the admin for review.
//
// Body: { action: "status" }
//     | { action: "describe", movie: { title, original_title, release_year, language, genres, overview } }
//     | { action: "translate", rights_confirmed: true, cues: [{ id, text }], glossary?, context?, source_lang?, previous?: [{ source, target }] }
//     | { action: "proofread", cues: [{ id, text }] }

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

const API = "https://generativelanguage.googleapis.com/v1beta";
const MAX_CUES = 60;
const MAX_CHARS = 14_000;
let cachedModel: string | null = null;

const apiKey = () => (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
const bare = (name: string) => (name.startsWith("models/") ? name.slice(7) : name);

// Uses GEMINI_MODEL when set; otherwise asks the API which models this key can use and
// picks the newest stable "flash" model, so the function keeps working when Google retires a model.
async function resolveModel(): Promise<string> {
  const forced = (Deno.env.get("GEMINI_MODEL") ?? "").trim();
  if (forced) return bare(forced);
  if (cachedModel) return cachedModel;
  try {
    const r = await fetch(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey() } });
    if (r.ok) {
      const data = await r.json();
      const names: string[] = (data.models ?? [])
        .filter((m: Record<string, any>) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m: Record<string, any>) => bare(String(m.name)));
      const stable = names
        .map((n) => ({ n, m: n.match(/^gemini-([0-9]+(?:[.][0-9]+)?)-flash$/) }))
        .filter((x) => x.m)
        .sort((a, b) => Number(b.m![1]) - Number(a.m![1]));
      if (stable.length) return (cachedModel = stable[0].n);
      const anyFlash = names.find((n) => /flash/.test(n) && !/image|tts|audio|live|embedding/.test(n));
      if (anyFlash) return (cachedModel = anyFlash);
    }
  } catch { /* fall back below */ }
  return (cachedModel = "gemini-2.5-flash");
}

async function generate(system: string, user: string, schema: unknown | null, temperature: number): Promise<string> {
  const model = await resolveModel();
  const r = await fetch(`${API}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature,
        ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
      },
    }),
  });
  if (r.status === 429) throw { status: 429, message: "AI rate limit reached (free-tier quota). Wait about a minute, then continue." };
  if (r.status === 400 || r.status === 403) {
    const detail = await r.json().catch(() => ({}));
    throw { status: 502, message: `The AI service rejected the request: ${detail?.error?.message ?? r.status}. Check GEMINI_API_KEY / GEMINI_MODEL.` };
  }
  if (r.status === 404) {
    cachedModel = null;
    throw { status: 502, message: `AI model "${model}" is not available for this key. Set the GEMINI_MODEL secret to a model you can use.` };
  }
  if (!r.ok) throw { status: 502, message: `AI service error ${r.status}. Try again.` };
  const data = await r.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: Record<string, any>) => p.text ?? "").join("");
  if (!text) {
    const why = cand?.finishReason ?? data.promptFeedback?.blockReason ?? "no output";
    throw { status: 502, message: `The AI returned no text (${why}).` };
  }
  return text;
}

const CUE_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { id: { type: "INTEGER" }, text: { type: "STRING" } }, required: ["id", "text"] },
};
const FIX_SCHEMA = {
  type: "ARRAY",
  items: { type: "OBJECT", properties: { id: { type: "INTEGER" }, text: { type: "STRING" }, note: { type: "STRING" } }, required: ["id", "text"] },
};

function readCues(raw: unknown): { id: number; text: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) throw { status: 400, message: "No cues were sent." };
  if (raw.length > MAX_CUES) throw { status: 400, message: `Send at most ${MAX_CUES} cues per request.` };
  const cues = raw.map((c) => ({ id: Number((c as any)?.id), text: String((c as any)?.text ?? "") }));
  if (cues.some((c) => !Number.isInteger(c.id))) throw { status: 400, message: "Every cue needs an integer id." };
  if (cues.reduce((n, c) => n + c.text.length, 0) > MAX_CHARS) throw { status: 400, message: "Too much text in one request." };
  return cues;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await isAdmin(req))) return json({ error: "Not authorized. Sign in as an admin." }, 403);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.action === "status") {
      if (!apiKey()) return json({ configured: false });
      return json({ configured: true, model: await resolveModel() });
    }
    if (!apiKey()) {
      return json({ error: "AI is not configured. Add the secret GEMINI_API_KEY to the Supabase project (Edge Functions > Secrets)." }, 503);
    }

    if (body.action === "describe") {
      const m = body.movie ?? {};
      const overview = String(m.overview ?? "").trim();
      if (overview.length < 40) {
        return json({ error: "There is no verified overview to base a description on. Fetch the movie from TMDB first, or write the description by hand." }, 422);
      }
      const system = [
        "You write short movie descriptions in natural, fluent, modern Sinhala (සිංහල) for a subtitle website.",
        "Use ONLY the facts in the JSON you are given. Never invent plot details, character names, cast, awards, box-office figures or endings.",
        "No major spoilers: describe the premise and the central conflict, never the resolution or twists.",
        "Write one paragraph of 50 to 100 Sinhala words. Plain text only: no markdown, no heading, no quotation marks around the text.",
        "Keep the movie title and personal names in their original Latin spelling.",
        "If the facts are thin, write a shorter description instead of adding anything that is not in the input.",
      ].join(" ");
      const facts = {
        title: String(m.title ?? ""),
        original_title: String(m.original_title ?? ""),
        release_year: m.release_year ?? null,
        original_language: String(m.language ?? ""),
        genres: Array.isArray(m.genres) ? m.genres.slice(0, 8) : [],
        overview: overview.slice(0, 2500),
      };
      const text = await generate(system, JSON.stringify(facts), null, 0.5);
      return json({ description: text.trim().replace(/^["“]|["”]$/g, ""), model: await resolveModel() });
    }

    if (body.action === "translate") {
      if (body.rights_confirmed !== true) {
        return json({ error: "Confirm that you own this material or are authorised to translate and distribute it." }, 403);
      }
      const cues = readCues(body.cues);
      const system = [
        "You are a professional subtitle translator. Translate every cue into natural, spoken Sinhala (සිංහල) as used in well-made Sinhala film subtitles.",
        "Return a JSON array with exactly one object per input cue: { id, text }. Keep every id unchanged. Never merge, split, drop or reorder cues.",
        "Preserve meaning, tone, humour and register. Translate the sense, not word by word. Do not censor and do not add explanations or translator notes.",
        "Keep each cue short enough to read: at most 2 lines, about 42 characters per line.",
        "Keep formatting tags such as <i>…</i>, music notes (♪) and leading dialogue dashes exactly where they belong.",
        "Translate sound descriptions in brackets, e.g. [door slams] -> [දොර වැසෙන හඬ].",
        "Keep personal and place names consistent. Follow the glossary exactly when a term appears in it.",
        "If a cue has no translatable text (only symbols or numbers), return it unchanged.",
      ].join(" ");
      const user = JSON.stringify({
        source_language: String(body.source_lang ?? "auto"),
        film_context: String(body.context ?? "").slice(0, 800),
        glossary: String(body.glossary ?? "").slice(0, 2000),
        previous_cues_for_continuity: Array.isArray(body.previous) ? body.previous.slice(-6) : [],
        cues,
      });
      const raw = await generate(system, user, CUE_SCHEMA, 0.3);
      let out: { id: number; text: string }[];
      try {
        out = JSON.parse(raw);
      } catch {
        throw { status: 502, message: "The AI answer was not valid JSON. Try again." };
      }
      const byId = new Map(out.map((c) => [Number(c.id), String(c.text ?? "")]));
      const missing = cues.filter((c) => !byId.has(c.id)).map((c) => c.id);
      return json({ cues: cues.filter((c) => byId.has(c.id)).map((c) => ({ id: c.id, text: byId.get(c.id) })), missing, model: await resolveModel() });
    }

    if (body.action === "proofread") {
      const cues = readCues(body.cues);
      const system = [
        "You proofread Sinhala (සිංහල) subtitles.",
        "Fix ONLY clear mistakes: spelling, wrong or missing vowel signs, broken conjuncts, spacing and punctuation.",
        "Do NOT rephrase, do not change meaning, names, tags or line breaks, and do not translate anything.",
        "Return a JSON array containing only the cues you changed: { id, text, note } where note says in a few English words what was fixed.",
        "If nothing needs fixing, return [].",
      ].join(" ");
      const raw = await generate(system, JSON.stringify({ cues }), FIX_SCHEMA, 0.1);
      let out: { id: number; text: string; note?: string }[];
      try {
        out = JSON.parse(raw);
      } catch {
        throw { status: 502, message: "The AI answer was not valid JSON. Try again." };
      }
      const original = new Map(cues.map((c) => [c.id, c.text]));
      const fixes = out
        .map((c) => ({ id: Number(c.id), text: String(c.text ?? ""), note: String(c.note ?? "") }))
        .filter((c) => original.has(c.id) && c.text && c.text !== original.get(c.id));
      return json({ fixes, model: await resolveModel() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return json({ error: err.message ?? "Unexpected error" }, err.status ?? 500);
  }
});
