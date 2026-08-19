# Supabase deployment

Steps to apply migrations and deploy server functions for this project.

1. Configure environment
- Set these env vars locally or in CI:
  - `SUPABASE_URL` - your Supabase project URL (e.g. https://xyz.supabase.co)
  - `SUPABASE_SERVICE_ROLE_KEY` - service role key (keep secret)
  - `RESEND_API_KEY` - (optional) API key for Resend email service

2. Apply SQL migrations
- You can paste the SQL in `supabase/migrations/*.sql` into the Supabase SQL editor, or use the Supabase CLI:

```bash
# install supabase CLI
npm install -g supabase
# login and link project, then run migrations
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

3. Deploy Edge Functions
- The server functions are in `supabase/functions/server/index.tsx` and use Hono.
- Build and deploy using the Supabase CLI:

```bash
cd supabase/functions/server
supabase functions deploy server --project-ref <your-project-ref>
```

- The deployed function base URL is usually `https://<project>.functions.supabase.co/server`.
- Set `VITE_SERVER_FUNCTION_URL` in your frontend env to this base URL.

4. Create initial admin
- Option A: Use the server endpoint after deployment:
  - POST to `${VITE_SERVER_FUNCTION_URL}/setup/create-admin` with JSON { name, email, password }
- Option B: Use the local bootstrap script (requires `SUPABASE_SERVICE_ROLE_KEY`):

```bash
SUPABASE_URL=https://<proj>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create_admin.mjs
```

5. Test locally
- Set frontend env in `.env`:
```
VITE_SUPABASE_URL=https://<proj>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SERVER_FUNCTION_URL=https://<proj>.functions.supabase.co/server
```
- Restart dev server: `pnpm dev` or `npm run dev`

Notes
- Review `supabase/migrations/rls_full.sql` and `rls_policies_example.sql` before applying; adjust column names to match your schema.
- If Supabase is not configured, the app will fall back to localStorage and remote calls will be disabled (no network errors).