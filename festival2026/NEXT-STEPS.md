# SaunaPortal Festival 2026 - Next Steps

## 1. Authentication

- Add Supabase Auth for user registration and login.
- Support email/password login first.
- Add password reset and email verification.
- Replace the current `localStorage` participant session with the Supabase Auth user session.
- Never store passwords in the database or frontend code.
- Add logout through `supabase.auth.signOut()`.
- Decide whether festival aliases must be unique.

## 2. User Profiles

- Connect `auth.users.id` to `festival2026_deltagare`.
- Add a profile setup flow after first login.
- Keep avatar, name, alias, sauna oil, favorite temperature, and motto in the participant profile.
- Add profile editing.
- Add a real online presence system using `last_seen` or Supabase Realtime.

## 3. Courses From Supabase

Create database tables so courses are no longer hardcoded in HTML:

- `festival2026_courses`
  - `id`
  - `title`
  - `slug`
  - `description`
  - `image_path`
  - `published`
  - `created_at`

- `festival2026_course_steps`
  - `id`
  - `course_id`
  - `title`
  - `body`
  - `image_path`
  - `step_order`
  - `created_at`

- `festival2026_course_enrollments`
  - `id`
  - `course_id`
  - `participant_id`
  - `started_at`
  - `completed_at`
  - `progress_percentage`

- `festival2026_course_progress`
  - `id`
  - `course_id`
  - `step_id`
  - `participant_id`
  - `completed_at`

## 4. Quizzes and Certification

- Store quiz questions in Supabase instead of `course-1.html`.
- Keep correct answers server-side so users cannot inspect them in browser tools.
- Validate quiz submissions through a Supabase Edge Function.
- Store quiz attempts separately:
  - `course_id`
  - `participant_id`
  - `answers`
  - `score`
  - `percentage`
  - `passed`
  - `created_at`
- Keep the certification pass threshold configurable per course.
- Issue certificates only after server-side validation.
- Add a certificate ID and issued timestamp.

## 5. Course Administration

- Create an admin role for course managers.
- Add an admin interface for:
  - Creating courses
  - Editing steps
  - Uploading images
  - Creating quizzes
  - Setting pass percentages
  - Publishing and unpublishing courses
- Add draft and published states.
- Add ordering controls for courses and steps.

## 6. Forum Improvements

- Replace the current simulated online status with real presence.
- Add edit and delete permissions for post authors.
- Add moderation tools for admins.
- Add report functionality.
- Add pagination or realtime updates for new posts.
- Add richer reactions if needed.
- Validate forum ownership through Supabase Auth and RLS.

## 7. Security and RLS

- Enable RLS on every user-owned table.
- Replace anonymous participant policies with Auth-based policies.
- Users should only edit their own profile and progress.
- Users should only delete their own posts and reactions.
- Admins should have separate management policies.
- Move answer keys and certification logic out of public JavaScript.
- Never expose Supabase service-role keys in frontend files.

## 8. Storage

- Store course and profile images in Supabase Storage.
- Create separate storage folders or buckets for:
  - Participant avatars
  - Course images
  - Course step images
  - Certificates
- Use public URLs only for genuinely public assets.
- Use signed URLs for private files.

## 9. Dashboard

- Load course cards dynamically from Supabase.
- Show enrolled courses, current progress, quiz score, and certification status.
- Add a "Continue course" action.
- Add recent forum activity.
- Add certificates and downloadable completion records.

## 10. Suggested Implementation Order

1. Set up Supabase Auth email/password login.
2. Link authenticated users to `festival2026_deltagare`.
3. Add RLS policies based on `auth.uid()`.
4. Create the course and course-step tables.
5. Move the current course content into Supabase.
6. Add server-side quiz validation with an Edge Function.
7. Connect the dashboard to dynamic courses and progress.
8. Replace simulated presence with Supabase Realtime.
9. Add the course administration interface.
10. Add certificates and admin moderation.
