# دليل اختبار الكاميرا على الموبايل

## المشكلة
الكاميرا في المتصفحات تتطلب **HTTPS** للعمل. عند استخدام HTTP العادي أو IP داخلي مع HTTPS، لن تعمل الكاميرا.

## الحلول المتاحة

### الحل 1: استخدام ngrok (الأسهل والأسرع) ⭐

**ngrok** ينشئ نفق HTTPS مجاني يربط localhost بالإنترنت.

#### خطوات التثبيت:

1. **سجل حساب مجاني على ngrok:**
   - اذهب إلى: https://ngrok.com/signup
   - سجل حساب مجاني

2. **حمّل ngrok:**
   - للـ Mac: `brew install ngrok/ngrok/ngrok`
   - أو حمّل من: https://ngrok.com/download

3. **أضف الـ authtoken:**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
   (ستجد الـ token في dashboard ngrok بعد التسجيل)

4. **شغّل Next.js:**
   ```bash
   npm run dev
   ```

5. **في terminal جديد، شغّل ngrok:**
   ```bash
   ngrok http 3000
   ```

6. **ستحصل على رابط HTTPS مثل:**
   ```
   https://abc123.ngrok-free.app
   ```

7. **افتح هذا الرابط على الموبايل** - الكاميرا ستعمل! ✅

---

### الحل 2: استخدام localtunnel (بدون تسجيل)

**localtunnel** لا يحتاج تسجيل، لكن قد يكون أبطأ قليلاً.

#### خطوات التثبيت:

1. **ثبّت localtunnel:**
   ```bash
   npm install -g localtunnel
   ```

2. **شغّل Next.js:**
   ```bash
   npm run dev
   ```

3. **في terminal جديد:**
   ```bash
   lt --port 3000
   ```

4. **ستحصل على رابط HTTPS** - استخدمه على الموبايل

---

### الحل 3: استخدام Cloudflare Tunnel (مجاني)

**Cloudflare Tunnel** يوفر نفق آمن ومجاني.

#### خطوات:

1. **ثبّت cloudflared:**
   ```bash
   brew install cloudflared  # للـ Mac
   ```

2. **شغّل النفق:**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. **ستحصل على رابط HTTPS** - استخدمه على الموبايل

---

### الحل 4: إنشاء شهادة SSL محلية (معقد)

يمكنك إنشاء شهادة SSL محلية باستخدام `mkcert`:

```bash
# تثبيت mkcert
brew install mkcert  # للـ Mac

# إنشاء شهادة محلية
mkcert -install
mkcert localhost 127.0.0.1 ::1

# تشغيل Next.js مع HTTPS
# (يحتاج إعدادات إضافية في next.config)
```

---

### الحل 5: نشر على Vercel (للاختبار السريع)

**Vercel** يوفر نشر مجاني لـ Next.js مع HTTPS تلقائي:

1. **سجل على Vercel:** https://vercel.com
2. **اربط المشروع:**
   ```bash
   npm i -g vercel
   vercel
   ```
3. **سيتم النشر تلقائياً مع HTTPS** ✅

---

## التوصية

**للاختبار السريع:** استخدم **ngrok** (الحل 1) - سريع وسهل ومجاني.

**للاختبار المستمر:** انشر على **Vercel** (الحل 5) - مجاني وسهل.

---

## ملاحظات مهمة

⚠️ **HTTPS مطلوب:** الكاميرا لن تعمل بدون HTTPS في المتصفحات الحديثة.

⚠️ **الصلاحيات:** تأكد من منح صلاحيات الكاميرا في إعدادات المتصفح على الموبايل.

⚠️ **الشبكة:** الموبايل والكمبيوتر يجب أن يكونا على نفس الشبكة (للـ IP الداخلي) أو استخدام ngrok/خدمات النفق.
