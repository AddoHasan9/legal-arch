// ============================================================================
//  إعدادات الاتصال بـ Supabase
//  ✏️  عدّل القيمتين التاليتين من: Supabase Dashboard → Project Settings → API
// ============================================================================

window.APP_CONFIG = {
  // مثال: https://xxxxxxxxxxxx.supabase.co
  SUPABASE_URL: "https://oxowduanjbayqiydcptq.supabase.co",

  // مفتاح anon public (يبدأ بـ eyJ...) — آمن للاستخدام في الواجهة
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94b3dkdWFuamJheXFpeWRjcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MDQ3NzAsImV4cCI6MjEwMDE4MDc3MH0.nbvsleWXirEIxLqhAtJXOxp-AA2yI4-QZdN3Qyo3OJE",

  // اسم مكتب المحاماة (يظهر في الرأس)
  FIRM_NAME: "مكتب المحامي عبدالحسن الخزرجي",

  // اسم bucket التخزين (لا تغيّره إلا إذا غيّرته في schema.sql)
  STORAGE_BUCKET: "archiev",
};
