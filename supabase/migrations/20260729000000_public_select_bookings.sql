-- Allow unauthenticated users to SELECT bookings by ID (needed for check-in page)
CREATE POLICY "Public can view booking by id" ON bookings
  FOR SELECT USING (
    true
  );
