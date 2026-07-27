-- Create a public bucket to hold property photos
INSERT INTO storage.buckets (id, name, public) VALUES ('property_images', 'property_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allows anyone to view the photos on the public website
CREATE POLICY "Anyone can view property photos" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'property_images' );

-- Normally, we would restrict uploads to Authenticated admins only. 
-- For MVP and local testing simplicity, we can temporarily allow anonymous uploads
-- Replace the policy below with strict auth once ready for production
CREATE POLICY "Staff can upload property photos" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'property_images' );
