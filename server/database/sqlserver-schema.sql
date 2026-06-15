IF DB_ID(N'razk_automation_hrms') IS NULL
BEGIN
  CREATE DATABASE [razk_automation_hrms];
END;
GO

USE [razk_automation_hrms];
GO

IF OBJECT_ID('dbo.admin_users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.admin_users (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    username NVARCHAR(80) NOT NULL UNIQUE,
    email NVARCHAR(190) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(30) NOT NULL CONSTRAINT df_admin_users_role DEFAULT 'admin',
    status NVARCHAR(20) NOT NULL CONSTRAINT df_admin_users_status DEFAULT 'active',
    last_login_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_admin_users_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_admin_users_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_admin_users_role CHECK (role IN ('super_admin', 'admin', 'hr', 'manager', 'viewer', 'employee', 'dri')),
    CONSTRAINT chk_admin_users_status CHECK (status IN ('active', 'inactive', 'suspended')),
    CONSTRAINT chk_admin_users_email CHECK (email LIKE '%_@_%._%')
  );
END;
GO

IF OBJECT_ID('dbo.refresh_tokens', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.refresh_tokens (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME2 NOT NULL,
    revoked_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_refresh_tokens_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.admin_users(id) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID('dbo.password_reset_tokens', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.password_reset_tokens (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME2 NOT NULL,
    used_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_password_reset_tokens_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.admin_users(id) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID('dbo.office_locations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.office_locations (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    office_name NVARCHAR(120) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    radius_meters INT NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT df_office_locations_status DEFAULT 'active',
    created_at DATETIME2 NOT NULL CONSTRAINT df_office_locations_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_office_locations_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_office_locations_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_office_locations_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_office_locations_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_office_locations_radius CHECK (radius_meters BETWEEN 1 AND 5000)
  );
END;
GO

IF OBJECT_ID('dbo.attendance', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.attendance (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    employee_id NVARCHAR(80) NOT NULL,
    check_in_time DATETIME2 NOT NULL,
    shift_name NVARCHAR(40) NOT NULL CONSTRAINT df_attendance_shift_name DEFAULT 'Not marked',
    check_in_latitude DECIMAL(10,7) NULL,
    check_in_longitude DECIMAL(10,7) NULL,
    check_in_accuracy DECIMAL(10,2) NULL,
    check_in_location_status NVARCHAR(40) NOT NULL CONSTRAINT df_attendance_check_in_status DEFAULT 'Location not available',
    check_in_location_captured_at DATETIME2 NULL,
    check_in_distance_meters INT NULL,
    check_out_time DATETIME2 NULL,
    check_out_latitude DECIMAL(10,7) NULL,
    check_out_longitude DECIMAL(10,7) NULL,
    check_out_accuracy DECIMAL(10,2) NULL,
    check_out_location_status NVARCHAR(40) NOT NULL CONSTRAINT df_attendance_check_out_status DEFAULT 'Location not available',
    check_out_location_captured_at DATETIME2 NULL,
    check_out_distance_meters INT NULL,
    work_duration DECIMAL(6,2) NOT NULL CONSTRAINT df_attendance_work_duration DEFAULT 0.00,
    [date] DATE NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT df_attendance_status DEFAULT 'Present',
    created_at DATETIME2 NOT NULL CONSTRAINT df_attendance_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_attendance_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, [date]),
    CONSTRAINT chk_attendance_status CHECK (status IN ('Present', 'Late', 'Half Day', 'Absent'))
  );
END;
GO

IF OBJECT_ID('dbo.contact_messages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.contact_messages (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name NVARCHAR(120) NOT NULL,
    email NVARCHAR(190) NOT NULL,
    phone NVARCHAR(30) NULL,
    company NVARCHAR(160) NULL,
    subject NVARCHAR(180) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT df_contact_messages_status DEFAULT 'new',
    created_at DATETIME2 NOT NULL CONSTRAINT df_contact_messages_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_contact_messages_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_contact_messages_status CHECK (status IN ('new', 'in_review', 'responded', 'closed', 'spam')),
    CONSTRAINT chk_contact_messages_email CHECK (email LIKE '%_@_%._%')
  );
END;
GO

IF OBJECT_ID('dbo.career_applications', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.career_applications (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    full_name NVARCHAR(140) NOT NULL,
    email NVARCHAR(190) NOT NULL,
    phone NVARCHAR(30) NOT NULL,
    position NVARCHAR(140) NOT NULL,
    experience DECIMAL(4,1) NOT NULL CONSTRAINT df_career_applications_experience DEFAULT 0.0,
    qualification NVARCHAR(190) NOT NULL,
    resume_url NVARCHAR(500) NOT NULL,
    cover_letter NVARCHAR(MAX) NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT df_career_applications_status DEFAULT 'new',
    created_at DATETIME2 NOT NULL CONSTRAINT df_career_applications_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_career_applications_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_career_applications_status CHECK (status IN ('new', 'screening', 'shortlisted', 'interview', 'offered', 'rejected', 'archived')),
    CONSTRAINT chk_career_applications_email CHECK (email LIKE '%_@_%._%')
  );
END;
GO

IF OBJECT_ID('dbo.announcements', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.announcements (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    title NVARCHAR(180) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_announcements_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_announcements_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES dbo.admin_users(id) ON DELETE NO ACTION
  );
END;
GO

IF OBJECT_ID('dbo.notifications', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.notifications (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title NVARCHAR(180) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    type NVARCHAR(20) NOT NULL CONSTRAINT df_notifications_type DEFAULT 'system',
    is_read BIT NOT NULL CONSTRAINT df_notifications_is_read DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT df_notifications_created_at DEFAULT SYSDATETIME(),
    read_at DATETIME2 NULL,
    CONSTRAINT chk_notifications_type CHECK (type IN ('system', 'announcement', 'contact', 'career', 'security', 'report')),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES dbo.admin_users(id) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID('dbo.audit_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_logs (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id BIGINT NULL,
    action NVARCHAR(120) NOT NULL,
    entity_type NVARCHAR(80) NOT NULL,
    entity_id BIGINT NULL,
    ip_address NVARCHAR(64) NULL,
    user_agent NVARCHAR(255) NULL,
    metadata NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_audit_logs_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES dbo.admin_users(id) ON DELETE SET NULL
  );
END;
GO

IF OBJECT_ID('dbo.report_exports', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.report_exports (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id BIGINT NULL,
    report_type NVARCHAR(80) NOT NULL,
    format NVARCHAR(20) NOT NULL,
    filters NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_report_exports_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_report_exports_format CHECK (format IN ('pdf', 'excel', 'csv')),
    CONSTRAINT fk_report_exports_user FOREIGN KEY (user_id) REFERENCES dbo.admin_users(id) ON DELETE SET NULL
  );
END;
GO
