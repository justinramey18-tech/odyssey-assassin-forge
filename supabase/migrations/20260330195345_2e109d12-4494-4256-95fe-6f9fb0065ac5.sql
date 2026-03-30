ALTER TABLE telegram_user_links
ADD COLUMN telegram_active_mode text NOT NULL DEFAULT 'party'
CHECK (telegram_active_mode IN ('solo', 'party', 'empyrean'));