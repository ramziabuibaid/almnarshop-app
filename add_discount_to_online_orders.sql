-- ==========================================
-- إضافة عمود الخصم (discount) لجدول online_orders
-- Add discount column to online_orders table
-- ==========================================

-- إضافة عمود discount إذا لم يكن موجوداً
ALTER TABLE online_orders 
ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0;

-- تحديث القيم الموجودة لتكون 0 إذا كانت NULL
UPDATE online_orders 
SET discount = 0 
WHERE discount IS NULL;

-- تعيين NOT NULL constraint (بعد تحديث القيم)
ALTER TABLE online_orders 
ALTER COLUMN discount SET NOT NULL;

-- تعيين القيمة الافتراضية
ALTER TABLE online_orders 
ALTER COLUMN discount SET DEFAULT 0;

-- تعليق على العمود
COMMENT ON COLUMN online_orders.discount IS 'خصم خاص على الطلبية (بالشيكل)';

