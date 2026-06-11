CREATE DATABASE IF NOT EXISTS hyatech_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hyatech_db;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'hr', 'manager', 'viewer') NOT NULL DEFAULT 'admin',
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_users_username (username),
  UNIQUE KEY uk_admin_users_email (email),
  KEY idx_admin_users_role_status (role, status),
  CONSTRAINT chk_admin_users_email CHECK (email LIKE '%_@_%._%')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_password_reset_tokens_hash (token_hash),
  KEY idx_password_reset_tokens_user (user_id, expires_at, used_at),
  CONSTRAINT fk_password_reset_tokens_user
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS office_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  office_name VARCHAR(120) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  radius_meters INT UNSIGNED NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_office_locations_status_updated (status, updated_at),
  CONSTRAINT chk_office_locations_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_office_locations_longitude CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_office_locations_radius CHECK (radius_meters BETWEEN 1 AND 5000)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id VARCHAR(80) NOT NULL,
  check_in_time DATETIME NOT NULL,
  shift_name VARCHAR(40) NOT NULL DEFAULT 'Not marked',
  check_in_latitude DECIMAL(10,7) NULL,
  check_in_longitude DECIMAL(10,7) NULL,
  check_in_accuracy DECIMAL(10,2) NULL,
  check_in_location_status ENUM('Captured', 'Permission denied', 'Location not available', 'Inside', 'Outside', 'Unknown') NOT NULL DEFAULT 'Location not available',
  check_in_location_captured_at DATETIME NULL,
  check_in_distance_meters INT UNSIGNED NULL,
  check_out_time DATETIME NULL,
  check_out_latitude DECIMAL(10,7) NULL,
  check_out_longitude DECIMAL(10,7) NULL,
  check_out_accuracy DECIMAL(10,2) NULL,
  check_out_location_status ENUM('Captured', 'Permission denied', 'Location not available', 'Inside', 'Outside', 'Unknown') NOT NULL DEFAULT 'Location not available',
  check_out_location_captured_at DATETIME NULL,
  check_out_distance_meters INT UNSIGNED NULL,
  work_duration DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  date DATE NOT NULL,
  status ENUM('Present', 'Late', 'Half Day', 'Absent') NOT NULL DEFAULT 'Present',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_attendance_employee_date (employee_id, date),
  KEY idx_attendance_date_status (date, status),
  KEY idx_attendance_employee_created (employee_id, created_at),
  CONSTRAINT chk_attendance_check_in_lat CHECK (check_in_latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_attendance_check_in_lng CHECK (check_in_longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_attendance_check_out_lat CHECK (check_out_latitude IS NULL OR check_out_latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_attendance_check_out_lng CHECK (check_out_longitude IS NULL OR check_out_longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  company VARCHAR(160) NULL,
  subject VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('new', 'in_review', 'responded', 'closed', 'spam') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contact_messages_status_created (status, created_at),
  KEY idx_contact_messages_email (email),
  FULLTEXT KEY ft_contact_messages_search (name, email, company, subject, message),
  CONSTRAINT chk_contact_messages_email CHECK (email LIKE '%_@_%._%')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS career_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(140) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  position VARCHAR(140) NOT NULL,
  experience DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  qualification VARCHAR(190) NOT NULL,
  resume_url VARCHAR(500) NOT NULL,
  cover_letter TEXT NULL,
  status ENUM('new', 'screening', 'shortlisted', 'interview', 'offered', 'rejected', 'archived') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_career_applications_status_created (status, created_at),
  KEY idx_career_applications_position (position),
  KEY idx_career_applications_email (email),
  FULLTEXT KEY ft_career_applications_search (full_name, email, position, qualification, cover_letter),
  CONSTRAINT chk_career_applications_email CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_career_applications_experience CHECK (experience >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_created_by (created_by),
  KEY idx_announcements_created_at (created_at),
  FULLTEXT KEY ft_announcements_search (title, description),
  CONSTRAINT fk_announcements_created_by
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('system', 'announcement', 'contact', 'career', 'security', 'report') NOT NULL DEFAULT 'system',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read_created (user_id, is_read, created_at),
  KEY idx_notifications_type (type),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user_created (user_id, created_at),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_exports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  report_type VARCHAR(80) NOT NULL,
  format ENUM('pdf', 'excel', 'csv') NOT NULL,
  filters JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_report_exports_user_created (user_id, created_at),
  KEY idx_report_exports_type_format (report_type, format),
  CONSTRAINT fk_report_exports_user
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
