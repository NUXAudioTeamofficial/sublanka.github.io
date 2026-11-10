# Public-domain catalogue

Real content for SubLanka that can be published without asking anyone for
permission. Every film here is in the public domain in the United States, so
translating its dialogue creates a subtitle we own outright.

## What this folder holds

```
<slug>/
  source.en.srt     reference English dialogue (timings come from here)
  si.srt.txt        the Sinhala translation, one line per cue:  "<number><TAB>text"
  si.srt / si.vtt   built by scripts/subtitle-build.mjs — the published files
  movie.json        metadata used to seed the database
```

`si.srt.txt` uses ` ⏎ ` to mark a line break inside a cue.

## Build

```sh
node scripts/subtitle-build.mjs content/public-domain/carnival-of-souls-1962
```

The builder re-uses the timings from `source.en.srt`, re-flows any cue that
would need three lines onto two balanced ones, then runs the repository's own
quality checker (`src/lib/srt.js`) and prints the report. It exits non-zero
when the file still has errors, so a broken subtitle never reaches the site.

```sh
node scripts/subtitle-build.mjs content/public-domain/<slug> --dump > /tmp/en.txt
```
prints the reference dialogue ready to translate.

## Where the reference dialogue comes from

The English reference files come from
[public-domain-film-quote-search](https://github.com/stefanbohacek/public-domain-film-quote-search) (MIT licence),
a dataset of public-domain films with their subtitles and links to legal copies
on the Internet Archive. Only the timings and the factual dialogue of the film
are used; the Sinhala text is written for SubLanka and is our own work.

## Rules before adding a film

1. **Confirm the film is public domain.** Check *List of films in the public
   domain in the United States* on Wikipedia, or the Internet Archive listing.
   When in doubt, do not publish it.
2. **Never add film or video files to Drive.** The SubLanka Drive folder holds
   subtitle text only.
3. **Fill in `movie.json` truthfully.** If a rating, trailer or runtime is not
   known, leave it empty rather than inventing one.
4. **Set `watch_url` to a legal copy** (usually the Internet Archive), so a
   visitor can watch the film and drop our subtitle onto it.
