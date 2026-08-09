-- Codice comune di rilascio del documento (per AlloggiatiWeb, campo Luogo Rilascio Documento)
ALTER TABLE public.booking_guests ADD COLUMN IF NOT EXISTS document_issue_city_code TEXT;
