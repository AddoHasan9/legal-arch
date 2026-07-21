# LexDesk Archive — نظام أرشفة وثائق الشركات

موقع متكامل لأرشفة وتنظيم وثائق الشركات لمكتب محاماة.
**Vanilla JS + Supabase**، جاهز للنشر على **Vercel**.

---

## 📁 هيكل المشروع

```
lexdesk-archive/
├── index.html              # نقطة الدخول
├── css/style.css           # كل التصميم (RTL)
├── js/
│   ├── config.js           # ✏️ إعدادات Supabase (تُعدّلها أنت)
│   ├── supabase.js         # تهيئة العميل + الحالة
│   ├── icons.js            # أيقونات SVG
│   ├── ui.js               # إشعارات/نوافذ/تنسيق
│   ├── auth.js             # المصادقة
│   ├── db.js               # طبقة البيانات
│   ├── admin.js            # لوحة الأدمِن
│   └── main.js             # التوجيه والصفحات
├── database/schema.sql     # سكيمة قاعدة البيانات (شغّلها مرة واحدة)
├── supabase/functions/admin-users/index.ts   # دالة إدارة المستخدمين
├── vercel.json             # إعدادات Vercel + رؤوس الأمان
└── README.md
```

---

## 🚀 خطوات التشغيل (بالترتيب)

### 1) أنشئ مشروع Supabase
- ادخل [supabase.com](https://supabase.com) → **New project**.
- من **Project Settings → API** انسخ: `Project URL` و `anon public key`.

### 2) شغّل السكيمة
- افتح **SQL Editor → New query**.
- الصق كامل محتوى `database/schema.sql` ثم **Run**.
- هذا ينشئ الجداول + الأمان (RLS) + bucket التخزين `archiev` + الـ Realtime.

### 3) عدّل الإعدادات
افتح `js/config.js` وضع قيمك:
```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",
FIRM_NAME: "اسم مكتبك",
```

### 4) أنشئ أول حساب أدمِن
- في Supabase → **Authentication → Users → Add user** (فعّل *Auto Confirm*).
- ثم في **SQL Editor** نفّذ (بدّل الإيميل):
```sql
update public.profiles set role = 'admin', full_name = 'اسم المدير'
where email = 'admin@firm.iq';
```
- الآن يمكنك تسجيل الدخول كأدمِن.

### 5) (اختياري لكن مهم) فعّل إضافة المستخدمين من داخل الموقع
زر «مستخدم جديد» في لوحة التحكم يستدعي دالة `admin-users`. لتفعيلها:
```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy admin-users
```
> `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` تكون متوفّرة تلقائياً للدوال.
> إن أردت، أضف `SUPABASE_ANON_KEY` عبر: `supabase secrets set SUPABASE_ANON_KEY=eyJ...`

**بديل بدون الدالة:** أنشئ المستخدمين يدوياً من Supabase → Authentication → Add user، وحدّد أدوارهم من جدول `profiles`.

### 6) انشر على Vercel
- ارفع المجلد على GitHub، ثم في Vercel **Import** المستودع.
- Framework Preset = **Other**، بدون أمر build.
- بعد النشر، أضف رابط موقعك في Supabase → **Authentication → URL Configuration → Redirect URLs**
  (مثال: `https://your-app.vercel.app/**`) — ضروري لعمل رابط إعادة تعيين كلمة المرور.

---

## 👥 الأدوار

| | مدير (admin) | محامٍ (lawyer) |
|---|---|---|
| عرض/تنزيل الوثائق | ✅ | ✅ |
| رفع وثائق | ✅ | ✅ |
| حذف وثائقه هو | ✅ | ✅ |
| حذف أي وثيقة | ✅ | ❌ |
| إضافة/تعديل/حذف الشركات | ✅ | ❌ |
| إدارة المستخدمين | ✅ | ❌ |
| سجل العمليات | ✅ | (عرض) |

الأمان مفروض على مستوى قاعدة البيانات عبر **RLS**، لا يعتمد على الواجهة فقط.

---

## ✨ الميزات

- شركات برقم تسلسلي تلقائي + عدّاد وثائق يتحدّث تلقائياً.
- رفع بالسحب والإفلات (PDF/Word/Excel/صور) مع بصمة SHA-256.
- معاينة مباشرة للصور و PDF، وتنزيل موقّت آمن.
- بحث شامل + تصفية حسب التصنيف والنوع.
- ظهور الوثائق **فوراً عند الجميع** عبر Realtime + إشعارات.
- تصدير الشركات إلى **Excel** ونسخة احتياطية كاملة (JSON).
- سجل تدقيق (Audit Log) لكل العمليات.
- إعادة تعيين كلمة المرور بالبريد.
- تصميم RTL متجاوب بالكامل (جوال/لوحي/سطح مكتب).

---

## 🗄️ النسخ الاحتياطية اليومية
- Supabase يوفّر نسخاً احتياطية آلية للقاعدة (حسب الخطة) من **Database → Backups**.
- إضافةً لذلك، زر «نسخة احتياطية» في لوحة التحكم ينزّل نسخة JSON كاملة يدوياً.

---

## 🔧 التشغيل محلياً
أي خادم ملفات ثابت يكفي:
```bash
python3 -m http.server 5173
# افتح http://localhost:5173
```
> أضف `http://localhost:5173/**` في Redirect URLs بـ Supabase أثناء التطوير.
