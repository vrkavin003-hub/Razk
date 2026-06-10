# HYA Tech SQL Database Schema

Production database name: `hyatech_db`

Canonical SQL script:

```text
server/database/schema.sql
```

## Entity Diagram

```mermaid
erDiagram
  ADMIN_USERS ||--o{ REFRESH_TOKENS : owns
  ADMIN_USERS ||--o{ PASSWORD_RESET_TOKENS : owns
  ADMIN_USERS ||--o{ ANNOUNCEMENTS : creates
  ADMIN_USERS ||--o{ NOTIFICATIONS : receives
  ADMIN_USERS ||--o{ AUDIT_LOGS : creates
  ADMIN_USERS ||--o{ REPORT_EXPORTS : creates

  OFFICE_LOCATIONS {
    bigint id PK
    varchar office_name
    decimal latitude
    decimal longitude
    int radius_meters
    enum status
    timestamp created_at
    timestamp updated_at
  }

  ATTENDANCE {
    bigint id PK
    varchar employee_id
    datetime check_in_time
    decimal check_in_latitude
    decimal check_in_longitude
    enum check_in_location_status
    int check_in_distance_meters
    datetime check_out_time
    decimal check_out_latitude
    decimal check_out_longitude
    enum check_out_location_status
    int check_out_distance_meters
    decimal work_duration
    date date
    enum status
    timestamp created_at
    timestamp updated_at
  }

  ADMIN_USERS {
    bigint id PK
    varchar username UK
    varchar email UK
    varchar password_hash
    enum role
    enum status
    datetime last_login_at
    timestamp created_at
    timestamp updated_at
  }

  CONTACT_MESSAGES {
    bigint id PK
    varchar name
    varchar email
    varchar phone
    varchar company
    varchar subject
    text message
    enum status
    timestamp created_at
    timestamp updated_at
  }

  CAREER_APPLICATIONS {
    bigint id PK
    varchar full_name
    varchar email
    varchar phone
    varchar position
    decimal experience
    varchar qualification
    varchar resume_url
    text cover_letter
    enum status
    timestamp created_at
    timestamp updated_at
  }

  ANNOUNCEMENTS {
    bigint id PK
    varchar title
    text description
    bigint created_by FK
    timestamp created_at
    timestamp updated_at
  }

  NOTIFICATIONS {
    bigint id PK
    bigint user_id FK
    varchar title
    text message
    enum type
    boolean is_read
    timestamp created_at
    datetime read_at
  }

  REFRESH_TOKENS {
    bigint id PK
    bigint user_id FK
    char token_hash UK
    datetime expires_at
    datetime revoked_at
    timestamp created_at
  }

  PASSWORD_RESET_TOKENS {
    bigint id PK
    bigint user_id FK
    char token_hash UK
    datetime expires_at
    datetime used_at
    timestamp created_at
  }

  AUDIT_LOGS {
    bigint id PK
    bigint user_id FK
    varchar action
    varchar entity_type
    bigint entity_id
    varchar ip_address
    varchar user_agent
    json metadata
    timestamp created_at
  }

  REPORT_EXPORTS {
    bigint id PK
    bigint user_id FK
    varchar report_type
    enum format
    json filters
    timestamp created_at
  }
```

## Production Notes

- All primary data tables use InnoDB, `utf8mb4`, primary keys, indexed timestamps, and status indexes.
- Passwords are stored only as bcrypt hashes.
- Refresh and password reset tokens are stored as SHA-256 hashes, never in plaintext.
- Contact and career tables include full-text indexes for scalable admin search.
- Foreign keys use restrictive or cascading deletes depending on data ownership.
