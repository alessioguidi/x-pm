-- Permetti agli ospiti (anon) di modificare i propri dati inseriti
DROP POLICY IF EXISTS "Consenti a tutti l'aggiornamento degli ospiti" ON public.booking_guests;
CREATE POLICY "Consenti a tutti l'aggiornamento degli ospiti"
ON public.booking_guests FOR UPDATE TO public
USING (true)
WITH CHECK (true);
