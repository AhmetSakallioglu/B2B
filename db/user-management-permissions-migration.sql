-- Admin permissions for creating members and soft-deleting them.

DO $$
BEGIN
  IF to_regclass('public.admin_permissions') IS NOT NULL THEN
    ALTER TABLE admin_permissions
      ADD COLUMN IF NOT EXISTS can_create_users BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS can_delete_users BOOLEAN NOT NULL DEFAULT false;

    UPDATE admin_permissions
    SET
      can_create_users = true,
      can_delete_users = true
    WHERE is_super_admin = true;
  END IF;
END $$;
