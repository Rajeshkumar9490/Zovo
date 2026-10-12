# Deploying the reliability and privacy fixes

1. In Supabase's SQL editor, apply `supabase/schema.sql` if the project has not been initialized, then apply `supabase/usage-limits.sql`.
2. Set Vercel environment variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `JWT_SECRET`. Use a newly generated random JWT secret of at least 32 characters. Do not use the example value. The server requires the service role key; an anonymous key cannot use the protected usage-counter function.
3. Deploy the branch and check sign-in, Try Zovo, streaming chat, file upload, editing, and regeneration. Verify the selected Gemini model IDs are available to your API account.

The landing page renders without an API session. Starting a guest session has a 15-second request timeout and a recoverable error. Check Vercel function logs if guest creation fails; verify the database tables and service role key. Production does not fall back to an ephemeral JSON file.

Guests have separate random accounts. Legacy shared guest tokens are rejected. Changing JWT_SECRET invalidates previous sessions. Guest accounts and uploaded files currently remain stored until explicitly cleaned up; do not promise automatic expiry. Schedule cleanup of expired guest accounts and expired usage counters as a separate operational task.

Limits use atomic Supabase counters across function instances. Limits are 30 chat requests per minute, five guest questions per day, five guest uploads per day, and 10 guest-session creations per IP per hour. Auth requests are limited to 20 per 15 minutes. Local development uses in-memory counters. New guest sessions can reset account limits, so the IP creation limit is also required. Add an edge firewall limit for coordinated abuse. Uploads through the regular upload endpoints are counted; inline attachment payloads supplied directly to the chat API are still subject to chat request limits.

Edits and regeneration create a new conversation containing the messages before the selected user message. The old conversation is preserved. The client reloads the branch to obtain persisted message IDs.

Run `npm install`, `npm run lint`, `npm test`, and `npm run build` for local verification. Tests use a temporary database and stub the AI response; they do not contact Gemini or Supabase. The production Supabase migration must still be validated in your project.
