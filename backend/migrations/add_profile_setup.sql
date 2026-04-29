-- Add profile setup fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS passport_image_url TEXT,
  ADD COLUMN IF NOT EXISTS face_image_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
