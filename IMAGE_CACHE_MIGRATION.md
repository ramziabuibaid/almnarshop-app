# نقل بيانات Image Cache من Google Sheets إلى Supabase

## الخطوات:

### 1. إنشاء جدول `image_cache` في Supabase

قم بتشغيل الاستعلام التالي في Supabase SQL Editor:

```sql
-- إنشاء جدول image_cache
CREATE TABLE IF NOT EXISTS image_cache (
  file_name TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء indexes
CREATE INDEX IF NOT EXISTS idx_image_cache_file_name ON image_cache(file_name);
CREATE INDEX IF NOT EXISTS idx_image_cache_file_id ON image_cache(file_id);

-- إنشاء trigger لتحديث updated_at
CREATE TRIGGER update_image_cache_updated_at BEFORE UPDATE ON image_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. نقل البيانات من Google Sheets

لديك خياران:

#### الخيار 1: استخدام Google Apps Script (موصى به)

1. افتح Google Apps Script الخاص بك
2. أضف دالة جديدة:

```javascript
function migrateImageCacheToSupabase() {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName('System_Image_Cache');
  
  if (!sheet) {
    Logger.log('System_Image_Cache sheet not found');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const supabaseUrl = 'YOUR_SUPABASE_URL';
  const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const fileName = data[i][0];
    const fileId = data[i][1];
    
    if (fileName && fileId) {
      const payload = {
        file_name: fileName,
        file_id: fileId
      };
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        payload: JSON.stringify(payload)
      };
      
      try {
        const response = UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/image_cache`, options);
        Logger.log(`Inserted: ${fileName} -> ${fileId}`);
      } catch (e) {
        Logger.log(`Error inserting ${fileName}: ${e.toString()}`);
      }
    }
  }
  
  Logger.log('Migration completed');
}
```

3. استبدل `YOUR_SPREADSHEET_ID`, `YOUR_SUPABASE_URL`, و `YOUR_SUPABASE_ANON_KEY` بالقيم الصحيحة
4. شغّل الدالة

#### الخيار 2: تصدير يدوي واستيراد CSV

1. من Google Sheets، صدّر `System_Image_Cache` كـ CSV
2. في Supabase Dashboard:
   - اذهب إلى Table Editor
   - افتح جدول `image_cache`
   - اضغط على "Insert" → "Import data from CSV"
   - ارفع الملف

### 3. التحقق من البيانات

بعد النقل، تحقق من البيانات:

```sql
SELECT COUNT(*) FROM image_cache;
SELECT * FROM image_cache LIMIT 10;
```

### 4. تحديث الكاش عند إضافة صور جديدة

عند إضافة صورة جديدة في Google Apps Script، تأكد من إضافتها إلى Supabase أيضاً:

```javascript
// في دالة saveImageToDrive، بعد حفظ الصورة:
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const payload = {
  file_name: newFileName,
  file_id: fileId
};

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  },
  payload: JSON.stringify(payload)
};

UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/image_cache`, options);
```

## ملاحظات:

- جدول `image_cache` يتم تحميله في الذاكرة عند أول استخدام (cached)
- إذا أضفت صوراً جديدة، قد تحتاج إلى إعادة تحميل الصفحة لرؤيتها
- يمكنك إضافة دالة لتحديث الكاش يدوياً إذا لزم الأمر

