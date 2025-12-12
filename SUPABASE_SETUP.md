# إعداد Supabase - خطوات الحل

## المشكلة
الاتصال بقاعدة البيانات Supabase قد انقطع بسبب عدم وجود متغيرات البيئة.

## الحل

### 1. إنشاء ملف `.env.local`

قم بإنشاء ملف جديد باسم `.env.local` في المجلد الرئيسي للمشروع (`/Users/iquik/Desktop/myshop/`)

### 2. الحصول على بيانات Supabase

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اختر مشروعك
3. اذهب إلى **Settings** → **API**
4. انسخ القيم التالية:
   - **Project URL** (مثل: `https://xxxxx.supabase.co`)
   - **anon/public key** (مفتاح طويل)

### 3. إضافة البيانات إلى `.env.local`

افتح ملف `.env.local` وأضف:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**مثال:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. إعادة تشغيل الخادم

بعد إضافة الملف، يجب إعادة تشغيل خادم التطوير:

```bash
# أوقف الخادم الحالي (Ctrl+C)
# ثم شغله مرة أخرى:
npm run dev
```

### 5. التحقق من الاتصال

افتح المتصفح وافتح Developer Console (F12)، ثم:
1. اذهب إلى صفحة المنتجات
2. تحقق من الـ console logs
3. يجب أن ترى رسائل مثل: `[API] Products loaded from Supabase: X in Yms`

## ملاحظات مهمة

- ⚠️ **لا تشارك ملف `.env.local`** - يجب أن يكون في `.gitignore` (وهو موجود بالفعل)
- ✅ ملف `.env.local` موجود في `.gitignore` ولن يتم رفعه إلى Git
- 🔄 بعد أي تغيير في `.env.local`، يجب إعادة تشغيل الخادم

## استكشاف الأخطاء

### خطأ: "Missing Supabase environment variables"
- تأكد من وجود ملف `.env.local` في المجلد الرئيسي
- تأكد من أن المتغيرات تبدأ بـ `NEXT_PUBLIC_`
- أعد تشغيل الخادم بعد إضافة الملف

### خطأ: "Failed to fetch" أو "Network error"
- تحقق من أن `NEXT_PUBLIC_SUPABASE_URL` صحيح
- تحقق من أن `NEXT_PUBLIC_SUPABASE_ANON_KEY` صحيح
- تأكد من أن مشروع Supabase نشط

### خطأ: "Invalid API key"
- تحقق من أنك استخدمت **anon/public key** وليس **service_role key**
- تأكد من نسخ المفتاح بالكامل بدون مسافات إضافية

