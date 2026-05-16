# Username + Password Login (no emails)

## What changes for the user

**New users** see a clean form: **Username**, **Password**, **Confirm Password**. No email field. No "check your inbox." Account is created instantly and they're signed straight in.

**Forgot password** no longer sends an email. Instead, at sign-up time we show each new user a one-time **Recovery Code** (16 characters, like `XK7P-9QM2-WR4N-8VTH`). We tell them: *"Save this somewhere safe. It's the only way to reset your password — we have no email to send a reset link to."* If they later forget their password, they type their username + recovery code on a new "Forgot Password" screen, then set a new password.

**Existing users who signed up with a real email**: nothing changes. They keep signing in with their email + password exactly as before. Google sign-in also continues to work for users who already use it.

## How it works under the hood (for the technical record)

Supabase Auth requires an email address per account. For username-only signups we synthesize one — `username@odyssey.local` — and store it as the user's auth email. The user never sees or types this; they only see their username. Existing accounts with real emails are untouched, so their logins keep working.

Usernames are validated (3–24 characters, letters/numbers/underscore/hyphen, case-insensitive, must be unique). Reserved words like `admin`, `support`, `system` are blocked. On submit we lowercase the username, append `@odyssey.local`, and hand that to Supabase as the email.

The recovery code is generated client-side at signup (cryptographically random), shown once on screen with a Copy button, and a hash of it (bcrypt-style via pgcrypto) is stored in a new `account_recovery` table keyed by user id. The plain code never touches the database. Password recovery: user submits username + code, an edge function looks up the user, verifies the hash, and (using the service role) updates the password. The code is consumed on use; user is offered a fresh one after successful recovery.

## Files / pieces to build

1. **Database migration** — `account_recovery` table (user_id, code_hash, created_at, used_at) with RLS so only the owner can read their own row; service role writes during recovery. Enable the `pgcrypto` extension if not already on for bcrypt verification.
2. **New edge function** `recover-password` — accepts `{ username, recoveryCode, newPassword }`, verifies hash with service role, updates the auth password, marks code used. Validates input with zod, includes CORS.
3. **New edge function** `check-username` — accepts `{ username }`, returns whether `username@odyssey.local` already exists. Used to give instant "username taken" feedback at signup.
4. **`src/pages/Auth.tsx`** — replace email field with username field on signup + login. Drop the email-confirmation success message. Drop the link to the old forgot-password (email reset) flow and replace with the new code-based flow. Keep Google sign-in button. Keep existing email login working (we'll accept either a username OR an email containing `@` in the username field on the login screen — if it contains `@`, send as-is; otherwise append `@odyssey.local`).
5. **New "Recovery Code shown" screen** — surfaces immediately after successful signup with the code in a large monospace block, Copy button, and a checkbox "I've saved my recovery code" the user must tick before continuing to the app.
6. **New `src/pages/RecoverAccount.tsx`** — username + recovery code + new password form, calls the `recover-password` edge function.
7. **`src/pages/ResetPassword.tsx`** — keep for legacy email users who still receive reset links. No changes needed.
8. **Supabase auth setting** — turn on **auto-confirm email signups** so synthesized `@odyssey.local` accounts don't sit in "pending verification" state. (This also means real-email signups are no longer email-verified — acceptable per request.)
9. **`src/components/settings/AccountSettings.tsx`** — add a "Recovery Code" section: shows last-generated date, offers "Generate New Code" (invalidates old one). Keeps existing email/password change controls for users who do have a real email.
10. **Memory update** — record that auto-confirm is now ON intentionally, overriding the prior `mem://auth/email-configuration` rule.

## Edge cases handled

- Username already taken → inline error before submit.
- Existing real-email user trying to log in: still works (we don't append `@odyssey.local` if the input already has `@`).
- User who loses both password and recovery code → permanently locked out (matches the no-email model; we surface this clearly at signup).
- Google sign-in users have no username; they continue using Google. We don't force them to pick a username.

## What does NOT change

- Google sign-in
- Existing email-based accounts (login, password reset via email, profile data)
- Roles, RLS, character data, cloud saves
- The `/reset-password` page (legacy email flow still works)
