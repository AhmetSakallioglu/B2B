-- Announcement management permission for admin RBAC.

ALTER TABLE admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_announcements BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_permissions
SET can_manage_announcements = true
WHERE is_super_admin = true;
