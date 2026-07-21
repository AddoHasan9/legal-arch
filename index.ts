// ============================================================================
//  Edge Function: admin-users
//  إنشاء/إدارة المستخدمين بأمان (يتطلب service_role) — للأدمِن فقط
//  النشر:  supabase functions deploy admin-users
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) التحقق من هوية الطالب
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await asUser.auth.getUser();
    if (uErr || !user) return json({ error: "غير مصرّح" }, 401);

    // 2) التأكد أنه أدمِن مفعّل
    const admin = createClient(url, service);
    const { data: prof } = await admin.from("profiles").select("role, is_active").eq("id", user.id).single();
    if (!prof || prof.role !== "admin" || !prof.is_active) {
      return json({ error: "هذه العملية للمدير فقط" }, 403);
    }

    const body = await req.json();
    const action = body.action;

    // 3) تنفيذ العملية
    if (action === "create") {
      const { email, password, full_name, role } = body;
      if (!email || !password) return json({ error: "البريد وكلمة المرور مطلوبان" }, 400);

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // بلا حاجة لتأكيد بريد
        user_metadata: { full_name, role: role === "admin" ? "admin" : "lawyer" },
      });
      if (error) return json({ error: error.message }, 400);

      // ضمان الدور في جدول profiles (المُشغّل ينشئه، ونحدّثه احتياطاً)
      await admin.from("profiles").update({
        full_name, role: role === "admin" ? "admin" : "lawyer",
      }).eq("id", data.user.id);

      return json({ ok: true, user_id: data.user.id });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (user_id === user.id) return json({ error: "لا يمكنك حذف حسابك" }, 400);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "set_password") {
      const { user_id, password } = body;
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "عملية غير معروفة" }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
