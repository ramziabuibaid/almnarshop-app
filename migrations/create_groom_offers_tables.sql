-- Migration to create dedicated groom_offers tables

-- 1. Create table `groom_offers`
CREATE TABLE IF NOT EXISTS public.groom_offers (
    offer_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'فعال',
    notes TEXT,
    special_discount_amount NUMERIC(10,2) DEFAULT 0,
    gift_discount_amount NUMERIC(10,2) DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for groom_offers
ALTER TABLE public.groom_offers ENABLE ROW LEVEL SECURITY;

-- 2. Create table `groom_offer_details`
CREATE TABLE IF NOT EXISTS public.groom_offer_details (
    detail_id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL REFERENCES public.groom_offers(offer_id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(product_id) ON DELETE RESTRICT,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    is_gift BOOLEAN DEFAULT FALSE,
    serial_nos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for groom_offer_details
ALTER TABLE public.groom_offer_details ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow public read access to active offers
CREATE POLICY "Enable read access for all users"
  ON public.groom_offers FOR SELECT
  USING ( true );

CREATE POLICY "Enable read access for all users"
  ON public.groom_offer_details FOR SELECT
  USING ( true );

-- Allow insert access for all users
CREATE POLICY "Enable insert access for all users"
    ON public.groom_offers FOR INSERT
    WITH CHECK ( true );

CREATE POLICY "Enable insert access for all users"
    ON public.groom_offer_details FOR INSERT
    WITH CHECK ( true );

-- Allow update access for all users
CREATE POLICY "Enable update access for all users"
    ON public.groom_offers FOR UPDATE
    USING ( true )
    WITH CHECK ( true );

CREATE POLICY "Enable update access for all users"
    ON public.groom_offer_details FOR UPDATE
    USING ( true )
    WITH CHECK ( true );

-- Allow delete access for all users
CREATE POLICY "Enable delete access for all users"
    ON public.groom_offers FOR DELETE
    USING ( true );

CREATE POLICY "Enable delete access for all users"
    ON public.groom_offer_details FOR DELETE
    USING ( true );

-- 4. Create trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_groom_offers_modtime
    BEFORE UPDATE ON public.groom_offers
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();
