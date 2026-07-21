// ============================================================================
//  طبقة البيانات: الشركات، الوثائق، السجل، المستخدمون، التصدير، Realtime
// ============================================================================

const DB = {
  // ---------------------------------------------------------------- السجل
  async log(action, target, details) {
    try {
      await sb.from("activity_log").insert({
        user_id: State.profile?.id,
        user_name: State.profile?.full_name,
        action, target_entity: target, details,
      });
    } catch (_) { /* لا نُفشل العملية بسبب السجل */ }
  },

  async getActivity(limit = 60) {
    const { data, error } = await sb
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // ------------------------------------------------------------- الشركات
  async loadCompanies() {
    const { data, error } = await sb
      .from("companies")
      .select("*")
      .order("company_number", { ascending: true });
    if (error) throw error;
    State.companies = data;
    return data;
  },

  async addCompany(name) {
    const { data, error } = await sb
      .from("companies")
      .insert({ company_name: name, created_by: State.profile.id })
      .select().single();
    if (error) throw error;
    await DB.log("create", "company", `إضافة شركة: ${name}`);
    return data;
  },

  async renameCompany(id, name) {
    const { error } = await sb.from("companies").update({ company_name: name }).eq("id", id);
    if (error) throw error;
    await DB.log("edit", "company", `تعديل اسم شركة إلى: ${name}`);
  },

  async deleteCompany(id, name) {
    // نحذف ملفات التخزين المرتبطة أولاً
    const { data: docs } = await sb.from("documents").select("storage_path").eq("company_id", id);
    if (docs?.length) {
      await sb.storage.from(BUCKET).remove(docs.map((d) => d.storage_path));
    }
    const { error } = await sb.from("companies").delete().eq("id", id);
    if (error) throw error;
    await DB.log("delete", "company", `حذف شركة: ${name}`);
  },

  // ------------------------------------------------------------- الوثائق
  async loadDocuments() {
    const { data, error } = await sb
      .from("documents")
      .select("*, uploader:uploaded_by(full_name)")
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    State.documents = data;
    return data;
  },

  docsOf(companyId) {
    return State.documents.filter((d) => d.company_id === companyId);
  },

  async uploadDocument(companyId, file, category) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const safe = `${companyId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // 1) رفع للتخزين
    const { error: upErr } = await sb.storage.from(BUCKET).upload(safe, file, {
      cacheControl: "3600", upsert: false,
    });
    if (upErr) throw upErr;

    // 2) حساب بصمة الملف (SHA-256)
    let hash = null;
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {}

    // 3) صف في جدول الوثائق
    const { data, error } = await sb.from("documents").insert({
      company_id: companyId,
      file_name: file.name,
      file_type: UI.fileType(file.name),
      storage_path: safe,
      file_size: file.size,
      category,
      file_hash: hash,
      uploaded_by: State.profile.id,
    }).select("*, uploader:uploaded_by(full_name)").single();

    if (error) {
      await sb.storage.from(BUCKET).remove([safe]); // تراجع عند الفشل
      throw error;
    }
    await DB.log("upload", "document", `رفع وثيقة: ${file.name}`);
    return data;
  },

  async deleteDocument(doc) {
    const { error } = await sb.from("documents").delete().eq("id", doc.id);
    if (error) throw error;
    await sb.storage.from(BUCKET).remove([doc.storage_path]);
    await DB.log("delete", "document", `حذف وثيقة: ${doc.file_name}`);
  },

  // رابط تنزيل/معاينة موقّت (صالح ساعة)
  async signedUrl(path, download = false) {
    const opts = download ? { download: true } : {};
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, opts);
    if (error) throw error;
    return data.signedUrl;
  },

  // ---------------------------------------------------------- المستخدمون
  async loadUsers() {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },

  // استدعاء Edge Function الآمنة لإدارة المستخدمين (أدمِن فقط)
  async adminUsers(action, payload) {
    const { data, error } = await sb.functions.invoke("admin-users", {
      body: { action, ...payload },
    });
    if (error) {
      // محاولة قراءة رسالة الخطأ من الدالة
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async createLawyer(email, password, fullName, role) {
    const res = await DB.adminUsers("create", { email, password, full_name: fullName, role });
    await DB.log("create", "user", `إضافة مستخدم: ${email}`);
    return res;
  },

  async setUserActive(userId, isActive) {
    const { error } = await sb.from("profiles").update({ is_active: isActive }).eq("id", userId);
    if (error) throw error;
    await DB.log("edit", "user", `${isActive ? "تفعيل" : "تعطيل"} حساب`);
  },

  async setUserRole(userId, role) {
    const { error } = await sb.from("profiles").update({ role }).eq("id", userId);
    if (error) throw error;
    await DB.log("edit", "user", `تغيير دور مستخدم إلى: ${role}`);
  },

  async updateUserProfile(userId, fullName) {
    const { error } = await sb.from("profiles").update({ full_name: fullName }).eq("id", userId);
    if (error) throw error;
    await DB.log("edit", "user", `تعديل بيانات مستخدم`);
  },

  // ------------------------------------------------------------- التصدير
  exportCompaniesExcel() {
    const rows = State.companies.map((c) => ({
      "الرقم": c.company_number,
      "اسم الشركة": c.company_name,
      "عدد الوثائق": c.doc_count,
      "تاريخ الإضافة": UI.date(c.created_at),
      "آخر تحديث": UI.date(c.updated_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الشركات");
    XLSX.writeFile(wb, `الشركات_${new Date().toISOString().slice(0, 10)}.xlsx`);
    DB.log("export", "company", "تصدير بيانات الشركات");
  },

  // نسخة احتياطية كاملة (JSON) — تُشغّل يدوياً أو مجدولة
  async exportBackup() {
    const [{ data: companies }, { data: documents }, { data: users }, activity] = await Promise.all([
      sb.from("companies").select("*"),
      sb.from("documents").select("*"),
      sb.from("profiles").select("id, email, full_name, role, is_active, created_at"),
      DB.getActivity(1000),
    ]);
    const backup = { generated_at: new Date().toISOString(), companies, documents, users, activity };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    DB.log("export", "system", "نسخة احتياطية كاملة");
  },

  // -------------------------------------------------------------- Realtime
  subscribeRealtime(onChange) {
    return sb.channel("archive-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, (p) => onChange("documents", p))
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, (p) => onChange("companies", p))
      .subscribe();
  },
};
