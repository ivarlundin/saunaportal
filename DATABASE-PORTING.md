# Database & API porting inventory

Overview of every backend surface in this monorepo, for migrating off Supabase (or any single vendor) later.

**Shared project today:** `https://nicpgzkkyktzphkyzhfl.supabase.co`  
**Client pattern:** static HTML/JS + CDN `@supabase/supabase-js@2` + hardcoded publishable key (duplicated in many files).  
**No service-role keys** in the frontend. Edge Function **source is not in this repo** — only invoke contracts below.

Apps:

| App | Path | Complexity |
|-----|------|------------|
| Festival 2026 | `festival2026/` | High — auth, courses, forum, omröstning, storage |
| Aufguss | `aufguss/` | Medium — nights/slots/signups + RPCs |
| Poster tool | `my-sauna-portal/postertool/` | Low — one table + photo bucket |

---

## Porting strategy (recommended)

Treat each app as an independent bounded context with its own schema and API. Shared today only by Supabase project URL/key.

For a vendor swap, replace:

1. **HTTP API** — today’s PostgREST `.from()` / `.rpc()` and Edge `functions.invoke`
2. **SQL schema + RPCs** — tables, views, `SECURITY DEFINER` functions (SQL under each app’s `supabase/sql/`)
3. **Object storage** — two buckets (festival avatars, poster photos)
4. **Session model** — mostly *not* Supabase Auth (see per-app notes)

Do **not** assume Supabase Auth, Realtime subscriptions, or Edge Function source exist in-repo — most of that is either unused or hosted only on Supabase.

---

## 1. Festival 2026 (`festival2026/`)

### 1.1 Client & session

| Item | Detail |
|------|--------|
| SDK | CDN `@supabase/supabase-js@2` |
| Client init | `window.supabase.createClient(URL, KEY)` duplicated in many JS/HTML files |
| Session | `localStorage["sauna_festival_participant_id"]` = participant UUID |
| Supabase Auth | **Not used** in production paths |

Files that create a client (non-exhaustive): `app.js`, `forum.js`, `forum-members.js`, `signup.js` (uses global), `profile.js`, `course-quiz.js`, `course-nudge.js`, `diplomas.js`, `diploma-render.js`, `omrostning.js`, `admin.html`, `courses.html`, `user-settings.html`, `course-1-copy.html` (legacy).

### 1.2 Tables (live)

#### `festival2026_deltagare` (participants)

| Column | Usage |
|--------|--------|
| `id` | PK / session id |
| `name`, `alias`, `sauna_oil`, `favorite_temperature`, `motto` | Profile |
| `photo_path` | Storage object path |
| `created_at` | Forum badges / members |
| `is_forum_admin` | Admin gate (forum delete, omröstning admin, admin.html) |
| `course_started`, `course_completed` | Legacy progress flags |
| `quiz_score`, `quiz_passed`, `certificate_issued` | Legacy certification |

Passwords are **not** read/written via PostgREST — only via Edge Functions.

#### `festival2026_courses`

| Column | Usage |
|--------|--------|
| `id`, `slug`, `title`, `description`, `image_path`, `published` | Catalog |
| `course_key` | Quiz answer key (comma-separated letters; readable with anon key) |
| Optional route fields (if present) | `page_path`, `course_file`, `course_page`, `page_url`, `route` |

#### `festival2026_forum_posts`

| Column | Usage |
|--------|--------|
| `id`, `participant_id`, `body`, `created_at` | Posts |
| `is_child_post` | UUID self-FK: `NULL` = top-level; else parent post id (comments/votes) |
| `is_poll`, `poll_options`, `poll_option_index`, `poll_allow_comments` | Forum polls (votes are child rows) |

#### `festival2026_forum_reactions`

| Column | Usage |
|--------|--------|
| `id`, `post_id`, `participant_id`, `reaction` | Reactions |
| Allowed `reaction` | `thumbs_up`, `thumbs_down`, `eyes`, `cool` |

#### `festival2026_omrostning_polls`

| Column | Type / notes |
|--------|----------------|
| `id` | uuid PK |
| `title` | text |
| `options` | jsonb array of labels |
| `allow_text_response` | boolean |
| `status` | `draft` \| `live` \| `closed` |
| `created_by` | → deltagare |
| `created_at`, `updated_at`, `live_at`, `closed_at` | timestamps |

#### `festival2026_omrostning_responses`

| Column | Notes |
|--------|--------|
| `id`, `poll_id`, `participant_id` | FKs; unique `(poll_id, participant_id)` |
| `option_index`, `text_response` | At least one required |
| `created_at`, `updated_at` | |

#### Enrollments (not accessed via `.from()`)

Implied table **`festival2026_course_enrollments`** (mentioned in `NEXT-STEPS.md`). All access goes through Edge Function `festival2026-auth` actions `get_enrollments` / `save_enrollment`.

Fields clients send/accept (alias soup — port should normalize):

| Write (`save_enrollment` `fields`) | Read aliases accepted by UI |
|------------------------------------|-----------------------------|
| `course_started`, `started_at`, `progress_percentage` | `quiz_passed`, `completed`, `course_completed`, `completed_at`, `certificate_issued`, `is_completed`, `status === "completed"`, `passed_at`, `quiz_score`, `slug`, `course_id` |
| `course_completed`, `quiz_score`, `quiz_passed`, `certificate_issued`, `completed_at` | |

### 1.3 Legacy / unused tables

| Table | Notes |
|-------|--------|
| `festival2026_course_keys` | Dropped by `course-key-migration.sql` → `courses.course_key` |
| `quiz_results` | Only in dead `course-old.js` |

### 1.4 RPCs (Postgres functions called from JS)

| RPC | Args | Caller |
|-----|------|--------|
| `delete_forum_post_as_admin` | `target_post_id`, `acting_participant_id` | `forum.js` |
| `submit_omrostning_response` | `acting_participant_id`, `target_poll_id`, `selected_option_index`, `response_text` | `omrostning.js` |
| `list_omrostning_polls_admin` | `acting_participant_id` | `omrostning.js` |
| `save_omrostning_poll_admin` | `acting_participant_id`, `poll_id`, `poll_title`, `poll_options`, `allow_text_response`, `poll_status` | `omrostning.js` |
| `set_omrostning_poll_status_admin` | `acting_participant_id`, `poll_id`, `new_status` | `omrostning.js` |

SQL-only helpers (not `.rpc` from JS): `festival2026_is_forum_admin`, `festival2026_touch_omrostning_poll_updated_at`.

Omröstning / admin-delete RPCs are `SECURITY DEFINER`, granted to `anon` + `authenticated`. They trust client-supplied `acting_participant_id`.

### 1.5 Edge Functions (contracts only — source not in repo)

#### `festival2026-auth`

| Action | Request body | Response used by clients |
|--------|--------------|---------------------------|
| `login` | `{ action, username, password }` | `data.user_id` → localStorage |
| `signup` | `{ action, profile: { name, alias, sauna_oil, favorite_temperature, motto, password } }` | `data.participant` / `data` |
| `get_enrollments` | `{ action, participant_id }` | `data.enrollments[]` |
| `save_enrollment` | `{ action, participant_id, course_id, fields }` | `data.enrollment` |

#### `updateprofileinfo`

| Action | Request body |
|--------|--------------|
| `update_profile` | `{ action, participant_id, profile: { name, alias, sauna_oil, favorite_temperature, motto } }` |
| `change_password` | `{ action, participant_id, new_password }` |

### 1.6 Storage

| Bucket | Ops | Path pattern |
|--------|-----|--------------|
| `festival2026-deltagare` | upload (upsert), `getPublicUrl`, `createSignedUrl` (fallback) | `{participantId}/portrait.{ext}`, `{participantId}/profile.{ext}` |

No `storage.remove` in app code.

### 1.7 Realtime

**None** in JS. Forum “online” status is simulated (`forumPresence`).

### 1.8 SQL files in repo

Under `festival2026/supabase/sql/`:

| File | Purpose |
|------|---------|
| `omrostning.sql` | Polls + responses + admin/vote RPCs + RLS |
| `forum-polls.sql` | Poll columns + vote uniqueness |
| `forum-polls-comments.sql` | `poll_allow_comments` |
| `forum-polls-rls-rollback.sql` | Drops old poll RLS |
| `forum-reactions-types.sql` | Reaction CHECK |
| `forum-admin-delete.sql` | `is_forum_admin`, threading FK, `delete_forum_post_as_admin` |
| `course-key-migration.sql` | `course_key` on courses; drop old keys table |

**Missing from repo:** base `CREATE TABLE` for `deltagare`, `courses`, `forum_posts`, `forum_reactions`, enrollments, and Edge Function source.

### 1.9 Module → operations map

| File | Main DB/API work |
|------|------------------|
| `app.js` | Courses select; deltagare load/update certification; enrollments via Edge; forum teaser; storage photo URL |
| `signup.js` | Edge login/signup; storage portrait upload; deltagare `photo_path` update |
| `forum.js` | Posts CRUD-ish; poll posts/votes; reactions; admin delete RPC; members; storage avatars |
| `forum-members.js` | Deltagare + post counts; avatars |
| `profile.js` | Deltagare profile select; photo URL |
| `course-quiz.js` | Courses `course_key`; deltagare quiz flags; Edge `save_enrollment` |
| `course-nudge.js` | Deltagare `course_completed` |
| `diplomas.js` / `diploma-render.js` | Courses + Edge enrollments (+ deltagare name for render) |
| `omrostning.js` | Live polls/responses select; vote + admin RPCs |
| `admin.html` | Admin check; courses; participants; enrollments batch |
| `courses.html` | Courses + enrollments |
| `user-settings.html` | Photo upload; Edge profile/password |
| `course-old.js` | Dead — ignore |

### 1.10 Product / security assumptions to preserve or fix on port

1. Session = UUID in localStorage; many RPCs trust `acting_participant_id`.
2. Admin = `is_forum_admin` (SQL seeds alias `ivve`; forum pin alias also `ivve`).
3. Dual progress: flags on `deltagare` **and** per-course enrollments via Edge.
4. Quiz keys in `courses.course_key` are public to anyone with the anon key — move server-side on port if possible.
5. Pass thresholds: `course-quiz.js` 60%; `app.js` `CERTIFICATION_PASS_PERCENTAGE = 70`.
6. Primary course slug in app: `saunaportal-intro`.
7. Forum threading via `is_child_post` UUID (not a separate comments table).
8. Forum polls ≠ omröstning tables (two poll systems).

Planned-but-not-built ideas: `NEXT-STEPS.md` (Supabase Auth, course steps tables, server-side quiz validation, real presence, stricter RLS).

---

## 2. Aufguss (`aufguss/`)

Desktop-only night schedule: admin builds slots; participants signup/cancel.

### 2.1 Client & “auth”

| Item | Detail |
|------|--------|
| Config | `config.js` → `window.AUFGUSS_CONFIG` + `aufgussCreateClient()` |
| Admin gate | Client password `ADMIN_PASSWORD` (`"tallbarr"`) in `sessionStorage` — **not** DB auth |
| Participant identity | Cookie `aufguss_participant` from `?id=&name=` — stored on signup rows |
| Supabase Auth / Storage | Unused |
| Live refresh | Polling every `POLL_MS` (60s), not Realtime (even though SQL adds tables to realtime publication) |

### 2.2 Tables

| Table | Role |
|-------|------|
| `aufguss_places` | Venues: `id`, `name` (unique), `capacity`, `sort_order`, `created_at` |
| `aufguss_nights` | One active night (app loads latest): `title`, `night_date`, `status` (`setup`\|`signup_open`\|`closed`), `signup_closes_at`, `signup_control` (`scheduled`\|`force_open`\|`force_closed`\|`setup`), `max_signups_per_participant`, timestamps |
| `aufguss_slots` | Schedule rows: `night_id`, `place_id` (nullable for info), `name`, `starts_at`, `duration_minutes`, `bastuolja`, `aufgussmeister`, `intensity` (1–5), `slot_kind` (`signup`\|`info`) |
| `aufguss_signups` | `slot_id`, `participant_id` (text), `participant_name`, unique `(slot_id, participant_id)` |
| `aufguss_schedule_offsets` | Admin schedule shifts: `night_id`, `after_slot_id` (null = before first), `minutes` |

### 2.3 View

`aufguss_slots_enriched` — slot fields + `place_name`, `place_capacity`, `place_sort_order`, `signup_count`, `places_left`.

### 2.4 RPCs used by JS

| RPC | Args | Used by |
|-----|------|---------|
| `aufguss_signup` | `p_slot_id`, `p_participant_id`, `p_participant_name` → jsonb | `live.js` |
| `aufguss_cancel_signup` | `p_slot_id`, `p_participant_id` → boolean | `live.js` |
| `aufguss_offset_after_slot` | `p_night_id`, `p_after_slot_id`, `p_minutes` → integer | `admin.js` |

Signup business rules (must reimplement): lock slot → reject info/`not_bookable` → night open check → per-night signup cap → capacity → upsert. Error codes: `participant_required`, `slot_not_found`, `not_bookable`, `signup_closed`, `signup_limit`, `slot_full`.

SQL helpers not called from JS: `aufguss_night_signup_open`, `aufguss_slot_capacity`, legacy `aufguss_offset_night`.

### 2.5 Direct table ops

**Admin (`admin.js`):** CRUD places/slots; create/update night settings; insert/delete schedule offsets; read enriched slots + signups.

**Live (`live.js`):** read night + enriched slots + own signup slot ids; signup/cancel via RPC only.

### 2.6 SQL files

Under `aufguss/supabase/sql/` — start from `aufguss.sql`, then apply migrations (`signup-control`, `slot-kind-info`, `max-signups`, offsets, `fix-night-id-ambiguous`, etc.). Canonical signup RPC is the latest migration that renames local `night_id` → `v_night_id`.

### 2.7 RLS note

Policies are effectively open (`using (true)`). Security today is frontend password + obscurity. A real port should add a proper admin API.

---

## 3. Poster tool (`my-sauna-portal/postertool/`)

### 3.1 Client

`app.js` creates shared `supabaseClient`. Loaded scripts: `photo-comp.js`, `photo-form.js`, `poster-state.js`, `poster-preview.js`, `poster-cms.js`, `app.js`.  
**Not loaded:** `authenticate.js`, `poster-render.js`.

### 3.2 Table

**`participants`**

| Column | Ops |
|--------|-----|
| `id` | UUID PK (read) |
| `name` | insert + display |
| `photo_path` | insert + public URL |
| `created_at` | order on select |

Only `SELECT *` (ordered) and `INSERT`. No update/delete/RPC/realtime.

Local-only UI state (`visible`, drag order) is **not** persisted.

### 3.3 Storage

| Bucket | Ops |
|--------|-----|
| `poster_photos` | upload JPEG (`upsert: false`), `getPublicUrl` |

Filename: `` `${Date.now()}-${random}.jpg` ``.

### 3.4 Dead Edge Function

`check-event-password` — only referenced from unloaded `authenticate.js` (`POST` `{ password }` → `{ success: true }`). Safe to drop unless re-enabling event password gate.

### 3.5 Schema in repo

No SQL under `my-sauna-portal/`. Documented in `postertool/PROJECT_CONTEXT.md` (RLS expected: INSERT/SELECT on table + storage).

---

## 4. Consolidated checklist for a new backend

### Must reimplement (API surface)

**Festival**

- [ ] Participant signup/login/password change (today: Edge)
- [ ] Profile update (today: Edge)
- [ ] Participant CRUD fields used by UI
- [ ] Course catalog + answer keys (consider moving keys server-side)
- [ ] Enrollment get/save
- [ ] Forum posts (incl. poll rows), reactions, admin delete
- [ ] Omröstning polls/responses + 4 admin/vote RPCs
- [ ] Avatar upload + public/signed URL

**Aufguss**

- [ ] Places, nights, slots, signups, schedule offsets
- [ ] Enriched slots view (or equivalent query)
- [ ] Signup / cancel / offset RPCs with same error codes
- [ ] Admin password story (replace client-side password)

**Poster**

- [ ] `participants` list + insert
- [ ] Photo upload + public URL

### Can ignore initially

- Supabase Auth APIs
- Realtime channels
- Dead `course-old.js` / `quiz_results`
- Dead poster `authenticate.js` / `check-event-password` (unless needed)
- `NEXT-STEPS.md` future tables (unless you want to build them during the port)

### Schema sources of truth in git

| Area | Best source |
|------|-------------|
| Festival omröstning + forum patches | `festival2026/supabase/sql/*.sql` |
| Festival core tables | **Live DB only** — reconstruct from this doc + JS column usage |
| Festival Edge Functions | **Hosted only** — reconstruct from §1.5 contracts |
| Aufguss | `aufguss/supabase/sql/aufguss.sql` + migrations |
| Poster | `my-sauna-portal/postertool/PROJECT_CONTEXT.md` |

### Suggested new architecture shape

```
API layer (one service or three small ones)
  ├─ festival: auth, profile, courses, enrollments, forum, omrostning, media
  ├─ aufguss: nights, slots, signup rules, admin
  └─ poster: participants + photos

DB: any Postgres (or equivalent) with the tables/RPCs above
Object storage: S3-compatible or similar for two buckets
Session: keep UUID cookie/localStorage initially, or upgrade to real auth on port
```

Centralize config (one URL/key or env per app) instead of copying publishable credentials into every file.

---

## 5. File index (DB touchpoints)

### Festival

`app.js`, `signup.js`, `forum.js`, `forum-members.js`, `profile.js`, `course-quiz.js`, `course-nudge.js`, `diplomas.js`, `diploma-render.js`, `omrostning.js`, `admin.html`, `courses.html`, `user-settings.html`, `course-1-copy.html` (legacy), `supabase/sql/*`

### Aufguss

`config.js`, `admin.js`, `live.js`, `admin.html`, `live.html`, `supabase/sql/*`

### Poster

`postertool/app.js`, `postertool/photo-form.js`, (`authenticate.js` dead), `PROJECT_CONTEXT.md`

---

*Generated as a porting aid. When the live Supabase project is still available, export full schema (`pg_dump --schema-only`) and Edge Function source before teardown — that fills gaps this repo cannot.*
