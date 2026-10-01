# Online lookup check

**Status: not run.** The owner chose to ship without the manual check on a Windows PC, and the computer that built this
release cannot reach reddit.com, tiktok.com or instagram.com (its network refuses them). So nothing here was tried
against the real sites. Each source is wired in and tested only against the response shapes saved in `tests/fixtures/`,
which follow the plan's examples, not captured answers.

What this means for the team:
- Whatever a platform refuses (blocked, a login page, a changed page, offline, too slow) falls back to typing the details
  in, with the note "Couldn't look up this post online. Type the details in." Logging never waits for a lookup, and a
  lookup never replaces a title or number already typed.
- Each computer can turn lookups off in **Settings → Post lookup**.

How Lux asks: desktop app only (Windows and Mac), never the web version, and only when a post link is pasted or typed.
Signed out, from that computer, with the system's `curl`, one link at a time: at most 8 seconds and 5 MB per request,
redirects followed over https only, HTTP errors count as failures, and English pages (`Accept-Language: en-US`).
Never with AdsPower or any account.

To run the check later: on a Windows 10 or 11 PC that is not running AdsPower traffic, open PowerShell and run each
command below for three real, public posts. On a Mac, use `curl` in Terminal instead of `curl.exe`.

## Reddit oEmbed

Result: **not checked.** Fixture: `tests/fixtures/reddit-oembed.json` (the plan's shape).

```powershell
curl.exe -sL --max-time 8 -A "Mozilla/5.0" "https://www.reddit.com/oembed?url=https://www.reddit.com/r/SUBREDDIT/comments/POSTID/"
```
`OK`: JSON with a `title`. `BLOCKED`: a 403 or an HTML page. `EMPTY`: nothing.

## TikTok

Results: **not checked.** Fixtures: `tests/fixtures/tiktok-oembed.json` and `tests/fixtures/tiktok-page.html` (the plan's
shapes). Lux asks for both at once, each with its own files: the caption from oEmbed (or the page), the views and likes
from the page. Either one can fail on its own.

```powershell
curl.exe -sL --max-time 8 -A "Mozilla/5.0" "https://www.tiktok.com/oembed?url=https://www.tiktok.com/@USER/video/VIDEOID"
curl.exe -sL --max-time 8 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "https://www.tiktok.com/@USER/video/VIDEOID" -o tiktok.html
```
- Does the oEmbed JSON have a `title`?
- Does `tiktok.html` contain `__UNIVERSAL_DATA_FOR_REHYDRATION__` with `playCount`?

## Instagram

Result: **not checked.** Fixture: `tests/fixtures/instagram-page.html` (the plan's shape). Instagram shows most posts only
to signed-in visitors, so this one may often fail. It never shows views signed out: Lux takes only the likes and the
caption, and only an exact count (a rounded "12K likes" is left to type).

```powershell
curl.exe -sL --max-time 8 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "https://www.instagram.com/p/CODE/" -o instagram.html
```
- Does `instagram.html` contain `og:description` with `likes`?
