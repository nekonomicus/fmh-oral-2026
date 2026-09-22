# fmh-oral-2026
Minimal daily review tracker for the FMH orthopaedics oral examination.

## Two-player sync

Sam and Michael each keep their own progress. Both see each other's ticks
(small `S` / `M` marks and a second progress line). Notes sync too; images stay
on the device they were added on.

Progress is always saved on the device first, so the app keeps working offline
and without any server setup. Sync switches on once the server has a store.

### One-time server setup (Render)

1. Create a free Redis database at [upstash.com](https://upstash.com) and copy
   its REST URL and REST token.
2. In the Render service, add three environment variables:

   | Name | Value |
   | --- | --- |
   | `UPSTASH_REDIS_REST_URL` | REST URL from Upstash |
   | `UPSTASH_REDIS_REST_TOKEN` | REST token from Upstash |
   | `SYNC_CODE` | any shared code both players will type |

3. Redeploy. On each device: **CONNECT**, pick your name, enter the code.

The first time a device connects, anything already ticked on it is merged into
the cloud copy. After that the newest save wins, and every device polls every
30 seconds and whenever the tab regains focus.

## Search

The search bar above the plan (and on the matrix) filters cases by title,
source, Miller chapter and note text. Press `/` to focus it, `Esc` to clear.
