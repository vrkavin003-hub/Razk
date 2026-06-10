# HYA Tech SQL Migration Plan

Use this plan when an older SQL Server/MySQL database already exists and must be moved into `hyatech_db`.

## 1. Discovery

- Inventory existing tables, columns, indexes, constraints, triggers, and stored procedures.
- Export row counts per table.
- Identify personally identifiable information and file attachment paths.
- Confirm timezone handling for timestamps.
- Freeze schema changes during migration.

## 2. Backup

Before any migration:

```bash
mysqldump -h old-host -u old-user -p old_database > backup-before-hyatech-migration.sql
```

For SQL Server, create a full `.bak` backup and a CSV export for mapping validation.

## 3. Mapping

Map legacy fields into the new normalized schema:

| New table | Source examples |
| --- | --- |
| `admin_users` | admin/login/user tables |
| `contact_messages` | enquiries/contact_us/leads |
| `career_applications` | job_applications/candidates |
| `announcements` | notices/news |
| `notifications` | alerts/user_notifications |

## 4. Staging Migration

- Create a staging copy of `hyatech_db`.
- Load transformed data into staging first.
- Validate row counts and random sample records.
- Run API smoke tests against staging.

## 5. Transformation Rules

- Lowercase emails.
- Convert plaintext passwords only by forcing password reset; never migrate plaintext into `password_hash`.
- Convert unknown statuses to safe defaults:
  - contact: `new`
  - career: `new`
  - users: `active`
- Normalize dates to UTC timestamps where possible.
- Preserve old IDs in a temporary mapping table if cross-references are needed.

## 6. Cutover

1. Put legacy app into maintenance mode.
2. Take final backup.
3. Run final migration.
4. Validate counts and spot checks.
5. Update backend `.env` to point to production MySQL.
6. Start HYA Tech API.
7. Run admin login, contact submit, career submit, notification, and report tests.

## 7. Rollback

Rollback trigger examples:

- Authentication failure for seeded admin.
- Missing critical data.
- Reports failing for migrated records.
- High API error rate after cutover.

Rollback process:

1. Stop new API.
2. Restore previous database backup.
3. Point deployment back to legacy database/app.
4. Review migration logs and rerun in staging.
