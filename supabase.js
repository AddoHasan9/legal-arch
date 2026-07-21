// ============================================================================
//  تهيئة عميل Supabase + الحالة المشتركة للتطبيق
// ============================================================================

const { createClient } = window.supabase;

const sb = createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,     // "تذكّرني" — الجلسة تبقى بعد إغلاق المتصفح
      autoRefreshToken: true,
      detectSessionInUrl: true, // ضروري لرابط إعادة تعيين كلمة المرور
    },
  }
);

// الحالة المشتركة بين كل الوحدات
const State = {
  session: null,
  profile: null,           // { id, full_name, role, is_active, email }
  companies: [],
  documents: [],
  isAdmin() {
    return State.profile?.role === "admin";
  },
};

// اسم الـ bucket للاختصار
const BUCKET = window.APP_CONFIG.STORAGE_BUCKET;
