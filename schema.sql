-- ============================================================================
--  LexDesk Archive — Database Schema (Supabase / PostgreSQL)
--  نظام أرشفة وثائق الشركات لمكتب المحاماة
--  شغّل هذا الملف كاملاً في: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) الامتدادات
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1) جدول الملفات الشخصية (profiles) — مرتبط بمستخدمي المصادقة
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text        not null default 'مستخدم جديد',
  role        text        not null default 'lawyer' check (role in ('admin', 'lawyer')),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'ملفات المستخدمين: الدور (admin/lawyer) وحالة التفعيل';

-- ============================================================================
-- 2) جدول الشركات (companies)
-- ============================================================================
create table if not exists public.companies (
  id             uuid        primary key default gen_random_uuid(),
  company_number bigint      generated always as identity,   -- رقم تسلسلي فريد
  company_name   text        not null,
  doc_count      integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid        references public.profiles (id) on delete set null
);

comment on table public.companies is 'الشركات — رقم تسلسلي تلقائي وعدّاد وثائق';

-- ============================================================================
-- 3) جدول الوثائق (documents)
-- ============================================================================
create table if not exists public.documents (
  id            uuid        primary key default gen_random_uuid(),
  company_id    uuid        not null references public.companies (id) on delete cascade,
  file_name     text        not null,
  file_type     text,                       -- pdf | word | excel | image | other
  storage_path  text        not null,       -- المسار داخل bucket = archiev
  file_size     bigint      not null default 0,
  category      text        not null default 'أخرى',  -- عقود | ترخيص | فواتير | ...
  file_hash     text,
  uploaded_by   uuid        references public.profiles (id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

comment on table public.documents is 'الوثائق المرتبطة بالشركات';

create index if not exists idx_documents_company on public.documents (company_id);
create index if not exists idx_documents_uploaded_at on public.documents (uploaded_at desc);

-- ============================================================================
-- 4) سجل العمليات (activity_log)
-- ============================================================================
create table if not exists public.activity_log (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references public.profiles (id) on delete set null,
  user_name     text,
  action        text        not null,   -- upload | delete | edit | login | create | ...
  target_entity text,                   -- company | document | user
  details       text,
  created_at    timestamptz not null default now()
);

comment on table public.activity_log is 'سجل تدقيق لكل العمليات المهمة';

create index if not exists idx_activity_created_at on public.activity_log (created_at desc);

-- ============================================================================
-- 5) الدوال المساعدة (Helper functions)
-- ============================================================================

-- هل المستخدم الحالي أدمِن؟ (SECURITY DEFINER لتجنّب التكرار في RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- إنشاء ملف شخصي تلقائياً عند تسجيل مستخدم جديد
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'lawyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- تحديث updated_at للشركة
create or replace function public.touch_company_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_company_updated on public.companies;
create trigger trg_company_updated
  before update on public.companies
  for each row execute function public.touch_company_updated_at();

-- تحديث عدّاد الوثائق + updated_at للشركة عند الرفع/الحذف
create or replace function public.sync_company_doc_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.companies
      set doc_count = doc_count + 1, updated_at = now()
      where id = new.company_id;
  elsif (tg_op = 'DELETE') then
    update public.companies
      set doc_count = greatest(doc_count - 1, 0), updated_at = now()
      where id = old.company_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_doc_count on public.documents;
create trigger trg_doc_count
  after insert or delete on public.documents
  for each row execute function public.sync_company_doc_count();

-- ============================================================================
-- 6) تفعيل RLS على كل الجداول
-- ============================================================================
alter table public.profiles     enable row level security;
alter table public.companies    enable row level security;
alter table public.documents    enable row level security;
alter table public.activity_log enable row level security;

-- -------- profiles --------
drop policy if exists "profiles_read_all"       on public.profiles;
drop policy if exists "profiles_update_self"    on public.profiles;
drop policy if exists "profiles_admin_all"      on public.profiles;

-- الجميع (المسجّلون) يشوفون كل الملفات الشخصية
create policy "profiles_read_all" on public.profiles
  for select to authenticated using (true);

-- المستخدم يعدّل اسمه فقط (بدون تغيير الدور)
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- الأدمن يتحكم بالكامل (تعديل الأدوار / التفعيل)
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------- companies --------
drop policy if exists "companies_read_all"  on public.companies;
drop policy if exists "companies_admin_write" on public.companies;

create policy "companies_read_all" on public.companies
  for select to authenticated using (true);

create policy "companies_admin_write" on public.companies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -------- documents --------
drop policy if exists "documents_read_all"      on public.documents;
drop policy if exists "documents_insert_active" on public.documents;
drop policy if exists "documents_delete_owner_or_admin" on public.documents;

-- الجميع يشوفون كل الوثائق
create policy "documents_read_all" on public.documents
  for select to authenticated using (true);

-- أي مستخدم مفعّل يرفع وثيقة (تُسجّل باسمه)
create policy "documents_insert_active" on public.documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and is_active = true)
  );

-- الحذف: صاحب الوثيقة أو الأدمن
create policy "documents_delete_owner_or_admin" on public.documents
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- -------- activity_log --------
drop policy if exists "activity_read_all"    on public.activity_log;
drop policy if exists "activity_insert_self" on public.activity_log;

-- الجميع يشوفون السجل (يُعرض في لوحة الأدمن)
create policy "activity_read_all" on public.activity_log
  for select to authenticated using (true);

create policy "activity_insert_self" on public.activity_log
  for insert to authenticated
  with check (user_id = auth.uid());

-- ============================================================================
-- 7) تخزين الملفات (Storage) — bucket باسم archiev
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('archiev', 'archiev', false)
on conflict (id) do nothing;

drop policy if exists "archiev_read"   on storage.objects;
drop policy if exists "archiev_insert" on storage.objects;
drop policy if exists "archiev_delete" on storage.objects;

-- قراءة/تنزيل: كل المسجّلين
create policy "archiev_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'archiev');

-- رفع: كل المسجّلين المفعّلين
create policy "archiev_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archiev'
    and exists (select 1 from public.profiles where id = auth.uid() and is_active = true)
  );

-- حذف من التخزين: المسجّلون (التحكم الفعلي بالحذف يتم عبر جدول documents)
create policy "archiev_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'archiev');

-- ============================================================================
-- 8) تفعيل الـ Realtime (لظهور الوثائق فوراً عند الجميع)
-- ============================================================================
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.companies;

-- ============================================================================
-- تم. الخطوة الأخيرة: أنشئ أول مستخدم أدمِن (اقرأ README.md — القسم 4)
-- ============================================================================
