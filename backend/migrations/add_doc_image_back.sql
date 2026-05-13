-- Add back-side document image column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS doc_image_back_url TEXT;
