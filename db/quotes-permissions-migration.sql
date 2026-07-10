-- Quote management permission for admin RBAC

DO $$
BEGIN
  IF to_regclass('public.admin_permissions') IS NOT NULL THEN
    ALTER TABLE admin_permissions
      ADD COLUMN IF NOT EXISTS can_manage_quotes BOOLEAN NOT NULL DEFAULT false;

    UPDATE admin_permissions
    SET can_manage_quotes = true
    WHERE is_super_admin = true;
  END IF;
END $$;
