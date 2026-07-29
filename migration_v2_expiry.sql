-- ============================================================================
--  ترقية v2 — تاريخ انتهاء الوثائق (رخص/عقود)
--  آمنة تماماً: تضيف عموداً جديداً فقط، لا تحذف ولا تعدّل أي بيانات موجودة.
--  شغّلها مرة واحدة في: Supabase → SQL Editor → New query → Run
-- ============================================================================

alter table public.documents
  add column if not exists expiry_date date;

-- فهرس لتسريع استعلامات "قرب تنتهي"
create index if not exists idx_documents_expiry
  on public.documents (expiry_date)
  where expiry_date is not null;

-- تم. لا حاجة لأي تغيير على سياسات RLS (العمود يتبع نفس صلاحيات الجدول).
