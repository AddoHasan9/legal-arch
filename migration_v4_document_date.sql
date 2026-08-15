-- ============================================================================
--  ترقية v4 — تاريخ الرفع اليدوي للوثيقة (document_date)
--  آمنة تماماً: تضيف عموداً جديداً فقط، لا تحذف ولا تعدّل أي بيانات موجودة.
--  ملاحظة: هذا العمود منفصل عن expiry_date (تاريخ الانتهاء) — الاثنان يبقيان
--  متاحين، وتاريخ الانتهاء صار يُدار من نافذة "تعديل الوثيقة" بعد الرفع.
--  شغّلها مرة واحدة في: Supabase → SQL Editor → New query → Run
-- ============================================================================

alter table public.documents
  add column if not exists document_date date;   -- تاريخ الوثيقة/الرفع (قابل للتعديل يدوياً)

comment on column public.documents.document_date is 'تاريخ الوثيقة كما يسجّله المستخدم (قد يختلف عن وقت الرفع الفعلي بالنظام)';

create index if not exists idx_documents_document_date
  on public.documents (document_date)
  where document_date is not null;

-- تم. لا حاجة لأي تغيير على سياسات RLS.
