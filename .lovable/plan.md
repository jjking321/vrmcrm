## Flatten enriched JSON into CSV columns

Re-export `properties.csv` (and `owners.csv`) with all JSON columns exploded into one CSV column per field, then re-zip. All other CSVs in the existing export stay as-is.

### properties.csv — new columns

Existing columns stay. Add, from `market_data` JSON:

- `md_adr`, `md_occupancy_rate`, `md_projected_revenue`
- `md_airbnb_rating`, `md_review_count`
- `md_market_avg_adr`, `md_market_avg_occupancy`, `md_market_avg_revenue`, `md_comparable_count`, `md_data_source`
- `md_property_value`
- `md_ttm_revenue`, `md_ttm_avg_occupancy`, `md_ttm_avg_adr`
- `md_monthly_revenue_distribution` (kept as JSON string — 12 numbers)
- `md_monthly_metrics` (kept as JSON string — variable-length time series)

From `custom_fields` JSON: one `cf_<field_key>` column per custom field defined in `field_definitions` (skips system fields already on the row). Discovered dynamically from the table so it includes everything you've added.

The original `market_data` and `custom_fields` JSON columns are dropped from this CSV to avoid duplication (still present in the raw zip if needed — we can keep them too if you prefer).

### owners.csv — new columns

Explode `phones`, `emails`, and `owners` JSON arrays into numbered columns (matches the export-properties pattern already in the app):

- `owner_1_first_name`, `owner_1_last_name` … up to `owner_4_*`
- `phone_1`, `phone_1_type`, `phone_1_dnc`, `phone_1_status`, `phone_1_source` … up to `phone_6`
- `email_1`, `email_1_type`, `email_1_opted_out`, `email_1_status`, `email_1_source` … up to `email_4`

Original `phones` / `emails` / `owners` JSON columns dropped.

### Deliverable

New zip: `/mnt/documents/addressfirst-export-flat-YYYY-MM-DD.zip` containing the same 11 CSVs (flattened properties + owners, others unchanged) and an updated `README.txt` documenting the new columns.

### How it's built

A single Python script using `psql ... COPY ... TO STDOUT WITH CSV HEADER` to load rows, then pandas to flatten JSON columns into the new schema and write back to CSV. No app code changes, no schema changes.
