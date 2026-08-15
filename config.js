// ============================================================================
//  إعدادات الاتصال بـ Supabase
//  ✏️  عدّل القيمتين التاليتين من: Supabase Dashboard → Project Settings → API
// ============================================================================

window.APP_CONFIG = {
  // مثال: https://xxxxxxxxxxxx.supabase.co
  SUPABASE_URL: "https://endhawgxkwonabkdyfia.supabase.co",

  // مفتاح anon public (يبدأ بـ eyJ...) — آمن للاستخدام في الواجهة
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuZGhhd2d4a3dvbmFia2R5ZmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzM4NzEsImV4cCI6MjEwMjM0OTg3MX0.zzW0oWEn2j2827enL0kUPKuq4ljCKrIV9lqsgHTBcrE
    اسم مكتب المحاماة (يظهر في الرأس)
  FIRM_NAME: "مكتب المحامي عبدالحسن الخزرجي",

  // اسم bucket التخزين (لا تغيّره إلا إذا غيّرته في schema.sql)
  STORAGE_BUCKET: "archiev",
};
