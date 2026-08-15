-- ============================================================================
--  ترقية v3 — رقم الإضبارة (الهيئة العامة للضرائب + مسجل الشركات)
--  آمنة تماماً: تضيف عمودين جديدين فقط، لا تحذف ولا تعدّل أي بيانات موجودة.
--  شغّلها مرة واحدة في: Supabase → SQL Editor → New query → Run
-- ============================================================================

alter table public.companies
  add column if not exists tax_file_no       text,   -- رقم الإضبارة في الهيئة العامة للضرائب
  add column if not exists registrar_file_no text;   -- رقم الإضبارة في مسجل الشركات

comment on column public.companies.tax_file_no       is 'رقم الإضبارة في الهيئة العامة للضرائب';
comment on column public.companies.registrar_file_no is 'رقم الإضبارة في مسجل الشركات';

-- تم. لا حاجة لأي تغيير على سياسات RLS (العمودان يتبعان نفس صلاحيات الجدول).
