-- Permetti agli ospiti (anon) di leggere i propri dati inseriti
DROP POLICY IF EXISTS "Consenti a tutti la lettura degli ospiti" ON public.booking_guests;
CREATE POLICY "Consenti a tutti la lettura degli ospiti"
ON public.booking_guests FOR SELECT TO public
USING (true);

-- Permetti agli ospiti (anon) di modificare i propri dati inseriti
DROP POLICY IF EXISTS "Consenti a tutti l'aggiornamento degli ospiti" ON public.booking_guests;
CREATE POLICY "Consenti a tutti l'aggiornamento degli ospiti"
ON public.booking_guests FOR UPDATE TO public
USING (true)
WITH CHECK (true);

-- Permetti a tutti di visualizzare i documenti caricati (check-in)
DROP POLICY IF EXISTS "Public Read Guest Documents" ON storage.objects;
CREATE POLICY "Public Read Guest Documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'guest_documents');
