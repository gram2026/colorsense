# Online ranking setup

The Worker serves `/api/rankings`. It requires a Cloudflare D1 database bound as `RANKING_DB`.

1. Run `npx wrangler login` and complete browser sign-in.
2. Run `npx wrangler d1 create colorguesser-rankings`.
3. Add the returned database ID to `wrangler.jsonc`:

```json
"d1_databases": [{
  "binding": "RANKING_DB",
  "database_name": "colorguesser-rankings",
  "database_id": "THE_ID_RETURNED_BY_CLOUDFLARE",
  "migrations_dir": "worker/migrations"
}]
```

4. Run `npx wrangler d1 migrations apply colorguesser-rankings --remote`.
5. Run `npm run deploy`.

For local end-to-end testing, apply migrations with `--local`, then run `npm run preview:cloudflare`. The ordinary `npm run dev` server only serves static files and does not run the ranking API.

Rankings are shared per category and Korean calendar day. Old records remain stored but are excluded from today's board. Browser-local scores are not imported. Exactly five distinct valid question answers are required. The server filters nicknames, recomputes scores, checks the daily question set, rejects duplicate run IDs and limits submissions per client. Nicknames are not authenticated identities. Answers are still publicly accessible in the static game data, so this does not prevent determined cheating; competitive rewards require server-issued quiz sessions and private answer storage.
