# Supabase migrations for schoolgame

This repository is the authoritative GitHub Pages source (`nopyyoyo/schoolgame`).
Its Supabase project is `pbomxjysvrfycanjfizx` (same backend used by earlier
prototype work). Numbered migrations up to `migration-011` were created and
applied from a previous local project copy before this repo's `supabase/`
folder existed; migration tracking continues here from `migration-012` onward.

## Applying a migration

```powershell
cd "supabase"
supabase db push
```

or run the SQL file directly in the Supabase SQL editor.

## Deploying an Edge Function

```powershell
cd "supabase"
supabase functions deploy <function-name>
```
