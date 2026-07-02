-- AlterTable
ALTER TABLE "LineItem"
ADD COLUMN     "extraFields" JSONB;

-- AlterTable
ALTER TABLE "Profitabilty_line_items"
ADD COLUMN     "extraFields" JSONB;

-- Backfill legacy JSON payloads previously stored in notes.
CREATE OR REPLACE FUNCTION try_parse_jsonb(input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
	RETURN input::jsonb;
EXCEPTION WHEN others THEN
	RETURN NULL;
END;
$$;

WITH parsed_line_items AS (
	SELECT
		"id",
		try_parse_jsonb("notes") AS parsed_notes
	FROM "LineItem"
	WHERE "notes" IS NOT NULL
)
UPDATE "LineItem" AS li
SET
	"extraFields" = CASE
		WHEN parsed_line_items.parsed_notes IS NOT NULL
			AND jsonb_typeof(parsed_line_items.parsed_notes) = 'object'
			AND (parsed_line_items.parsed_notes - 'Notes') <> '{}'::jsonb
			THEN parsed_line_items.parsed_notes - 'Notes'
		ELSE li."extraFields"
	END,
	"notes" = CASE
		WHEN parsed_line_items.parsed_notes IS NOT NULL
			AND jsonb_typeof(parsed_line_items.parsed_notes) = 'object'
			AND parsed_line_items.parsed_notes ? 'Notes'
			THEN NULLIF(parsed_line_items.parsed_notes ->> 'Notes', '')
		ELSE li."notes"
	END
FROM parsed_line_items
WHERE li."id" = parsed_line_items."id";

WITH parsed_profitability_items AS (
	SELECT
		"id",
		try_parse_jsonb("notes") AS parsed_notes
	FROM "Profitabilty_line_items"
	WHERE "notes" IS NOT NULL
)
UPDATE "Profitabilty_line_items" AS pli
SET
	"extraFields" = CASE
		WHEN parsed_profitability_items.parsed_notes IS NOT NULL
			AND jsonb_typeof(parsed_profitability_items.parsed_notes) = 'object'
			AND (parsed_profitability_items.parsed_notes - 'Notes') <> '{}'::jsonb
			THEN parsed_profitability_items.parsed_notes - 'Notes'
		ELSE pli."extraFields"
	END,
	"notes" = CASE
		WHEN parsed_profitability_items.parsed_notes IS NOT NULL
			AND jsonb_typeof(parsed_profitability_items.parsed_notes) = 'object'
			AND parsed_profitability_items.parsed_notes ? 'Notes'
			THEN NULLIF(parsed_profitability_items.parsed_notes ->> 'Notes', '')
		ELSE pli."notes"
	END
FROM parsed_profitability_items
WHERE pli."id" = parsed_profitability_items."id";

DROP FUNCTION try_parse_jsonb(TEXT);