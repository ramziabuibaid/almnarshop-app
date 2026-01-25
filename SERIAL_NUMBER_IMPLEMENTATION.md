# دليل تطبيق ميزة Serial Number

## ✅ ما تم إنجازه:

### 1. قاعدة البيانات
- ✅ ملف Migration: `migrations/add_serial_number_support.sql`
- ✅ إضافة `is_serialized` في جدول `products`
- ✅ إضافة `serial_no` في:
  - `cash_invoice_details`
  - `shop_sales_details`
  - `warehouse_sales_details`
  - `quotation_details`

### 2. Types & Interfaces
- ✅ تحديث `Product` interface في `types/index.ts`
- ✅ تحديث `mapProductFromSupabase` في `lib/api.ts`
- ✅ تحديث `saveProduct` في `lib/api.ts`

### 3. Product Form
- ✅ إضافة checkbox `is_serialized` في `ProductFormModal.tsx`

### 4. Shop Sales (فواتير المحل)
- ✅ تحديث `InvoiceDetail` interface
- ✅ إضافة state `newProductSerialNo`
- ✅ إضافة input field في واجهة إضافة المنتج
- ✅ إضافة عمود السيريال في الجدول (Desktop)
- ✅ إضافة حقل السيريال في عرض الموبايل
- ✅ تحديث `saveShopSalesInvoice` في `lib/api.ts`

## ✅ ما تم إنجازه (محدث):

### 1. قاعدة البيانات
- ✅ ملف Migration: `migrations/add_serial_number_support.sql`
- ✅ إضافة `is_serialized` في جدول `products`
- ✅ إضافة `serial_no` في جميع جداول التفاصيل

### 2. Types & Interfaces
- ✅ تحديث `Product` interface
- ✅ تحديث `mapProductFromSupabase`
- ✅ تحديث `saveProduct`

### 3. Product Form
- ✅ إضافة checkbox `is_serialized` في `ProductFormModal.tsx`

### 4. Shop Sales (فواتير المحل)
- ✅ تحديث `app/admin/shop-sales/new/page.tsx`
- ✅ تحديث `saveShopSalesInvoice` في `lib/api.ts`
- ✅ تحديث `updateShopSalesInvoice` في `lib/api.ts`

### 5. Warehouse Sales (فواتير المخزن)
- ✅ تحديث `app/admin/warehouse-sales/new/page.tsx`
- ✅ تحديث `saveWarehouseSalesInvoice` في `lib/api.ts`
- ✅ تحديث `updateWarehouseSalesInvoice` في `lib/api.ts`

### 6. Cash Invoices (الفواتير النقدية)
- ✅ تحديث `app/admin/pos/page.tsx`
- ✅ تحديث `saveCashInvoice` في `lib/api.ts`
- ✅ تحديث `updateCashInvoice` في `lib/api.ts`

### 7. Quotations (عروض الأسعار)
- ✅ تحديث `app/admin/quotations/new/page.tsx`
- ✅ تحديث `saveQuotation` في `lib/api.ts`

### 8. Validation
- ✅ إضافة `lib/validation.ts` (معطلة حالياً)
- ✅ إضافة validation checks في جميع صفحات الحفظ

## 🔄 ما يحتاج إكمال (اختياري):

### 1. صفحات Edit
- [ ] تحديث `app/admin/shop-sales/edit/[id]/page.tsx`
- [ ] تحديث `app/admin/warehouse-sales/edit/[id]/page.tsx`
- [ ] تحديث `app/admin/quotations/[id]/page.tsx`

### 2. صفحات العرض والطباعة
- [ ] تحديث صفحات print لجميع أنواع الفواتير
- [ ] إضافة عرض السيريال في الجداول

### 3. تفعيل Validation
- [ ] تغيير `VALIDATION_ENABLED = true` في `lib/validation.ts`
- [ ] اختبار validation على جميع أنواع الفواتير

## 📝 ملاحظات:

1. **المرحلة الحالية**: جميع حقول السيريال اختيارية
2. **المستقبل**: عند تفعيل validation، يجب إدخال السيريال للمنتجات التي `is_serialized = true`
3. **Migration**: يجب تشغيل `migrations/add_serial_number_support.sql` في Supabase SQL Editor

## 🚀 الخطوات التالية:

1. تشغيل Migration في Supabase
2. إكمال تحديث باقي الصفحات (Warehouse, Cash, Quotations)
3. اختبار الميزة
4. عند الجاهزية: تفعيل validation
