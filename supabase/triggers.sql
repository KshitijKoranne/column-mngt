-- ============================================================
-- AUDIT TRIGGERS - GMP Compliance
-- Captures every INSERT, UPDATE, DELETE with old/new values
-- ============================================================

-- The audit trigger function reads context variables set by the application
-- The app must call: SET LOCAL app.user_id = '<uuid>';
--                    SET LOCAL app.session_id = '<session>';
--                    SET LOCAL app.ip_address = '<ip>';
-- before each DML statement via a Supabase RPC wrapper.
-- For Supabase, we use the auth.uid() function when available.

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id   UUID;
  v_session   TEXT;
  v_ip        TEXT;
  v_record_id UUID;
BEGIN
  -- Try to get user context from session settings or auth
  BEGIN
    v_user_id := current_setting('app.user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := auth.uid();
  END;

  v_session := current_setting('app.session_id', true);
  v_ip      := current_setting('app.ip_address', true);

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    INSERT INTO public.audit_log (table_name, record_id, action, changed_by, old_values, new_values, ip_address, session_id)
    VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', v_user_id, to_jsonb(OLD), NULL, v_ip, v_session);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    INSERT INTO public.audit_log (table_name, record_id, action, changed_by, old_values, new_values, ip_address, session_id)
    VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', v_user_id, to_jsonb(OLD), to_jsonb(NEW), v_ip, v_session);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    INSERT INTO public.audit_log (table_name, record_id, action, changed_by, old_values, new_values, ip_address, session_id)
    VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', v_user_id, NULL, to_jsonb(NEW), v_ip, v_session);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to all critical tables

CREATE TRIGGER audit_columns
  AFTER INSERT OR UPDATE OR DELETE ON public.columns
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_column_types
  AFTER INSERT OR UPDATE OR DELETE ON public.column_types
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_column_qualification
  AFTER INSERT OR UPDATE OR DELETE ON public.column_qualification
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_column_issuance
  AFTER INSERT OR UPDATE OR DELETE ON public.column_issuance
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_column_usage_log
  AFTER INSERT OR UPDATE OR DELETE ON public.column_usage_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_column_regeneration
  AFTER INSERT OR UPDATE OR DELETE ON public.column_regeneration
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_column_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.column_transfers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_column_discard
  AFTER INSERT OR UPDATE OR DELETE ON public.column_discard
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ============================================================
-- FUNCTION: Update cumulative injections on usage log insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_cumulative_injections()
RETURNS TRIGGER AS $$
BEGIN
  -- Update cumulative_injections_after on the usage log
  NEW.cumulative_injections_after := (
    SELECT COALESCE(SUM(injections_in_session), 0)
    FROM public.column_usage_log
    WHERE column_id = NEW.column_id
  ) + NEW.injections_in_session;

  -- Update the columns table
  UPDATE public.columns
  SET
    cumulative_injections = NEW.cumulative_injections_after,
    last_used_date = NEW.usage_date,
    first_use_date = CASE
      WHEN first_use_date IS NULL THEN NEW.usage_date
      ELSE first_use_date
    END
  WHERE id = NEW.column_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_cumulative_injections
  BEFORE INSERT ON public.column_usage_log
  FOR EACH ROW EXECUTE FUNCTION public.update_cumulative_injections();

-- ============================================================
-- FUNCTION: Lock discarded columns from all modifications
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_discarded_column_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT status FROM public.columns WHERE id = NEW.column_id) = 'discarded' THEN
    RAISE EXCEPTION 'Column % is discarded and cannot be modified.', NEW.column_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_edit_discarded_usage
  BEFORE INSERT ON public.column_usage_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_discarded_column_edit();

CREATE TRIGGER trg_no_edit_discarded_regen
  BEFORE INSERT ON public.column_regeneration
  FOR EACH ROW EXECUTE FUNCTION public.prevent_discarded_column_edit();

CREATE TRIGGER trg_no_edit_discarded_transfer
  BEFORE INSERT ON public.column_transfers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_discarded_column_edit();

-- ============================================================
-- RPC HELPER: Set audit context (called from app before DML)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_audit_context(
  p_user_id  TEXT,
  p_session  TEXT DEFAULT '',
  p_ip       TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.user_id',    p_user_id, true);
  PERFORM set_config('app.session_id', p_session, true);
  PERFORM set_config('app.ip_address', p_ip,      true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Automatically update column status when approval
-- chain reaches final 'approved' state
-- This is more reliable than doing it from the frontend,
-- as it runs server-side with SECURITY DEFINER (bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_column_status_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when approval_status changes TO 'approved'
  IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN

    -- column_qualification approved → column becomes active
    IF TG_TABLE_NAME = 'column_qualification' THEN
      UPDATE public.columns
      SET status = 'active', updated_at = NOW()
      WHERE id = NEW.column_id AND status = 'qualification_pending';

    -- column_discard approved → column becomes discarded
    ELSIF TG_TABLE_NAME = 'column_discard' THEN
      UPDATE public.columns
      SET status = 'discarded', updated_at = NOW()
      WHERE id = NEW.column_id;

    -- column_transfers approved → column becomes transferred
    ELSIF TG_TABLE_NAME = 'column_transfers' THEN
      UPDATE public.columns
      SET status = 'transferred', updated_at = NOW()
      WHERE id = NEW.column_id;

    END IF;
  END IF;

  -- Also handle rejection of qualification → revert to qualification_pending
  IF NEW.approval_status = 'rejected' AND OLD.approval_status != 'rejected' THEN
    IF TG_TABLE_NAME = 'column_qualification' THEN
      UPDATE public.columns
      SET status = 'qualification_pending', updated_at = NOW()
      WHERE id = NEW.column_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all approval tables
CREATE TRIGGER trg_sync_status_on_qual_approval
  AFTER UPDATE ON public.column_qualification
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

CREATE TRIGGER trg_sync_status_on_discard_approval
  AFTER UPDATE ON public.column_discard
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

CREATE TRIGGER trg_sync_status_on_transfer_approval
  AFTER UPDATE ON public.column_transfers
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

-- ============================================================
-- FIX 5: Regeneration approval → column back to 'active'
-- FIX 6: Transfer approval → update actual column fields
-- FIX 4: Issuance approval → update column assignment fields
-- Added to sync_column_status_on_approval function (replace it)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_column_status_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when approval_status changes TO 'approved'
  IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN

    IF TG_TABLE_NAME = 'column_qualification' THEN
      UPDATE public.columns
      SET status = 'active', updated_at = NOW()
      WHERE id = NEW.column_id AND status = 'qualification_pending';

    ELSIF TG_TABLE_NAME = 'column_discard' THEN
      UPDATE public.columns
      SET status = 'discarded', updated_at = NOW()
      WHERE id = NEW.column_id;

    ELSIF TG_TABLE_NAME = 'column_transfers' THEN
      -- FIX 6: Update actual column fields based on transfer type + to_value
      UPDATE public.columns
      SET
        status = 'active', -- stays active after transfer, not 'transferred'
        assigned_product = CASE WHEN NEW.transfer_type = 'product' THEN NEW.to_value ELSE assigned_product END,
        assigned_method  = CASE WHEN NEW.transfer_type = 'method'  THEN NEW.to_value ELSE assigned_method END,
        storage_location = CASE WHEN NEW.transfer_type = 'location' THEN NEW.to_value ELSE storage_location END,
        assigned_analyst_id = CASE
          WHEN NEW.transfer_type = 'analyst' THEN (
            SELECT id FROM public.profiles WHERE full_name = NEW.to_value LIMIT 1
          )
          ELSE assigned_analyst_id
        END,
        updated_at = NOW()
      WHERE id = NEW.column_id;

    ELSIF TG_TABLE_NAME = 'column_regeneration' THEN
      -- FIX 5: Regeneration approved (returned_to_service) → column back to active
      IF NEW.outcome = 'returned_to_service' THEN
        UPDATE public.columns
        SET status = 'active', updated_at = NOW()
        WHERE id = NEW.column_id AND status = 'regeneration';
      END IF;

    ELSIF TG_TABLE_NAME = 'column_issuance' THEN
      -- FIX 4: Issuance approved → now update column assignment fields
      UPDATE public.columns
      SET
        assigned_analyst_id = NEW.issued_to,
        assigned_product    = NEW.product_name,
        assigned_method     = NEW.method_reference,
        updated_at = NOW()
      WHERE id = NEW.column_id;

    END IF;
  END IF;

  -- Handle rejections
  IF NEW.approval_status = 'rejected' AND OLD.approval_status != 'rejected' THEN
    IF TG_TABLE_NAME = 'column_qualification' THEN
      UPDATE public.columns
      SET status = 'qualification_pending', updated_at = NOW()
      WHERE id = NEW.column_id;
    ELSIF TG_TABLE_NAME = 'column_regeneration' THEN
      -- Regeneration rejected → revert to active
      UPDATE public.columns
      SET status = 'active', updated_at = NOW()
      WHERE id = NEW.column_id AND status = 'regeneration';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach triggers (DROP IF EXISTS first to avoid duplicates)
DROP TRIGGER IF EXISTS trg_sync_status_on_qual_approval ON public.column_qualification;
DROP TRIGGER IF EXISTS trg_sync_status_on_discard_approval ON public.column_discard;
DROP TRIGGER IF EXISTS trg_sync_status_on_transfer_approval ON public.column_transfers;
DROP TRIGGER IF EXISTS trg_sync_status_on_regen_approval ON public.column_regeneration;
DROP TRIGGER IF EXISTS trg_sync_status_on_issuance_approval ON public.column_issuance;

CREATE TRIGGER trg_sync_status_on_qual_approval
  AFTER UPDATE ON public.column_qualification
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

CREATE TRIGGER trg_sync_status_on_discard_approval
  AFTER UPDATE ON public.column_discard
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

CREATE TRIGGER trg_sync_status_on_transfer_approval
  AFTER UPDATE ON public.column_transfers
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

CREATE TRIGGER trg_sync_status_on_regen_approval
  AFTER UPDATE ON public.column_regeneration
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

CREATE TRIGGER trg_sync_status_on_issuance_approval
  AFTER UPDATE ON public.column_issuance
  FOR EACH ROW EXECUTE FUNCTION public.sync_column_status_on_approval();

-- ============================================================
-- FIX 2+7: RPC for auto-discard when post-regen SST fails
-- Analyst cannot INSERT into column_discard (RLS blocks it)
-- This SECURITY DEFINER function bypasses that restriction
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_raise_discard_on_sst_failure(
  p_column_id UUID,
  p_initiated_by UUID,
  p_reason_details TEXT,
  p_cumulative_injections INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.column_discard (
    column_id,
    discard_reason,
    reason_details,
    cumulative_injections_at_discard,
    initiated_by,
    approval_status,
    approval_chain
  ) VALUES (
    p_column_id,
    'sst_failure_post_regen',
    p_reason_details,
    p_cumulative_injections,
    p_initiated_by,
    'pending_supervisor',
    jsonb_build_object(
      'analyst', jsonb_build_object(
        'user_id', p_initiated_by::text,
        'action', 'submitted',
        'timestamp', NOW()::text,
        'remarks', p_reason_details
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.auto_raise_discard_on_sst_failure(UUID, UUID, TEXT, INTEGER) TO authenticated;
