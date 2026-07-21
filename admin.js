// ============================================================================
//  لوحة تحكم الأدمِن
// ============================================================================
let adminTab = "overview";
let adminUsers = [];
let adminActivity = [];

async function renderAdmin() {
  const v = document.getElementById("view");
  v.innerHTML = `
    <div class="page-head"><div>
      <h1 class="page-title">لوحة التحكم</h1>
      <p class="page-sub">إدارة الشركات والمستخدمين ومراقبة النشاط</p>
    </div>
    <div class="page-actions">
      <button class="btn btn--ghost" id="btn-backup">${iconBackup}<span>نسخة احتياطية</span></button>
    </div></div>

    <div class="tabs">
      <button class="tab" data-tab="overview">النظرة العامة</button>
      <button class="tab" data-tab="companies">الشركات</button>
      <button class="tab" data-tab="users">المستخدمون</button>
      <button class="tab" data-tab="log">سجل العمليات</button>
    </div>
    <div id="admin-body"></div>`;

  document.getElementById("btn-backup").onclick = async () => {
    UI.toast("جارٍ تجهيز النسخة الاحتياطية…", "info");
    try { await DB.exportBackup(); UI.toast("تم تنزيل النسخة الاحتياطية", "success"); }
    catch (ex) { UI.toast("فشل النسخ: " + ex.message, "error"); }
  };

  v.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("tab--active", t.dataset.tab === adminTab);
    t.onclick = () => { adminTab = t.dataset.tab; renderAdmin(); };
  });

  // تحميل بيانات التبويب النشط
  try {
    if (adminTab === "users") adminUsers = await DB.loadUsers();
    if (adminTab === "log" || adminTab === "overview") adminActivity = await DB.getActivity(80);
  } catch (ex) { UI.toast("تعذّر تحميل البيانات: " + ex.message, "error"); }

  const body = document.getElementById("admin-body");
  if (adminTab === "overview")  body.innerHTML = adminOverview();
  if (adminTab === "companies") { body.innerHTML = adminCompanies(); wireAdminCompanies(); }
  if (adminTab === "users")     { body.innerHTML = adminUsersView(); wireAdminUsers(); }
  if (adminTab === "log")       body.innerHTML = adminLog();
}

// ---------------------------------------------------------------- النظرة العامة
function adminOverview() {
  const recentDocs = [...State.documents].slice(0, 6);
  // أنشط المستخدمين (حسب عدد الوثائق المرفوعة)
  const counts = {};
  State.documents.forEach((d) => {
    const n = d.uploader?.full_name || "—";
    counts[n] = (counts[n] || 0) + 1;
  });
  const topUsers = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `
    <div class="stats">
      ${statCard(iconBuilding, State.companies.length, "شركة")}
      ${statCard(iconDoc, State.documents.length, "وثيقة")}
      ${statCard(iconLayers, new Set(State.documents.map((d) => d.category)).size, "تصنيف مستخدم")}
      ${statCard(iconActivity, adminActivity.length, "عملية مسجّلة")}
    </div>

    <div class="two-col">
      <div class="card">
        <h3 class="card__title">أحدث الوثائق</h3>
        ${recentDocs.length ? `<ul class="mini-list">${recentDocs.map((d) => {
          const co = State.companies.find((c) => c.id === d.company_id);
          return `<li class="mini-list__item">
            <span class="mini-list__ic doc-card__icon--${d.file_type}">${UI.fileIcon(d.file_type)}</span>
            <span class="mini-list__main">
              <b>${UI.esc(d.file_name)}</b>
              <small>${UI.esc(co?.company_name || "—")} · ${UI.esc(d.uploader?.full_name || "—")}</small>
            </span>
            <small class="mini-list__time">${UI.date(d.uploaded_at)}</small>
          </li>`;
        }).join("")}</ul>` : `<p class="muted">لا وثائق بعد.</p>`}
      </div>

      <div class="card">
        <h3 class="card__title">أنشط المستخدمين</h3>
        ${topUsers.length ? `<ul class="mini-list">${topUsers.map(([n, c]) => `
          <li class="mini-list__item">
            <span class="me__avatar me__avatar--sm">${UI.esc(UI.initials(n))}</span>
            <span class="mini-list__main"><b>${UI.esc(n)}</b></span>
            <span class="chip chip--gold">${c} وثيقة</span>
          </li>`).join("")}</ul>` : `<p class="muted">لا نشاط بعد.</p>`}
      </div>
    </div>`;
}

function statCard(icon, value, label) {
  return `<div class="stat">
    <div class="stat__icon">${icon}</div>
    <div class="stat__num">${value}</div>
    <div class="stat__label">${label}</div>
  </div>`;
}

// ---------------------------------------------------------------- الشركات
function adminCompanies() {
  if (!State.companies.length) return UI.empty(iconBuilding, "لا شركات", "أضف أول شركة.");
  return `
    <div class="table-head-actions">
      <button class="btn btn--primary" id="ac-add">${iconPlus}<span>شركة جديدة</span></button>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>الاسم</th><th>الوثائق</th><th>أُضيفت</th><th>آخر تحديث</th><th></th></tr></thead>
      <tbody>
        ${State.companies.map((c) => `<tr>
          <td class="mono">${c.company_number}</td>
          <td><a class="link" href="#company/${c.id}">${UI.esc(c.company_name)}</a></td>
          <td>${c.doc_count}</td>
          <td>${UI.date(c.created_at)}</td>
          <td>${UI.date(c.updated_at)}</td>
          <td class="row-actions">
            <button class="icon-btn" data-edit="${c.id}" title="تعديل">${iconEdit}</button>
            <button class="icon-btn icon-btn--danger" data-del="${c.id}" title="حذف">${iconTrash}</button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
}

function wireAdminCompanies() {
  const b = document.getElementById("admin-body");
  document.getElementById("ac-add").onclick = addCompanyDialog;
  b.querySelectorAll("[data-edit]").forEach((el) => el.onclick = () => renameCompanyDialog(el.dataset.edit));
  b.querySelectorAll("[data-del]").forEach((el) => el.onclick = () => deleteCompanyDialog(el.dataset.del));
}

// ---------------------------------------------------------------- المستخدمون
function adminUsersView() {
  return `
    <div class="table-head-actions">
      <button class="btn btn--primary" id="au-add">${iconPlus}<span>مستخدم جديد</span></button>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>أُنشئ</th><th></th></tr></thead>
      <tbody>
        ${adminUsers.map((u) => `<tr>
          <td>
            <span class="me__avatar me__avatar--sm">${UI.esc(UI.initials(u.full_name))}</span>
            ${UI.esc(u.full_name)}
          </td>
          <td class="mono">${UI.esc(u.email || "—")}</td>
          <td>
            <select class="select select--sm" data-role="${u.id}" ${u.id === State.profile.id ? "disabled" : ""}>
              <option value="lawyer" ${u.role === "lawyer" ? "selected" : ""}>محامٍ</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>مدير</option>
            </select>
          </td>
          <td>${u.is_active
            ? `<span class="badge badge--ok">مفعّل</span>`
            : `<span class="badge badge--off">معطّل</span>`}</td>
          <td>${UI.date(u.created_at)}</td>
          <td class="row-actions">
            ${u.id === State.profile.id ? `<span class="muted">— أنت —</span>` : `
              <button class="btn btn--xs ${u.is_active ? "btn--ghost" : "btn--primary"}" data-toggle="${u.id}" data-active="${u.is_active}">
                ${u.is_active ? "تعطيل" : "تفعيل"}
              </button>`}
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>
    <p class="note">${iconShield} إضافة المستخدمين تتطلب تفعيل دالة <span class="mono">admin-users</span> (راجع README).</p>`;
}

function wireAdminUsers() {
  const b = document.getElementById("admin-body");
  document.getElementById("au-add").onclick = addUserDialog;

  b.querySelectorAll("[data-toggle]").forEach((el) => el.onclick = async () => {
    const isActive = el.dataset.active === "true";
    try {
      await DB.setUserActive(el.dataset.toggle, !isActive);
      UI.toast(isActive ? "تم تعطيل الحساب" : "تم تفعيل الحساب", "success");
      adminUsers = await DB.loadUsers();
      renderAdmin();
    } catch (ex) { UI.toast("فشل: " + ex.message, "error"); }
  });

  b.querySelectorAll("[data-role]").forEach((sel) => sel.onchange = async () => {
    try {
      await DB.setUserRole(sel.dataset.role, sel.value);
      UI.toast("تم تغيير الدور", "success");
      adminUsers = await DB.loadUsers();
    } catch (ex) { UI.toast("فشل: " + ex.message, "error"); sel.value = sel.value === "admin" ? "lawyer" : "admin"; }
  });
}

function addUserDialog() {
  const m = UI.openModal(`
    <h3 class="modal__title">مستخدم جديد</h3>
    <form id="nu-form" class="form">
      <label class="field"><span>الاسم الكامل</span><input id="nu-name" required autofocus/></label>
      <label class="field"><span>البريد الإلكتروني</span><input id="nu-email" type="email" required/></label>
      <label class="field"><span>كلمة المرور المبدئية</span><input id="nu-pass" required minlength="6" placeholder="6 أحرف على الأقل"/></label>
      <label class="field"><span>الدور</span>
        <select id="nu-role" class="select"><option value="lawyer">محامٍ</option><option value="admin">مدير</option></select></label>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-close>إلغاء</button>
        <button type="submit" class="btn btn--primary" id="nu-submit">إنشاء الحساب</button>
      </div>
      <p class="form__error" id="nu-msg"></p>
    </form>`, "sm");

  m.querySelector("#nu-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = m.querySelector("#nu-submit");
    const msg = m.querySelector("#nu-msg");
    btn.disabled = true; btn.textContent = "جارٍ الإنشاء…";
    try {
      await DB.createLawyer(
        m.querySelector("#nu-email").value.trim(),
        m.querySelector("#nu-pass").value,
        m.querySelector("#nu-name").value.trim(),
        m.querySelector("#nu-role").value
      );
      UI.closeModal(m);
      UI.toast("تم إنشاء الحساب", "success");
      adminUsers = await DB.loadUsers();
      renderAdmin();
    } catch (ex) {
      msg.className = "form__error";
      msg.textContent = ex.message.includes("Function")
        ? "دالة admin-users غير مفعّلة. راجع README لتفعيلها، أو أنشئ المستخدم من لوحة Supabase."
        : ex.message;
      btn.disabled = false; btn.textContent = "إنشاء الحساب";
    }
  };
}

// ---------------------------------------------------------------- السجل
function adminLog() {
  if (!adminActivity.length) return UI.empty(iconActivity, "لا عمليات مسجّلة", "");
  const actionAr = { upload: "رفع", delete: "حذف", edit: "تعديل", create: "إضافة", login: "دخول", export: "تصدير" };
  return `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>المستخدم</th><th>العملية</th><th>التفاصيل</th><th>الوقت</th></tr></thead>
      <tbody>
        ${adminActivity.map((a) => `<tr>
          <td>${UI.esc(a.user_name || "—")}</td>
          <td><span class="badge badge--${a.action}">${actionAr[a.action] || a.action}</span></td>
          <td>${UI.esc(a.details || "—")}</td>
          <td class="mono">${UI.dateTime(a.created_at)}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
}
