# fmh-oral-2026
Minimal daily review tracker for the FMH orthopaedics oral examination.

## Two-player sync

Sam and Michael each keep their own progress. Both see each other's ticks
(small `S` / `M` marks and a second progress line). Notes sync too; images stay
on the device they were added on.

Progress is always saved on the device first, so the app keeps working offline
and without any server setup. Sync switches on once the server has a store.

### One-time server setup (Render)

Progress is stored in a private Gist on your own GitHub account. Nothing else
to sign up for.

1. On GitHub go to Settings → Developer settings → Personal access tokens →
   Tokens (classic) → Generate new token. Tick only **gist**. Copy the token.
2. In the Render service, add two environment variables:

   | Name | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | the token from step 1 |
   | `SYNC_CODE` | any shared code both players will type |

3. Redeploy. On each device: **CONNECT**, pick your name, enter the code.

The Gist (`fmh-oral-26 sync`) is created automatically on first use, with one
file per player. You can open it on gist.github.com any time to see or back up
the raw data.

The first time a device connects, anything already ticked on it is merged into
the cloud copy. After that the newest save wins, and every device polls every
30 seconds and whenever the tab regains focus.

## Shared attachments

When connected, the note drawer's **ADD FILE** uploads images (JPEG, PNG,
WebP, GIF, HEIC), PDFs and PPTX files (40 MB each) so both players see them.
Each file shows who added it; you can remove your own. The note icon on a
case gets a small split bar: left half Michael, right half Sam, full when
both attached something. Images saved on a device before this existed stay
local until you press **SHARE** on them.

Files are stored as release assets in a private GitHub repo:

1. Create a private repo (e.g. `fmh-oral-files`) with a README.
2. Use a `GITHUB_TOKEN` that also has the `repo` scope, or a fine-grained
   token with Contents read/write on that repo.
3. Set `ATTACHMENTS_REPO=owner/name` on the server.

## Search

The search bar above the plan (and on the matrix) filters cases by title,
source, Miller chapter and note text. Press `/` to focus it, `Esc` to clear.

When connected, a Gemini pass runs a moment after you stop typing and adds
cases that match by meaning (synonyms, classifications, patient stories,
German or English). Set `GEMINI_API_KEY` on the server; `GEMINI_MODEL`
optionally overrides the default `gemini-3.5-flash-lite`.
