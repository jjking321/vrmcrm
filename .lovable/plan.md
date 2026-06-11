## One-Time Core CRM Export

Generate a downloadable zip containing one CSV per core table, scoped to your company. Raw normalized structure — IDs preserved so foreign-key relationships rebuild cleanly in your new CRM.

### Tables included (core CRM only)

- `properties` — addresses, enrichment, market data, custom fields, tags
- `owners` — names, phones, emails (full JSON arrays), mailing address, ownership metadata
- `pipeline_stages`
- `deals` + `deal_stage_history`
- `activity_logs`
- `realtors`
- `field_definitions` — custom field schema
- `saved_lists` — filter definitions
- `companies` + `profiles` (your company row + team members, for reference)

Skipped (per your choice): email/inbox tables, call lists, mailing lists, exclusions, opt-outs, bad-data tracking, gmail accounts, api keys.

### How it works

1. Run a `psql ... COPY (SELECT ... WHERE company_id = '<your-company>') TO STDOUT WITH CSV HEADER` for each table.
2. Write each result to `/mnt/documents/export/<table>.csv`.
3. Zip the folder to `/mnt/documents/addressfirst-export-YYYY-MM-DD.zip`.
4. Surface the zip via a `<presentation-artifact>` tag for one-click download.

### Notes

- JSON columns (phones, emails, owners array, market_data, custom_fields, monthly_metrics, etc.) are exported as raw JSON strings inside their CSV cell — your new CRM can parse them on import.
- All `id` and `*_id` columns are preserved so you can rebuild relationships (properties ↔ owners ↔ deals ↔ activities ↔ stages).
- This is a one-time export. No code changes, no UI changes, no schema changes.

### What I'll deliver

A single zip file you can download immediately, containing ~11 CSVs plus a short `README.txt` listing each file, its row count, and the foreign-key relationships.
