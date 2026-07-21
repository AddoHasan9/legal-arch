// ============================================================================
//  المصادقة: تسجيل الدخول/الخروج، الجلسة، إعادة تعيين كلمة المرور
// ============================================================================

const Auth = {
  // تحميل الملف الشخصي للمستخدم الحالي
  async loadProfile() {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", State.session.user.id)
      .single();
    if (error) throw error;
    State.profile = data;
    return data;
  },

  // تسجيل الدخول
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    State.session = data.session;
    await Auth.loadProfile();

    if (!State.profile.is_active) {
      await sb.auth.signOut();
      State.session = null;
      State.profile = null;
      throw new Error("الحساب معطّل. راجع مدير النظام.");
    }
    await DB.log("login", "user", "تسجيل دخول");
    return State.profile;
  },

  // تسجيل الخروج
  async logout() {
    await sb.auth.signOut();
    State.session = null;
    State.profile = null;
  },

  // إرسال رابط إعادة تعيين كلمة المرور
  async requestReset(email) {
    const redirectTo = window.location.origin + window.location.pathname + "#reset";
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  // تعيين كلمة مرور جديدة (بعد فتح الرابط)
  async updatePassword(newPassword) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  // استعادة الجلسة عند فتح التطبيق
  async restore() {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      State.session = data.session;
      try {
        await Auth.loadProfile();
        if (!State.profile.is_active) {
          await Auth.logout();
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },
};
