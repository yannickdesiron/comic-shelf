ALTER TABLE `albums` ADD `read_status` text DEFAULT 'unread' NOT NULL;--> statement-breakpoint
UPDATE `albums` SET `read_status` = (
  SELECT CASE
    WHEN MAX(c.read_status = 'read') = 1 THEN 'read'
    WHEN MAX(c.read_status = 'reading') = 1 THEN 'reading'
    ELSE 'unread'
  END
  FROM `editions` e JOIN `copies` c ON c.edition_id = e.id
  WHERE e.album_id = `albums`.id
) WHERE EXISTS (
  SELECT 1 FROM `editions` e JOIN `copies` c ON c.edition_id = e.id WHERE e.album_id = `albums`.id
);--> statement-breakpoint
ALTER TABLE `copies` DROP COLUMN `read_status`;
