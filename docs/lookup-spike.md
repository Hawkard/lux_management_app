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
