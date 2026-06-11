ALTER TABLE attendance
  MODIFY check_in_latitude DECIMAL(10,7) NULL,
  MODIFY check_in_longitude DECIMAL(10,7) NULL,
  MODIFY check_in_location_status ENUM('Captured', 'Permission denied', 'Location not available', 'Inside', 'Outside', 'Unknown') NOT NULL DEFAULT 'Location not available',
  MODIFY check_out_location_status ENUM('Captured', 'Permission denied', 'Location not available', 'Inside', 'Outside', 'Unknown') NOT NULL DEFAULT 'Location not available',
  ADD COLUMN check_in_accuracy DECIMAL(10,2) NULL AFTER check_in_longitude,
  ADD COLUMN check_in_location_captured_at DATETIME NULL AFTER check_in_location_status,
  ADD COLUMN check_out_accuracy DECIMAL(10,2) NULL AFTER check_out_longitude,
  ADD COLUMN check_out_location_captured_at DATETIME NULL AFTER check_out_location_status;
