## Idempotent SQL Dump for Same-Schema Migration

Generate a single `import.sql` file containing `INSERT … ON CONFLICT (id) DO UPDATE` statements for every core CRM row, in foreign-key order, with all original UUIDs preserved (so properties ↔ owners ↔ deals ↔ activities ↔ stages relink automatically).

### What's included

In FK order:

1. `pipeline_stages`
2. `realtors`
3. `field_definitions`
4. `saved_lists`
5. `properties`
6. `owners`
7. `deals`
8. `activity_logs`
9. `deal_stage_history`

Skipped (per your choice): `companies`, `profiles`. You'll create the company in the new CRM by signing up, then paste its UUID at the top of the script.

### How company/user IDs are handled

The top of `import.sql` looks like:

```sql
-- 1. Paste the destination company UUID here:
\set new_company_id '00000000-0000-0000-0000-000000000000'

BEGIN;
-- inserts use :'new_company_id' for company_id and NULL for created_by
...
COMMIT;
```

- Every `company_id` is rewritten on import via the `psql` variable — no global replace needed in the file.
- Every `created_by` (auth user id) is set to `NULL`, since auth users differ between projects.
- Every other UUID (row IDs, `property_id`, `owner_id`, `stage_id`, `realtor_id`, `deal_id`) is kept verbatim so relationships survive.

### How it's built

A Python script that:

1. Reads each table via `psql ... COPY ... TO STDOUT` (or `SELECT to_jsonb(t)` for clean JSON), scoped to your company.
2. For each row, emits an `INSERT INTO public.<table> (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET <col> = EXCLUDED.<col>, ...` line, with proper escaping for text, JSONB, arrays, timestamps, booleans, and NULLs.
3. Substitutes `company_id` with `:'new_company_id'` and `created_by` with `NULL`.
4. Writes everything to one `import.sql` wrapped in a transaction.

### Deliverable

A zip at `/mnt/documents/addressfirst-sql-dump-YYYY-MM-DD.zip` containing:

- `import.sql` — the full upsert dump (single file, transaction-wrapped)
- `README.md` — step-by-step import instructions for the destination CRM:
  1. Sign up / log in to the new CRM, note your `companies.id`
  2. Edit `import.sql`, paste that UUID into `\set new_company_id`
  3. Run `psql "<destination connection string>" -f import.sql`
  4. Done — re-run anytime; conflicts upsert in place

### Notes

- Single-transaction so a partial failure rolls back cleanly.
- Idempotent: safe to re-run after fixing data and re-exporting.
- All Airbnb/Zillow enrichment travels inside `properties.market_data` and the flat columns; nothing is dropped.
- No code or schema changes to this project.
