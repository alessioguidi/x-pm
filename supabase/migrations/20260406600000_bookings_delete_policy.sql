CREATE POLICY "Admins delete own org bookings" ON bookings FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.organization_id = bookings.organization_id
  )
);
