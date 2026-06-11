ALTER TABLE attendance
  ADD COLUMN shift_name VARCHAR(40) NOT NULL DEFAULT 'Not marked' AFTER check_in_time;
