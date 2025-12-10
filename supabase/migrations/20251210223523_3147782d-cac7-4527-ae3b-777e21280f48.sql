-- Create storage bucket for property images
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true);

-- Allow authenticated users to upload property images
CREATE POLICY "Authenticated users can upload property images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-images');

-- Allow authenticated users to update their uploaded images
CREATE POLICY "Authenticated users can update property images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'property-images');

-- Allow public read access to property images
CREATE POLICY "Public can view property images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'property-images');