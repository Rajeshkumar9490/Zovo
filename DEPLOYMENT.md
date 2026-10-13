# Deploying the reliability and privacy fixes

1. In Supabase's SQL editor, apply `supabase/schema.sql` if the project has not been initialized, then apply `supabase/usage-limits.sql`.
2. Set Vercel environment variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `JWT_SECRET`. Use a newly generated random JWT secret of at least 32 characters. Do not use the example value. The server requires the service role key; an anonymous key cannot use the protected usage-counter function.
3. Deploy the branch and check sign-in, Try Zovo, streaming chat, file upload, editing, and regeneration. Verify the selected Gemini model IDs are available to your API account.

The landing page renders without an API session. Starting a guest session has a 15-second request timeout and a recoverable error. Check Vercel function logs if guest creation fails; verify the database tables and service role key. Production does not fall back to an ephemeral JSON file.

Guests have separate random accounts. Legacy shared guest tokens are rejected. Changing JWT_SECRET invalidates previous sessions. Guest accounts and uploaded files currently remain stored until explicitly cleaned up; do not promise automatic expiry. Schedule cleanup of expired guest accounts and expired usage counters as a separate operational task.

Limits use atomic Supabase counters across function instances. Limits are 30 chat requests per minute, five guest questions per day, five guest uploads per day, and 10 guest-session creations per IP per hour. Auth requests are limited to 20 per 15 minutes. Local development uses in-memory counters. New guest sessions can reset account limits, so the IP creation limit is also required. Add an edge firewall limit for coordinated abuse. Uploads through the regular upload endpoints are counted; inline attachment payloads supplied directly to the chat API are still subject to chat request limits.

Edits and regeneration create a new conversation containing the messages before the selected user message. The old conversation is preserved. The client reloads the branch to obtain persisted message IDs.

Run `npm install`, `npm run lint`, `npm test`, and `npm run build` for local verification. Tests use a temporary database and stub the AI response; they do not contact Gemini or Supabase. The production Supabase migration must still be validated in your project.


## Quality pipeline update

Balanced defaults to the documented stable Gemini 3.8 Flash route with adaptive reasoning. Fast uses low reasoning; Reasoning uses Pro and fails explicitly when quota or availability prevents using Pro. It never silently downgrades to Lite. Existing Gemini 3.7 conversation selections resolve to Balanced. See https://ai.google.dev/gemini-api/docs/generate-content/thinking for supported controls.

Attachments must include the uploaded attachment ID. The backend checks ownership and reads the stored file. Legacy messages without attachment IDs require reupload. Direct chat JSON no longer contains base64 file data. Uploads are limited to 3 MB per message to fit the hosting request limit. PDF chat uses native multimodal input, DOCX/TXT/MD/CSV/JSON are parsed as text, and the knowledge library uses PDF page text or DOCX text extraction. Scanned PDFs without text should be sent in chat or as page images; the knowledge library reports that it cannot extract text.

No additional database migration is required for this update. Source/model metadata is stored in the existing sources JSON field with backwards-compatible reads. The initial schema defaults now use Gemini 3.8 Flash. Title generation is local and deterministic. All provider attempts are bounded; disconnecting stops client/server reading, though provider cancellation does not guarantee that already submitted inference stops billing.

The mammoth library's unused CLI argparse dependency is overridden to version 2 to remove the vulnerable sprintf-js dependency. Only its library API is used and tested; this application does not use the mammoth CLI.

Use `npm run eval:generate` to regenerate the 104-case synthetic suite. Set `ZOVO_EVAL_URL`, `ZOVO_EVAL_TOKEN` for an isolated evaluation account, and `ZOVO_EVAL_OUTPUT` for a local results file, then run `npm run eval`. It stops after three consecutive delivery failures. Cases span eight categories but use template variants; passing this set is not proof of Astra parity or comprehensive security. Keep credentials out of results and commits. Compare the same cases against Astra only after obtaining authorized model access.

## Optional hosted free-tier models

Add `GROQ_API_KEY` and `OPENROUTER_API_KEY` as Sensitive Production variables in Vercel, then redeploy. Provider keys stay server-side. `/api/models` exposes only configuration booleans, never keys. The chat menu disables hosted modes until configured.

Groq mode uses `openai/gpt-oss-20b`. Keep the Groq organization on its **Free plan**: the application cannot inspect or enforce the organization's billing tier, and the same API can charge on a paid plan. OpenRouter mode pins `openrouter/free`, with no paid model fallbacks or paid web plugins. Free limits and model availability can change. These modes are explicitly selected, and existing custom assistants can use them; there is no automatic transfer from Gemini to another provider.

The initial hosted integration supports text, TXT, DOCX and readable PDFs. It rejects image inputs and web search rather than silently dropping those capabilities. It preserves saved assistant instructions, knowledge evidence, page citations, cancellation and actual-model metadata. These are hosted model choices, not autonomous tool-executing agents. Free models have no demonstrated benchmark parity with Astra.

Primary provider documentation: https://console.groq.com/docs/openai, https://console.groq.com/docs/models, https://console.groq.com/docs/rate-limits, https://openrouter.ai/openrouter/free.
