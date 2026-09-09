-- ==============================================================================
-- GrabIt: Rider Attendance Table
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vhcmjwuhdcdxqmyjvqpz/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.rider_attendance (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id      uuid         REFERENCES public.profiles(id) ON DELETE CASCADE,
  rider_phone   text         NOT NULL,
  date          date         NOT NULL,
  punch_in      timestamptz,
  punch_out     timestamptz,
  duration_minutes integer   DEFAULT 0,
  status        text         NOT NULL DEFAULT 'PRESENT',
  minutes_late  integer      DEFAULT 0,
  is_online     boolean      DEFAULT false,
  shift_note    text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(rider_phone, date)
);

CREATE INDEX IF NOT EXISTS idx_rider_attendance_phone ON public.rider_attendance(rider_phone);
CREATE INDEX IF NOT EXISTS idx_rider_attendance_date  ON public.rider_attendance(date);
CREATE INDEX IF NOT EXISTS idx_rider_attendance_rider ON public.rider_attendance(rider_id);

ALTER TABLE public.rider_attendance DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rider_attendance_updated_at ON public.rider_attendance;
CREATE TRIGGER trg_rider_attendance_updated_at
  BEFORE UPDATE ON public.rider_attendance
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
