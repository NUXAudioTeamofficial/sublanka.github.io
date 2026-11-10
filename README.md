# SubLanka — සිංහල උපසිරැසි ලෝකය

A Sinhala-subtitle catalogue: visitors find a movie, watch the official trailer and download the subtitle file.
The site owner manages everything from a private admin panel.

| Part | Technology | Cost |
| --- | --- | --- |
| Website | React + Vite, static files on **GitHub Pages** | free |
| Database, login, server functions | **Supabase** (Postgres + Auth + Edge Functions) | free plan |
| Movie details and posters | **TMDB API** (key kept on the server) | free |
| Subtitle files | Your own **Google Drive** (public "anyone with the link" files) | free |
| Trailers | Official **YouTube** embed, loaded only when the visitor presses play | free |
| AI help (optional) | Google **Gemini** free tier, key kept on the server | free tier |

> **What this site is for.** It lists subtitle files that you made yourself or have permission to share.
> It does not host or link to films, and the admin panel will not publish a subtitle until its rights status says
> you may share it. Keep it that way — it is also what keeps the site from being taken down.

---

## සිංහලෙන් කෙටියෙන් (Quick guide in Sinhala)

1. **Admin panel එක:** `https://<your-site>/admin/` — ඔබේ email + password එකෙන් log වෙන්න.
2. **චිත්‍රපටයක් එක් කිරීම:** Movies → Add movie → TMDB එකෙන් නම සොයා තෝරන්න → Trailer එක ඔබම තෝරන්න → *Published* tick කර Save.
3. **උපසිරැසියක් එක් කිරීම:** ගොනුව Google Drive එකට upload කර *Share → Anyone with the link* කරන්න → චිත්‍රපටයේ පිටුවේ *Add subtitle* → link එක paste කර **Verify link** → Rights status තෝරා *Published* tick කර Save.
4. අලුත් චිත්‍රපට වෙබ් අඩවියේ **වහාම** පෙනේ. Google සෙවුම සඳහා වන වෙනම පිටුව පැය 6කට වරක් ස්වයංක්‍රීයව සෑදේ.
5. කිසිවෙක් පැමිණිල්ලක් එවුවහොත්: Requests → අදාළ උපසිරැසියේ **Dispute** (පලිහ) බොත්තම ඔබන්න — එය වහාම අඩවියෙන් ඉවත් වේ.

---

## 1. One-time setup

### 1.1 Supabase

1. Create a free project at <https://supabase.com>.
2. **SQL Editor → New query** → paste the whole of [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql) → **Run**.
   This creates the tables, the security rules (Row Level Security) and the default settings.
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Only people you add can log in.
4. **Authentication → URL Configuration**: set *Site URL* to `https://<user>.github.io/<repo>/admin/` and add
   `https://<user>.github.io/<repo>/**` to *Redirect URLs*.
5. **Project Settings → API Keys**: copy the *Project URL* and the **publishable** (`sb_publishable_…`, formerly "anon") key.
   These two are public by design. Never use the `service_role` / `sb_secret_…` key in this project.

### 1.2 First admin

There is no public registration and no "make me admin" button — on purpose.

1. Supabase → **Authentication → Users → Add user → Create new user**. Enter your email and a long password, tick *Auto Confirm User*.
2. Supabase → **SQL Editor**, run:

   ```sql
   select public.grant_admin('you@example.com');
   ```

3. Open `/admin/` on the site and sign in.

To remove an admin: `select public.revoke_admin('someone@example.com');`
A signed-in account without the admin role sees "No admin access" and cannot read or change anything — the database enforces it, not the web page.

### 1.3 Edge Functions

Three small server functions keep the secret keys off the website. Each one refuses anyone who is not an admin.

| Function | What it does | Secret it needs |
| --- | --- | --- |
| `tmdb` | Search TMDB, fetch details and the list of trailers | `TMDB_API_KEY` |
| `drive-check` | Checks that a Google Drive file really downloads without signing in; returns the text for preview | none |
| `ai` | Sinhala description draft, subtitle translation, proofreading | `GEMINI_API_KEY` (optional) |

Deploy with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy tmdb --no-verify-jwt
supabase functions deploy drive-check --no-verify-jwt
supabase functions deploy ai --no-verify-jwt
```

`--no-verify-jwt` is correct here: every function checks the caller itself (valid login **and** `is_admin()`), and answers `403` otherwise.

Set the secrets in **Supabase → Edge Functions → Secrets** (or `supabase secrets set NAME=value`):

- `TMDB_API_KEY` — free at <https://www.themoviedb.org/settings/api>. Either the short "API Key" or the long "API Read Access Token" works.
- `GEMINI_API_KEY` — see *AI (optional)* below.

Admin → **Settings** shows whether each service is connected.

### 1.4 GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables** (the *Variables* tab, not Secrets):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your publishable key
4. **Actions → Deploy to GitHub Pages → Run workflow** (it also runs on every push to `main`).

The workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) runs the tests, builds the site, creates one HTML page per published movie plus `sitemap.xml`, and publishes it. It repeats every 6 hours so new movies get their own search-engine page.

> GitHub pauses scheduled workflows after 60 days without any commit. If that happens, open the **Actions** tab and press *Enable workflow*, or just run it by hand.

---

## 2. Daily use

### Add a movie
**Movies → Add movie.** Type the title (and year) in the TMDB box and pick the right result — title, year, language, genres, rating, runtime, poster and overview are filled in. Then:

- **Trailer:** TMDB's trailer list is shown; *you* pick one (nothing is chosen automatically). Or paste any YouTube link. Leave it empty if there is no official trailer.
- **Sinhala description:** write it, or press *Write a Sinhala draft with AI*. The draft uses only the facts in the form. Read it before saving.
- Tick **Published** and save.

### Add a subtitle
1. Upload the `.srt` / `.vtt` / `.ass` file to Google Drive. Right-click → **Share → General access → Anyone with the link (Viewer)** → **Copy link**.
2. Open the movie in the admin → **Add subtitle** → paste the link → **Verify link**. *Preview & validate* also shows the first lines and a quality report.
3. Choose the **rights status**. Only *Own work*, *Licensed*, *Permission granted* and *Public domain* can be published.
4. Tick **Published** → Save.

If you later change the Drive file, the entry goes back to "unverified" and offline until you verify it again.

### Complaints and takedowns
Messages from the Copyright / Contact page arrive under **Requests**. To take a subtitle offline at once, press the shield button (**Dispute**) on it — it is hidden immediately and cannot be re-published until you change its rights status.

### AI (optional)
Create a free key at <https://aistudio.google.com/apikey> and save it as the Edge Function secret `GEMINI_API_KEY`
(optional: `GEMINI_MODEL` to force a model; by default the function picks the newest Flash model your key can use). Without a key the site works normally; only the AI buttons are disabled.

**AI Studio** takes one film from source text to an approved Sinhala `.srt` in six steps:

1. **Movie & rights** — pick the movie, say where the dialogue text comes from, and confirm you may translate it.
2. **Source text** — open the original/English `.srt` you are allowed to use (for your own recordings, make one with `tools/transcribe.py`).
3. **Translate** — Gemini translates in small batches with your glossary of names; it can be stopped and resumed.
4. **Timing & QC** — fix overlaps, too-short cues, long lines; shift all timings.
5. **Review & approve** — read every line next to the source, correct it, then approve. Approval is blocked while the quality report has errors or the rights are not confirmed.
6. **Publish** — download the file, upload it to your Drive, create the subtitle entry.

Nothing is published automatically. AI translation of Sinhala is a draft — slang, jokes and honorifics need a human.
The free Gemini tier has daily request limits; a full film is roughly 30–50 requests.

`tools/transcribe.py` (optional, runs on your own computer):

```bash
pip install faster-whisper
python tools/transcribe.py my-film.mp4 --language ta
```

---

## 3. Developing locally

```bash
cp .env.example .env      # fill in the Supabase URL and publishable key
npm install
npm run dev               # http://localhost:5173
npm test                  # subtitle parser / link helper tests
npm run build             # production build + per-movie pages + sitemap in dist/
node scripts/pages-preview.mjs / 4173   # serves dist/ the way GitHub Pages does (incl. 404.html)
```

Project map:

```
src/pages/            public pages (Home, Browse, MovieDetail, StaticPages)
src/pages/admin/      admin panel (loaded only on /admin/, never by visitors)
src/lib/              helpers: Drive links, YouTube ids, SRT parser + quality checks, SEO
src/services/         data access (public: plain fetch · admin: supabase-js)
scripts/postbuild.mjs per-page HTML, sitemap.xml, robots.txt, 404.html
supabase/migrations/  database schema + security rules
supabase/functions/   tmdb, drive-check, ai
tools/transcribe.py   local speech-to-text helper
```

---

## 4. Security notes

- The website contains only the Supabase URL and publishable key. Every table has Row Level Security: visitors can read **published** movies/subtitles and submit a contact message — nothing else.
- TMDB and Gemini keys live only in Supabase Edge Function secrets.
- Admin rights are a database role (`profiles.is_admin`), changeable only from the SQL editor.
- Download counts go through `register_download()`, which only counts published subtitles.
- Never commit `.env`, a `service_role` key, a database password or a GitHub token.

## 5. Limits you should know about

- **Supabase free plan** pauses a project after about a week with no activity (visitors count as activity). Un-pause it from the dashboard. Database size limit: 500 MB — far more than a catalogue needs.
- **Search engines:** each published movie gets a real HTML page with title, description, Open Graph tags and JSON-LD at the next build (every 6 hours, or run the workflow by hand). Until then the movie works for visitors but is served through the `404.html` fallback.
- **robots.txt** is only honoured at the root of a domain. On `user.github.io/repo/` it is ignored; the admin pages carry a `noindex` tag instead. With a custom domain it works normally.
- **Google Drive** may show a "can't scan for viruses" page for very large files and can throttle a file that is downloaded extremely often. Subtitle files are tiny, so this is rare.
- **TMDB** data is used under their terms: the footer shows the required attribution. This product uses the TMDB API but is not endorsed or certified by TMDB.
