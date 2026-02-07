-- ==========================================
-- Fix: آخر تجديد — يحدّث فقط عند زيادة المجموع (محل + مخزن)
-- ==========================================
-- نقل النواقص من المخزن إلى المحل لا يزيد المجموع → لا يحدّث التاريخ.
-- التشغيل: Supabase → SQL Editor → Run
-- ==========================================

CREATE OR REPLACE FUNCTION products_update_last_restocked_at()
RETURNS TRIGGER AS $$
DECLARE
  old_total NUMERIC;
  new_total NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.last_restocked_at := NOW();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_total := COALESCE(OLD.cs_war, 0) + COALESCE(OLD.cs_shop, 0);
    new_total := COALESCE(NEW.cs_war, 0) + COALESCE(NEW.cs_shop, 0);

    -- تحديث التاريخ فقط عند وصول بضاعة جديدة (زيادة المجموع)
    -- نقل من المخزن للمحل = نفس المجموع → لا نحدّث
    IF new_total > old_total THEN
      NEW.last_restocked_at := NOW();
    ELSE
      NEW.last_restocked_at := OLD.last_restocked_at;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة ربط الـ trigger بالجدول
DROP TRIGGER IF EXISTS products_last_restocked_at_trigger ON products;
CREATE TRIGGER products_last_restocked_at_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_update_last_restocked_at();
