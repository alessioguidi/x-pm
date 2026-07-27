CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table per gli ospiti
CREATE TABLE IF NOT EXISTS public.booking_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- es. '16' (Singolo), '17' (Capo Famiglia), '18' (Capo Gruppo), '19' (Membro Gruppo), '20' (Familiare)
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(1) NOT NULL, -- 'M' o 'F'
    birth_date DATE NOT NULL,
    citizenship VARCHAR(50) NOT NULL, -- 100000100 per Italia
    birth_country VARCHAR(50), 
    birth_city VARCHAR(50), 
    residence_country VARCHAR(50) NOT NULL,
    residence_city VARCHAR(50),
    residence_address VARCHAR(150),
    document_type VARCHAR(50),
    document_number VARCHAR(50),
    document_issue_country VARCHAR(50),
    document_issue_city VARCHAR(50),
    document_front_url TEXT,
    document_back_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS per booking_guests
ALTER TABLE public.booking_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consenti a tutti l'inserimento degli ospiti"
ON public.booking_guests FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Consenti agli utenti loggati la lettura degli ospiti"
ON public.booking_guests FOR SELECT TO authenticated
USING (true);

-- 2. Modifica alla tabella Properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ross1000_wsdl_url VARCHAR(255);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ross1000_username VARCHAR(100);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ross1000_password VARCHAR(100);

-- 3. Inserimento Bucket Storage se non esiste
INSERT INTO storage.buckets (id, name, public, "file_size_limit", "allowed_mime_types")
VALUES ('guest_documents', 'guest_documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Policies per storage.objects
CREATE POLICY "Public Upload Guest Documents"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'guest_documents');

CREATE POLICY "Authenticated Read Guest Documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'guest_documents');
