# NetPrep - NET Daily 10

A no-login UGC NET practice application built with Next.js, Supabase, and Gemini.

## Local development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

Before deployment:

```powershell
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local`.

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-secret>
GEMINI_API_KEY=<gemini-api-key>
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Never commit real secrets. The anon key is browser-safe; service-role, Gemini, and database credentials are server-only.

## Supabase setup

1. Create or open a Supabase project.
2. Apply `supabase/migrations/202611240001_netprep_public.sql`.
3. Confirm public read policies exist for `questions`, `daily_quizzes`, and `publication_history`.

## Deploy to Vercel

### GitHub deployment

1. Create a GitHub repository and push this project.
2. Import it at `https://vercel.com/new`.
3. Keep the framework preset as **Next.js**.
4. Add these project environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
5. Deploy.
6. Future changes: commit and push to `main`; Vercel deploys automatically.

### Vercel CLI

```powershell
npm install -g vercel
vercel login
vercel
vercel --prod
```

Add production secrets through the Vercel project settings or CLI:

```powershell
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add GEMINI_API_KEY production
```

## Modify the app

- Daily page: `app/page.tsx`
- Archive: `app/archive/page.tsx`
- PYQ/PDF bank: `app/pyqs/page.tsx`
- Analytics: `app/analytics/page.tsx`
- Bookmarks: `app/bookmarks/page.tsx`
- Navigation: `components/NavBar.tsx`
- Unit definitions: `lib/syllabus.ts`
- Gemini prompts/models: `lib/gemini.ts`
- Daily quiz engine: `app/api/today/route.ts`
- Question filters: `app/api/questions/route.ts`
- Database changes: add a file under `supabase/migrations/`

Run `npm run build` before every push.

## PYQ seeding

```powershell
python scripts/seed_pyqs.py --dir pyq_pdfs --extract-only
python scripts/seed_pyqs.py --upload-only
```
