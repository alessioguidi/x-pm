-- Note libere del cliente al check-out
alter table "public"."bookings" add column if not exists "checkout_notes" text;