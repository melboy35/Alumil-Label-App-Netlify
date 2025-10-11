Normalized exports created from 'Inventory Data (masterfile) 30-09-25.xlsx'.

- <sheet>_normalized.csv/json: direct per-sheet exports with cleaned headers.
- profiles_normalized.csv/json: combined profiles dataset (heuristic).
- accessories_normalized.csv/json: combined accessories dataset (heuristic).

Common normalized fields:
- code: item code / profile code / accessory code
- description: description / name
- length: length / len (profiles)
- color: color / colour (profiles)
- unit: uom / unit (accessories)

You can import CSVs to your database (e.g., Supabase) and upsert on (org_id, code).
