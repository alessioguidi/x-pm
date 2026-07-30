-- Create bucket for guest documents (check-in IDs, checkout videos)
INSERT INTO storage.buckets (id, name, public) VALUES ('guest_documents', 'guest_documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to avoid conflicts, then recreate
DROP POLICY IF EXISTS "Anyone can view guest documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload guest documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Guest Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Read Guest Documents" ON storage.objects;

-- Allow anyone to view guest documents
CREATE POLICY "Anyone can view guest documents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'guest_documents' );

-- Allow anyone to upload guest documents (check-in is a public page)
CREATE POLICY "Anyone can upload guest documents"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'guest_documents' );
