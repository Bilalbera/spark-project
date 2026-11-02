-- Allow the existing private media bucket to accept large resumable uploads.
-- The Supabase project's global upload limit must also permit this size.
UPDATE storage.buckets
   SET file_size_limit = 53687091200
 WHERE id = 'media';
