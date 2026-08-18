// ============================================================================
//  التطبيق الرئيسي: الإقلاع، التوجيه (Router)، وكل الصفحات
// ============================================================================

const screen = () => document.getElementById("screen");
let realtimeChannel = null;

// ---------------------------------------------------------------------------
//  الثيم (وضع نهاري / ليلي)
// ---------------------------------------------------------------------------
const THEME_KEY = "lexarchive_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  const btn = document.getElementById("btn-theme");
  if (btn) {
    btn.innerHTML = theme === "dark" ? iconSun : iconMoon;
    btn.title = theme === "dark" ? "الوضع النهاري" : "الوضع الليلي";
  }
}

function currentTheme() {
  try { return localStorage.getItem(THEME_KEY) || "light"; } catch (_) { return "light"; }
}

function toggleTheme() {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
}

// ---------------------------------------------------------------------------
//  صينية الرفع بالخلفية — تبقى ظاهرة وتتابع الرفع حتى لو انسكّرت أي نافذة
// ---------------------------------------------------------------------------
let bgTasks = []; // { id, name, company, status: 'busy' | 'ok' | 'bad' }
let bgTaskSeq = 0;

function bgTrayAdd(name, company) {
  const id = ++bgTaskSeq;
  bgTasks.push({ id, name, company, status: "busy" });
  renderBgTray();
  return id;
}

function bgTrayUpdate(id, status) {
  const t = bgTasks.find((x) => x.id === id);
  if (t) t.status = status;
  renderBgTray();
  // إزالة المهمة المكتملة تلقائياً بعد فترة قصيرة
  if (status !== "busy") {
    setTimeout(() => {
      bgTasks = bgTasks.filter((x) => x.id !== id);
      renderBgTray();
    }, 3200);
  }
}

function renderBgTray() {
  let tray = document.getElementById("bg-tray");
  if (!bgTasks.length) {
    tray?.remove();
    return;
  }
  if (!tray) {
    tray = document.createElement("div");
    tray.id = "bg-tray";
    tray.className = "bg-tray";
    document.body.appendChild(tray);
  }
  const busyCount = bgTasks.filter((t) => t.status === "busy").length;
  tray.innerHTML = `
    <div class="bg-tray__head">
      <span class="bg-tray__spin ${busyCount ? "" : "bg-tray__spin--done"}">${busyCount ? iconUploadLg : iconCheck}</span>
      <span>${busyCount ? `جارٍ رفع ${busyCount} ملف…` : "اكتمل الرفع"}</span>
    </div>
    <div class="bg-tray__list">
      ${bgTasks.slice(-5).map((t) => `
        <div class="bg-tray__item bg-tray__item--${t.status}">
          <span class="bg-tray__icon">${t.status === "ok" ? iconCheck : t.status === "bad" ? iconClose : iconDoc}</span>
          <span class="bg-tray__name">${UI.esc(t.name)}</span>
        </div>`).join("")}
    </div>`;
}

// ---------------------------------------------------------------------------
//  حركات دخول خفيفة — عدّاد متصاعد لأرقام بطاقات الإحصائيات
// ---------------------------------------------------------------------------
function animateStatNumbers(scope) {
  const nums = scope.querySelectorAll(".stat__num");
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nums.forEach((el, i) => {
      const target = parseInt(el.textContent, 10);
      if (!Number.isFinite(target)) return;
      const duration = 650;
      const start = performance.now();
      // تدرّج بسيط بلا اعتماد مكتبة خارجية
      function tick(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target;
      }
      setTimeout(() => requestAnimationFrame(tick), i * 70);
    });
  }
}

// ---------------------------------------------------------------------------
//  الإقلاع
// ---------------------------------------------------------------------------
async function boot() {
  applyTheme(currentTheme());
  document.getElementById("firm-tag") &&
    (document.getElementById("firm-tag").textContent = window.APP_CONFIG.FIRM_NAME);

  // تدفّق إعادة تعيين كلمة المرور (المستخدم فتح الرابط من الإيميل)
  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      location.hash = "#reset";
      renderResetPassword();
    }
  });

  const ok = await Auth.restore();
  if (ok) {
    await enterApp();
  } else if (location.hash === "#reset") {
    renderResetPassword();
  } else {
    renderLogin();
  }
}

// ---------------------------------------------------------------------------
//  الدخول للتطبيق بعد المصادقة
// ---------------------------------------------------------------------------
async function enterApp() {
  screen().innerHTML = shell();
  bindShell();
  // هيكل تحميل ريثما تنزل البيانات (إحساس أسرع)
  const view = document.getElementById("view");
  if (view) view.innerHTML = `<div class="page-head"><div><h1 class="page-title">الشركات</h1></div></div>${UI.skeletonCards(6, "company")}`;
  try {
    await Promise.all([DB.loadCompanies(), DB.loadDocuments()]);
  } catch (e) {
    UI.toast("تعذّر تحميل البيانات: " + e.message, "error");
  }
  startRealtime();
  window.addEventListener("hashchange", onHashChange);
  route();
}

// غلاف لمُستمع تغيّر الرابط: لا نمرّر كائن الحدث إلى route
function onHashChange() {
  route();
}

// إشعارات لحظية عند رفع أي وثيقة من أي مستخدم
function startRealtime() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = DB.subscribeRealtime(async (table, payload) => {
    if (table === "documents" && payload.eventType === "INSERT") {
      const d = payload.new;
      if (d.uploaded_by !== State.profile.id) {
        UI.toast(`📄 وثيقة جديدة: ${d.file_name}`, "info");
      }
    }
    try {
      await Promise.all([DB.loadCompanies(), DB.loadDocuments()]);
      route(); // إعادة رسم الصفحة الحالية بالبيانات المحدّثة
    } catch (_) {}
  });
}

// ---------------------------------------------------------------------------
//  هيكل التطبيق (Sidebar + Topbar)
// ---------------------------------------------------------------------------
function shell() {
  const admin = State.isAdmin();
  const nav = [
    { id: "dashboard", label: "الرئيسية", icon: iconHome },
    { id: "companies", label: "الشركات", icon: iconBuilding },
    { id: "upload", label: "رفع وثيقة", icon: iconUpload },
    admin && { id: "admin", label: "لوحة التحكم", icon: iconShield },
    { id: "settings", label: "الإعدادات", icon: iconGear },
  ].filter(Boolean);

  return `
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand__seal">${iconScale}</div>
        <div class="brand__text">
          <span class="brand__name" id="firm-tag">${UI.esc(window.APP_CONFIG.FIRM_NAME)}</span>
          <span class="brand__sub">أرشيف الوثائق</span>
        </div>
      </div>
      <nav class="nav">
        ${nav.map((n) => `
          <a class="nav__item" data-nav="${n.id}" href="#${n.id}">
            <span class="nav__icon">${n.icon}</span>
            <span>${n.label}</span>
          </a>`).join("")}
      </nav>
      <div class="sidebar__foot">
        <div class="me me--card">
          <div class="me__avatar">${UI.esc(UI.initials(State.profile.full_name))}</div>
          <div class="me__info">
            <span class="me__name">${UI.esc(State.profile.full_name)}</span>
            <span class="me__role">${State.isAdmin() ? "مدير النظام" : "محامٍ"}</span>
          </div>
          <span class="me__dots">${iconMore}</span>
        </div>
        <button class="btn btn--ghost btn--block" id="btn-logout">${iconOut}<span>خروج</span></button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="icon-btn only-mobile" id="btn-menu" aria-label="القائمة">${iconMenu}</button>
        <div class="search topbar__search">
          <span class="search__icon">${iconSearch}</span>
          <input id="global-search" type="search" placeholder="ابحث في الشركات والوثائق…" autocomplete="off"/>
        </div>
        <div class="topbar__spacer"></div>
        <span class="chip" id="stat-companies"><b>${State.companies.length}</b> شركة</span>
        <span class="chip chip--gold" id="stat-docs"><b>${State.documents.length}</b> وثيقة</span>
        <button class="icon-btn" id="btn-theme" aria-label="تبديل الوضع"></button>
      </header>
      <main class="view" id="view"></main>
    </div>
    <div class="sidebar-scrim" id="scrim"></div>
  </div>`;
}

function bindShell() {
  document.getElementById("btn-logout").onclick = async () => {
    if (await UI.confirm("تسجيل الخروج", "هل تريد تسجيل الخروج من الحساب؟", "خروج")) {
      if (realtimeChannel) sb.removeChannel(realtimeChannel);
      await Auth.logout();
      location.hash = "";
      renderLogin();
    }
  };
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  document.getElementById("btn-menu").onclick = () => {
    sidebar.classList.add("sidebar--open");
    scrim.classList.add("sidebar-scrim--show");
  };
  scrim.onclick = () => {
    sidebar.classList.remove("sidebar--open");
    scrim.classList.remove("sidebar-scrim--show");
  };
  const gs = document.getElementById("global-search");
  gs.oninput = () => {
    if (["#dashboard", "#admin", "#settings", ""].includes(location.hash) || location.hash.startsWith("#reset")) {
      location.hash = "#companies";
    }
    route(gs.value.trim());
  };
  const themeBtn = document.getElementById("btn-theme");
  themeBtn.onclick = toggleTheme;
  applyTheme(currentTheme()); // يضبط أيقونة الزر حسب الوضع الحالي
}

// ---------------------------------------------------------------------------
//  التوجيه
// ---------------------------------------------------------------------------
// تحديث أرقام الشريط العلوي (شركات/وثائق)
function updateShellStats() {
  const c = document.getElementById("stat-companies");
  const d = document.getElementById("stat-docs");
  if (c) c.innerHTML = `<b>${State.companies.length}</b> شركة`;
  if (d) d.innerHTML = `<b>${State.documents.length}</b> وثيقة`;
}

function route(searchOverride) {
  if (!State.session) return;
  updateShellStats();
  const hash = location.hash || "#dashboard";
  const search = typeof searchOverride === "string" ? searchOverride : "";

  // إبراز عنصر القائمة النشط
  const base = hash.split("/")[0].replace("#", "");
  document.querySelectorAll(".nav__item").forEach((a) =>
    a.classList.toggle("nav__item--active", a.dataset.nav === (base === "company" ? "companies" : base))
  );
  // إغلاق القائمة الجانبية على الجوال
  document.getElementById("sidebar")?.classList.remove("sidebar--open");
  document.getElementById("scrim")?.classList.remove("sidebar-scrim--show");

  if (hash.startsWith("#company/")) renderCompany(hash.split("/")[1]);
  else if (hash === "#companies") renderCompanies(search);
  else if (hash === "#upload") renderUpload();
  else if (hash === "#admin") { if (State.isAdmin()) renderAdmin(); else { location.hash = "#dashboard"; return; } }
  else if (hash === "#settings") renderSettings();
  else renderHome();

  playViewEnter();
}

// حركة دخول ناعمة لمحتوى الصفحة عند كل تنقّل
function playViewEnter() {
  const v = document.getElementById("view");
  if (!v) return;
  v.classList.remove("view--enter");
  void v.offsetWidth; // إعادة التدفّق لإجبار إعادة تشغيل الحركة
  v.classList.add("view--enter");
}

// ---------------------------------------------------------------------------
//  صفحة تسجيل الدخول
// ---------------------------------------------------------------------------
function renderLogin() {
  screen().innerHTML = `
  <div class="auth">
    <div class="auth__art">
      <div class="auth__seal">${iconScale}</div>
      <h1 class="auth__brand">${UI.esc(window.APP_CONFIG.FIRM_NAME)}</h1>
      <p class="auth__tagline">منظومة أرشفة وحفظ وثائق الشركات</p>
      <ul class="auth__points">
        <li>${iconCheck} حفظ وتصنيف كل وثائق الشركات في مكان واحد</li>
        <li>${iconCheck} وصول فوري ومشترك لكل المحامين</li>
        <li>${iconCheck} سجل تدقيق كامل لكل عملية</li>
      </ul>
    </div>
    <div class="auth__panel">
      <div class="auth__box">
        <h2 class="auth__title">تسجيل الدخول</h2>
        <p class="auth__hint">أدخل بريدك وكلمة المرور للمتابعة</p>
        <form id="login-form" class="form">
          <label class="field">
            <span>البريد الإلكتروني</span>
            <input type="email" id="li-email" required placeholder="name@firm.iq" autocomplete="email"/>
          </label>
          <label class="field">
            <span>كلمة المرور</span>
            <input type="password" id="li-pass" required placeholder="••••••••" autocomplete="current-password"/>
          </label>
          <div class="form__row">
            <label class="check"><input type="checkbox" id="li-remember" checked/><span>تذكّرني</span></label>
            <a href="#" id="li-forgot" class="link">نسيت كلمة المرور؟</a>
          </div>
          <button type="submit" class="btn btn--primary btn--block" id="li-submit">دخول</button>
          <p class="form__error" id="li-error"></p>
        </form>
      </div>
      <p class="auth__foot">LexDesk Archive — لمكاتب المحاماة</p>
    </div>
  </div>`;

  document.getElementById("li-forgot").onclick = (e) => { e.preventDefault(); renderForgot(); };
  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("li-submit");
    const err = document.getElementById("li-error");
    err.textContent = "";
    btn.disabled = true; btn.textContent = "جارٍ الدخول…";
    try {
      await Auth.login(
        document.getElementById("li-email").value.trim(),
        document.getElementById("li-pass").value
      );
      location.hash = "#dashboard";
      await enterApp();
    } catch (ex) {
      err.textContent = translateAuthError(ex.message);
      btn.disabled = false; btn.textContent = "دخول";
    }
  };
}

// نسيت كلمة المرور
function renderForgot() {
  const box = document.querySelector(".auth__box");
  box.innerHTML = `
    <h2 class="auth__title">إعادة تعيين كلمة المرور</h2>
    <p class="auth__hint">سنرسل رابط إعادة التعيين إلى بريدك</p>
    <form id="forgot-form" class="form">
      <label class="field">
        <span>البريد الإلكتروني</span>
        <input type="email" id="fg-email" required placeholder="name@firm.iq"/>
      </label>
      <button type="submit" class="btn btn--primary btn--block" id="fg-submit">إرسال الرابط</button>
      <button type="button" class="btn btn--ghost btn--block" id="fg-back">رجوع لتسجيل الدخول</button>
      <p class="form__error" id="fg-msg"></p>
    </form>`;
  document.getElementById("fg-back").onclick = renderLogin;
  document.getElementById("forgot-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("fg-submit");
    const msg = document.getElementById("fg-msg");
    btn.disabled = true; btn.textContent = "جارٍ الإرسال…";
    try {
      await Auth.requestReset(document.getElementById("fg-email").value.trim());
      msg.className = "form__ok";
      msg.textContent = "تم الإرسال. تفقّد بريدك (وصندوق الرسائل غير المرغوبة).";
    } catch (ex) {
      msg.className = "form__error";
      msg.textContent = translateAuthError(ex.message);
    }
    btn.disabled = false; btn.textContent = "إرسال الرابط";
  };
}

// صفحة تعيين كلمة مرور جديدة
function renderResetPassword() {
  screen().innerHTML = `
  <div class="auth auth--center">
    <div class="auth__box auth__box--solo">
      <div class="auth__seal auth__seal--sm">${iconScale}</div>
      <h2 class="auth__title">تعيين كلمة مرور جديدة</h2>
      <form id="reset-form" class="form">
        <label class="field"><span>كلمة المرور الجديدة</span>
          <input type="password" id="rs-pass" required minlength="6" placeholder="6 أحرف على الأقل"/></label>
        <label class="field"><span>تأكيد كلمة المرور</span>
          <input type="password" id="rs-pass2" required minlength="6" placeholder="أعد الكتابة"/></label>
        <button type="submit" class="btn btn--primary btn--block" id="rs-submit">حفظ</button>
        <p class="form__error" id="rs-msg"></p>
      </form>
    </div>
  </div>`;
  document.getElementById("reset-form").onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById("rs-msg");
    const p1 = document.getElementById("rs-pass").value;
    const p2 = document.getElementById("rs-pass2").value;
    if (p1 !== p2) { msg.className = "form__error"; msg.textContent = "كلمتا المرور غير متطابقتين."; return; }
    try {
      await Auth.updatePassword(p1);
      msg.className = "form__ok";
      msg.textContent = "تم تغيير كلمة المرور. جارٍ التحويل…";
      setTimeout(async () => {
        location.hash = "#dashboard";
        (await Auth.restore()) ? enterApp() : renderLogin();
      }, 1200);
    } catch (ex) {
      msg.className = "form__error";
      msg.textContent = translateAuthError(ex.message);
    }
  };
}

// ---------------------------------------------------------------------------
//  الرئيسية — لوحة معلومات (إحصائيات + آخر الملفات + تنبيهات)
// ---------------------------------------------------------------------------
function renderHome() {
  const v = document.getElementById("view");
  const recentDocs = [...State.documents]
    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
    .slice(0, 6);
  const expiringCount = expiringDocs().length;

  v.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">أهلاً، ${UI.esc((State.profile.full_name || "").split(" ")[0] || "")} 👋</h1>
        <p class="page-sub">نظرة سريعة على أرشيف مكتبك</p>
      </div>
      <div class="page-actions">
        <button class="btn btn--primary" id="btn-quick-upload">${iconUpload}<span>رفع وثيقة</span></button>
        ${State.isAdmin() ? `<button class="btn btn--ghost" id="btn-quick-company">${iconPlus}<span>شركة جديدة</span></button>` : ""}
      </div>
    </div>

    <div class="stats stats--animate">
      ${statCard(iconBuilding, State.companies.length, "شركة", "navy")}
      ${statCard(iconDoc, State.documents.length, "وثيقة محفوظة", "gold")}
      ${statCard(iconClock, expiringCount, "قرب تنتهي", "violet")}
      ${statCard(iconLayers, new Set(State.documents.map((d) => d.category)).size, "نوع وثيقة مستخدم", "green")}
    </div>

    ${expiringWidget()}

    <div class="card">
      <h3 class="card__title">آخر الملفات المرفوعة</h3>
      ${recentDocsList(recentDocs, { showUploader: true })}
    </div>
  `;

  document.getElementById("btn-quick-upload").onclick = () => (location.hash = "#upload");
  const qc = document.getElementById("btn-quick-company");
  if (qc) qc.onclick = addCompanyDialog;

  v.querySelectorAll("[data-goto-doc]").forEach((el) => {
    el.onclick = () => (location.hash = `#company/${el.dataset.gotoDoc}`);
  });

  animateStatNumbers(v);
}

// ---------------------------------------------------------------------------
//  الشركات — قائمة وبحث
// ---------------------------------------------------------------------------
function renderCompanies(search = "") {
  const v = document.getElementById("view");
  const q = (typeof search === "string" ? search : "").toLowerCase();
  let companies = State.companies;
  if (q) {
    const matchDocsCompanyIds = new Set(
      State.documents.filter((d) => d.file_name.toLowerCase().includes(q)).map((d) => d.company_id)
    );
    companies = companies.filter(
      (c) => c.company_name.toLowerCase().includes(q) ||
             String(c.company_number).includes(q) ||
             matchDocsCompanyIds.has(c.id)
    );
  }

  v.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">الشركات</h1>
        <p class="page-sub">${State.companies.length} شركة · ${State.documents.length} وثيقة محفوظة</p>
      </div>
      <div class="page-actions">
        ${State.isAdmin() ? `<button class="btn btn--primary" id="btn-add-company">${iconPlus}<span>شركة جديدة</span></button>` : ""}
        <button class="btn btn--ghost" id="btn-export">${iconExcel}<span>تصدير Excel</span></button>
      </div>
    </div>
    ${companies.length === 0
      ? UI.empty(iconBuilding, search ? "لا نتائج مطابقة" : "لا توجد شركات بعد",
          search ? "جرّب كلمة بحث أخرى." : (State.isAdmin() ? "ابدأ بإضافة أول شركة." : "بانتظار إضافة الشركات من المدير."))
      : `<div class="company-rows grid--animate">
          ${companies.map((c, i) => companyCard(c, i)).join("")}
        </div>`}
  `;

  document.getElementById("btn-export").onclick = () => {
    if (!State.companies.length) return UI.toast("لا توجد بيانات للتصدير", "warn");
    DB.exportCompaniesExcel();
    UI.toast("تم تصدير ملف Excel", "success");
  };
  const addBtn = document.getElementById("btn-add-company");
  if (addBtn) addBtn.onclick = addCompanyDialog;

  v.querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = () => (location.hash = `#company/${el.dataset.open}`);
  });
  v.querySelectorAll("[data-edit-company]").forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); renameCompanyDialog(el.dataset.editCompany); };
  });
  v.querySelectorAll("[data-del-company]").forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); deleteCompanyDialog(el.dataset.delCompany); };
  });
}

// قائمة الوثائق القريبة من الانتهاء أو المنتهية (خلال 30 يوم)
function expiringDocs() {
  return State.documents
    .map((d) => ({ d, ex: UI.expiryStatus(d.expiry_date) }))
    .filter((x) => ["expired", "urgent", "soon"].includes(x.ex.state))
    .sort((a, b) => (a.ex.days ?? 9e9) - (b.ex.days ?? 9e9));
}

function expiringWidget() {
  const items = expiringDocs();
  if (!items.length) return "";
  const companyName = (id) => State.companies.find((c) => c.id === id)?.company_name || "—";
  return `
    <section class="alert-card">
      <div class="alert-card__head">
        <span class="alert-card__icon">${iconClock}</span>
        <h3>وثائق قرب تنتهي</h3>
        <span class="alert-card__count">${items.length}</span>
      </div>
      <ul class="alert-list">
        ${items.slice(0, 6).map(({ d, ex }) => `
          <li class="alert-list__item" data-goto-doc="${d.company_id}">
            <span class="dot dot--${ex.state}"></span>
            <span class="alert-list__main">
              <b>${UI.esc(d.file_name)}</b>
              <small>${UI.esc(companyName(d.company_id))} · ${UI.esc(d.category)}</small>
            </span>
            <span class="alert-list__badge alert-list__badge--${ex.state}">${UI.esc(ex.label)}</span>
          </li>`).join("")}
      </ul>
      ${items.length > 6 ? `<p class="alert-card__more">و ${items.length - 6} وثيقة أخرى…</p>` : ""}
    </section>`;
}

// قائمة "أحدث الوثائق" — مشتركة بين لوحة المعلومات ولوحة تحكم الأدمِن (تفادي تكرار الكود)
function recentDocsList(docs, opts = {}) {
  const { limit = 6, showUploader = true } = opts;
  const items = docs.slice(0, limit);
  if (!items.length) return `<p class="muted">لا وثائق بعد.</p>`;
  return `<ul class="mini-list">${items.map((d) => {
    const co = State.companies.find((c) => c.id === d.company_id);
    const meta = showUploader
      ? `${UI.esc(co?.company_name || "—")} · ${UI.esc(d.uploader?.full_name || "—")}`
      : UI.esc(co?.company_name || "—");
    return `<li class="mini-list__item" data-goto-doc="${d.company_id}">
      <span class="mini-list__ic doc-card__icon--${d.file_type}">${UI.fileIcon(d.file_type)}</span>
      <span class="mini-list__main">
        <b>${UI.esc(d.file_name)}</b>
        <small>${meta}</small>
      </span>
      <small class="mini-list__time">${UI.date(d.uploaded_at)}</small>
    </li>`;
  }).join("")}</ul>`;
}

function companyCard(c, i = 0) {
  const admin = State.isAdmin();
  const files = [];
  if (c.tax_file_no) files.push(`<span>${iconDoc}ضرائب: <b>${UI.esc(c.tax_file_no)}</b></span>`);
  if (c.registrar_file_no) files.push(`<span>${iconDoc}مسجل الشركات: <b>${UI.esc(c.registrar_file_no)}</b></span>`);
  return `
  <article class="company-row" data-open="${c.id}" tabindex="0" style="--i:${i}">
    <div class="company-row__num">#${c.company_number}</div>
    <div class="company-row__main">
      <h3 class="company-row__name">${UI.esc(c.company_name)}</h3>
      ${files.length ? `<div class="company-row__files">${files.join("")}</div>` : ""}
    </div>
    <div class="company-row__meta">
      <span>${iconDoc}<b>${c.doc_count}</b> وثيقة</span>
      <span class="only-desktop">${iconClock}${UI.date(c.updated_at)}</span>
    </div>
    ${admin ? `<div class="company-row__tools">
      <button class="icon-btn" data-edit-company="${c.id}" title="تعديل">${iconEdit}</button>
      <button class="icon-btn icon-btn--danger" data-del-company="${c.id}" title="حذف">${iconTrash}</button>
    </div>` : ""}
    <div class="company-row__go">${iconArrow}</div>
  </article>`;
}

// ---------------------------------------------------------------------------
//  تفاصيل الشركة + وثائقها
// ---------------------------------------------------------------------------
let companyFilter = { q: "", cat: "", type: "" };

function renderCompany(id) {
  const c = State.companies.find((x) => x.id === id);
  const v = document.getElementById("view");
  if (!c) {
    v.innerHTML = UI.empty(iconBuilding, "الشركة غير موجودة", "قد تكون حُذفت.");
    return;
  }
  companyFilter = { q: "", cat: "", type: "" };

  v.innerHTML = `
    <nav class="crumbs">
      <a href="#dashboard">${iconHome} الرئيسية</a>
      <span class="crumbs__sep">${iconArrowBack}</span>
      <a href="#companies">الشركات</a>
      <span class="crumbs__sep">${iconArrowBack}</span>
      <span class="crumbs__current">${UI.esc(c.company_name)}</span>
    </nav>
    <div class="company-head">
      <div class="company-head__id">#${c.company_number}</div>
      <div class="company-head__body">
        <h1 class="page-title">${UI.esc(c.company_name)}</h1>
        <p class="page-sub">${c.doc_count} وثيقة · أُضيفت ${UI.date(c.created_at)} · آخر تحديث ${UI.date(c.updated_at)}</p>
        ${(c.tax_file_no || c.registrar_file_no) ? `<div class="company-head__files">
          ${c.tax_file_no ? `<span class="chip">إضبارة الضرائب: <b>${UI.esc(c.tax_file_no)}</b></span>` : ""}
          ${c.registrar_file_no ? `<span class="chip">إضبارة مسجل الشركات: <b>${UI.esc(c.registrar_file_no)}</b></span>` : ""}
        </div>` : ""}
      </div>
      <div class="company-head__actions">
        <button class="btn btn--primary" id="btn-up-here">${iconUpload}<span>رفع وثيقة</span></button>
        ${State.isAdmin() ? `<button class="btn btn--ghost" id="btn-rename-here">${iconEdit}<span>تعديل</span></button>` : ""}
      </div>
    </div>

    <div class="filters">
      <div class="search search--inline">
        <span class="search__icon">${iconSearch}</span>
        <input id="cf-q" type="search" placeholder="ابحث باسم الوثيقة…"/>
      </div>
      <select id="cf-cat" class="select">
        <option value="">كل التصنيفات</option>
        ${UI.categories.map((k) => `<option value="${k}">${k}</option>`).join("")}
      </select>
      <select id="cf-type" class="select">
        <option value="">كل الأنواع</option>
        <option value="pdf">PDF</option><option value="word">Word</option>
        <option value="excel">Excel</option><option value="image">صور</option>
        <option value="other">أخرى</option>
      </select>
    </div>

    <div id="docs-area"></div>
  `;

  document.getElementById("btn-up-here").onclick = () => uploadDialog(c.id);
  const rn = document.getElementById("btn-rename-here");
  if (rn) rn.onclick = () => renameCompanyDialog(c.id);

  const apply = () => renderDocs(c.id);
  document.getElementById("cf-q").oninput = (e) => { companyFilter.q = e.target.value.toLowerCase(); apply(); };
  document.getElementById("cf-cat").onchange = (e) => { companyFilter.cat = e.target.value; apply(); };
  document.getElementById("cf-type").onchange = (e) => { companyFilter.type = e.target.value; apply(); };

  renderDocs(id);
}

function renderDocs(companyId) {
  const area = document.getElementById("docs-area");
  if (!area) return;
  updateShellStats();
  let docs = DB.docsOf(companyId);
  const { q, cat, type } = companyFilter;
  if (q) docs = docs.filter((d) => d.file_name.toLowerCase().includes(q));
  if (cat) docs = docs.filter((d) => d.category === cat);
  if (type) docs = docs.filter((d) => d.file_type === type);

  if (!docs.length) {
    area.innerHTML = UI.empty(iconDoc, "لا وثائق مطابقة", "ارفع وثيقة أو غيّر عوامل التصفية.");
    return;
  }

  area.innerHTML = `<div class="grid grid--docs grid--animate">${docs.map((d, i) => docCard(d, i)).join("")}</div>`;

  area.querySelectorAll("[data-preview]").forEach((el) =>
    el.onclick = () => previewDoc(el.dataset.preview));
  area.querySelectorAll("[data-download]").forEach((el) =>
    el.onclick = (e) => { e.stopPropagation(); downloadDoc(el.dataset.download); });
  area.querySelectorAll("[data-edit-doc]").forEach((el) =>
    el.onclick = (e) => { e.stopPropagation(); editDocDialog(el.dataset.editDoc); });
  area.querySelectorAll("[data-del-doc]").forEach((el) =>
    el.onclick = (e) => { e.stopPropagation(); deleteDocDialog(el.dataset.delDoc); });
  loadThumbs(area);
}

// تحميل الصور المصغّرة للوثائق من نوع صورة (أفضل جهد، لا يوقف الواجهة)
async function loadThumbs(scope) {
  const tiles = scope.querySelectorAll("[data-thumb]");
  for (const t of tiles) {
    try {
      const url = await DB.signedUrl(t.dataset.thumb);
      t.style.backgroundImage = `url("${url}")`;
      t.classList.add("doc-card__icon--loaded");
    } catch (_) {}
  }
}

function docCard(d, i = 0) {
  const canManage = State.isAdmin() || d.uploaded_by === State.profile.id;
  const uploader = d.uploader?.full_name || "—";
  const ex = UI.expiryStatus(d.expiry_date);
  const isImg = d.file_type === "image";
  return `
  <article class="card doc-card" data-preview="${d.id}" tabindex="0" style="--i:${i}">
    <div class="doc-card__icon doc-card__icon--${d.file_type}${isImg ? " doc-card__icon--thumb" : ""}"
      ${isImg ? `data-thumb="${UI.esc(d.storage_path)}"` : ""}>${UI.fileIcon(d.file_type)}</div>
    <div class="doc-card__body">
      <h4 class="doc-card__name" title="${UI.esc(d.file_name)}">${UI.esc(d.file_name)}</h4>
      <div class="doc-card__tags">
        <span class="tag">${UI.esc(d.category)}</span>
        <span class="tag tag--muted">${UI.fileSize(d.file_size)}</span>
        ${ex.state !== "none" ? `<span class="tag tag--exp tag--exp-${ex.state}">${iconClock}${UI.esc(ex.label)}</span>` : ""}
      </div>
      <div class="doc-card__meta">${iconUser}${UI.esc(uploader)} · ${UI.date(d.uploaded_at)}</div>
    </div>
    <div class="doc-card__actions">
      <button class="icon-btn" data-download="${d.id}" title="تنزيل">${iconDownload}</button>
      ${canManage ? `<button class="icon-btn" data-edit-doc="${d.id}" title="تعديل">${iconEdit}</button>` : ""}
      ${canManage ? `<button class="icon-btn icon-btn--danger" data-del-doc="${d.id}" title="حذف">${iconTrash}</button>` : ""}
    </div>
  </article>`;
}

// حوار تعديل وثيقة (تصنيف + تاريخ انتهاء)
function editDocDialog(id) {
  const d = State.documents.find((x) => x.id === id);
  if (!d) return;
  const m = UI.openModal(`
    <h3 class="modal__title">تعديل الوثيقة</h3>
    <p class="modal__text" style="margin-bottom:14px">${UI.esc(d.file_name)}</p>
    <form id="ed-form" class="form">
      <label class="field"><span>نوع الوثيقة</span>
        <select id="ed-cat" class="select">
          ${UI.categories.map((k) => `<option value="${k}" ${k === d.category ? "selected" : ""}>${k}</option>`).join("")}
        </select></label>
      <label class="field"><span>تاريخ الرفع <small class="hint-inline">(اختياري)</small></span>
        <input type="date" id="ed-docdate" class="select" value="${d.document_date || ""}"/></label>
      <label class="field"><span>تاريخ الانتهاء <small class="hint-inline">(للرخص والعقود — اتركه فارغاً إن لا يوجد)</small></span>
        <input type="date" id="ed-exp" class="select" value="${d.expiry_date || ""}"/></label>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-close>إلغاء</button>
        <button type="submit" class="btn btn--primary">حفظ</button>
      </div>
    </form>`, "sm");
  m.querySelector("#ed-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await DB.updateDocument(id, {
        category: m.querySelector("#ed-cat").value,
        document_date: m.querySelector("#ed-docdate").value || null,
        expiry_date: m.querySelector("#ed-exp").value || null,
      });
      await DB.loadDocuments();
      UI.closeModal(m);
      UI.toast("تم حفظ التعديلات", "success");
      if (location.hash.startsWith("#company/")) renderDocs(location.hash.split("/")[1]);
      else route();
    } catch (ex) { UI.toast("فشل الحفظ: " + ex.message, "error"); }
  };
}

// ---------------------------------------------------------------------------
//  الرفع (صفحة مستقلة)
// ---------------------------------------------------------------------------
function renderUpload() {
  const v = document.getElementById("view");
  if (!State.companies.length) {
    v.innerHTML = `<div class="page-head"><h1 class="page-title">رفع وثيقة</h1></div>` +
      UI.empty(iconBuilding, "لا توجد شركات", "يجب إضافة شركة أولاً قبل رفع الوثائق.");
    return;
  }
  v.innerHTML = `
    <div class="page-head"><div>
      <h1 class="page-title">رفع وثيقة</h1>
      <p class="page-sub">اختر الشركة ونوع الوثيقة ثم أضف الملفات</p>
    </div></div>
    <div class="card upload-card">
      <div class="form form--grid">
        <label class="field"><span>الشركة</span>
          <select id="up-company" class="select">
            ${State.companies.map((c) => `<option value="${c.id}">#${c.company_number} — ${UI.esc(c.company_name)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>نوع الوثيقة</span>
          <select id="up-cat" class="select">
            ${UI.categories.map((k) => `<option value="${k}">${k}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>تاريخ الرفع</span>
          <input type="date" id="up-exp" class="select" value="${UI.todayStr()}"/></label>
      </div>
      <div class="dropzone" id="dropzone">
        ${dropzoneArt()}
        <p class="dropzone__title">اسحب الملفات هنا أو اضغط للاختيار</p>
        <p class="dropzone__hint">PDF · Word · Excel · صور</p>
        <input type="file" id="up-files" multiple hidden
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp"/>
      </div>
      <div id="up-list" class="up-list"></div>
    </div>`;

  wireUploader("up-company", "up-cat", "dropzone", "up-files", "up-list", null, "up-exp");
}

// أيقونات ملفات متراكبة لمنطقة الرفع (بدل أيقونة واحدة ثابتة)
function dropzoneArt() {
  return `<div class="dropzone__art">
    <span class="dropzone__chip dropzone__chip--word">${iconDoc}</span>
    <span class="dropzone__chip dropzone__chip--main">${iconFolderPlus}</span>
    <span class="dropzone__chip dropzone__chip--pdf">${iconDoc}</span>
  </div>`;
}

// ---------------------------------------------------------------------------
//  حوارات الشركات
// ---------------------------------------------------------------------------
function addCompanyDialog() {
  const m = UI.openModal(`
    <h3 class="modal__title">شركة جديدة</h3>
    <form id="ac-form" class="form">
      <label class="field"><span>اسم الشركة</span>
        <input id="ac-name" required placeholder="مثال: شركة القدرة العربية" autofocus/></label>
      <label class="field"><span>رقم الإضبارة في الهيئة العامة للضرائب <small class="hint-inline">(اختياري)</small></span>
        <input id="ac-tax" placeholder="مثال: 12345"/></label>
      <label class="field"><span>رقم الإضبارة في مسجل الشركات <small class="hint-inline">(اختياري)</small></span>
        <input id="ac-reg" placeholder="مثال: 6789"/></label>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-close>إلغاء</button>
        <button type="submit" class="btn btn--primary">إضافة</button>
      </div>
    </form>`, "sm");
  m.querySelector("#ac-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = m.querySelector("#ac-name").value.trim();
    if (!name) return;
    try {
      await DB.addCompany({
        name,
        taxFileNo: m.querySelector("#ac-tax").value.trim(),
        registrarFileNo: m.querySelector("#ac-reg").value.trim(),
      });
      await DB.loadCompanies();
      UI.closeModal(m);
      UI.toast("تمت إضافة الشركة", "success");
      route();
    } catch (ex) { UI.toast("فشل الإضافة: " + ex.message, "error"); }
  };
}

function renameCompanyDialog(id) {
  const c = State.companies.find((x) => x.id === id);
  const m = UI.openModal(`
    <h3 class="modal__title">تعديل بيانات الشركة</h3>
    <form id="rn-form" class="form">
      <label class="field"><span>اسم الشركة</span>
        <input id="rn-name" required value="${UI.esc(c.company_name)}" autofocus/></label>
      <label class="field"><span>رقم الإضبارة في الهيئة العامة للضرائب <small class="hint-inline">(اختياري)</small></span>
        <input id="rn-tax" value="${UI.esc(c.tax_file_no || "")}" placeholder="مثال: 12345"/></label>
      <label class="field"><span>رقم الإضبارة في مسجل الشركات <small class="hint-inline">(اختياري)</small></span>
        <input id="rn-reg" value="${UI.esc(c.registrar_file_no || "")}" placeholder="مثال: 6789"/></label>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-close>إلغاء</button>
        <button type="submit" class="btn btn--primary">حفظ</button>
      </div>
    </form>`, "sm");
  m.querySelector("#rn-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = m.querySelector("#rn-name").value.trim();
    try {
      await DB.updateCompany(id, {
        name,
        taxFileNo: m.querySelector("#rn-tax").value.trim(),
        registrarFileNo: m.querySelector("#rn-reg").value.trim(),
      });
      await DB.loadCompanies();
      UI.closeModal(m);
      UI.toast("تم حفظ البيانات", "success");
      route();
    } catch (ex) { UI.toast("فشل التعديل: " + ex.message, "error"); }
  };
}

async function deleteCompanyDialog(id) {
  const c = State.companies.find((x) => x.id === id);
  const ok = await UI.confirm(
    "حذف الشركة",
    `سيتم حذف "${c.company_name}" وكل وثائقها (${c.doc_count}) نهائياً. لا يمكن التراجع.`,
    "حذف نهائي"
  );
  if (!ok) return;
  try {
    await DB.deleteCompany(id, c.company_name);
    await Promise.all([DB.loadCompanies(), DB.loadDocuments()]);
    UI.toast("تم حذف الشركة", "success");
    if (location.hash.startsWith("#company/")) location.hash = "#companies";
    else route();
  } catch (ex) { UI.toast("فشل الحذف: " + ex.message, "error"); }
}

// ---------------------------------------------------------------------------
//  حوار رفع سريع (من داخل الشركة)
// ---------------------------------------------------------------------------
function uploadDialog(companyId) {
  const m = UI.openModal(`
    <h3 class="modal__title">رفع وثيقة</h3>
    <div class="form">
      <div class="form--grid">
        <label class="field"><span>نوع الوثيقة</span>
          <select id="ud-cat" class="select">
            ${UI.categories.map((k) => `<option value="${k}">${k}</option>`).join("")}
          </select></label>
        <label class="field"><span>تاريخ الرفع</span>
          <input type="date" id="ud-exp" class="select" value="${UI.todayStr()}"/></label>
      </div>
      <div class="dropzone dropzone--sm" id="ud-zone">
        ${dropzoneArt()}
        <p class="dropzone__title">اسحب أو اختر الملفات</p>
        <input type="file" id="ud-files" multiple hidden
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp"/>
      </div>
      <div id="ud-list" class="up-list"></div>
      <p class="hint-inline modal__bg-hint">${iconCheck} يمكنك إغلاق هذه النافذة، الرفع يستمر بالخلفية</p>
      <div class="modal__actions"><button class="btn btn--ghost" data-close>إغلاق</button></div>
    </div>`, "md");
  wireUploader(null, "ud-cat", "ud-zone", "ud-files", "ud-list", companyId, "ud-exp");
}

// منطق الرفع المشترك (صفحة + حوار) — الرفع يستمر بالخلفية حتى لو انسكّرت النافذة
function wireUploader(companySelId, catSelId, zoneId, inputId, listId, fixedCompanyId, dateSelId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  zone.onclick = () => input.click();
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("dropzone--over"); };
  zone.ondragleave = () => zone.classList.remove("dropzone--over");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("dropzone--over");
    handleFiles(e.dataTransfer.files);
  };
  input.onchange = () => handleFiles(input.files);

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const companyId = fixedCompanyId || document.getElementById(companySelId).value;
    const category = document.getElementById(catSelId).value;
    const documentDate = (dateSelId && document.getElementById(dateSelId)?.value) || null;
    const companyName = State.companies.find((c) => c.id === companyId)?.company_name || "";

    let okCount = 0, failCount = 0;
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        UI.toast(`"${file.name}" أكبر من 50MB`, "warn");
        continue;
      }
      // صف محلي داخل النافذة (يختفي لو انسكّرت النافذة، بلا مشكلة)
      const row = document.createElement("div");
      row.className = "up-row up-row--busy";
      row.innerHTML = `
        <span class="up-row__icon">${UI.fileIcon(UI.fileType(file.name))}</span>
        <span class="up-row__name">${UI.esc(file.name)}</span>
        <span class="up-row__status">جارٍ الرفع…</span>`;
      list.prepend(row);

      // مهمة بالصينية العامة (تبقى ظاهرة حتى لو انسكّرت النافذة)
      const taskId = bgTrayAdd(file.name, companyName);

      try {
        await DB.uploadDocument(companyId, file, category, documentDate);
        row.className = "up-row up-row--ok";
        row.querySelector(".up-row__status").innerHTML = `<span class="ok">${iconCheck} تم</span>`;
        bgTrayUpdate(taskId, "ok");
        okCount++;
      } catch (ex) {
        row.className = "up-row up-row--bad";
        row.querySelector(".up-row__status").innerHTML = `<span class="bad">فشل</span>`;
        bgTrayUpdate(taskId, "bad");
        UI.toast(`فشل رفع ${file.name}: ${ex.message}`, "error");
        failCount++;
      }
    }
    await Promise.all([DB.loadCompanies(), DB.loadDocuments()]);
    if (location.hash.startsWith("#company/")) renderDocs(location.hash.split("/")[1]);
    updateShellStats();
    if (okCount) UI.toast(okCount === 1 ? "تم رفع الوثيقة" : `تم رفع ${okCount} وثيقة`, "success");
    input.value = "";
  }
}

// ---------------------------------------------------------------------------
//  معاينة / تنزيل / حذف الوثائق
// ---------------------------------------------------------------------------
async function previewDoc(id) {
  const d = State.documents.find((x) => x.id === id);
  if (!d) return;
  let url;
  try { url = await DB.signedUrl(d.storage_path); }
  catch (ex) { return UI.toast("تعذّر فتح الملف: " + ex.message, "error"); }

  // على الجوال لا نستخدم iframe للـ PDF (سفاري يكبّره ويكسر التمرير)
  const isMobile = window.matchMedia("(max-width: 860px)").matches;

  let inner;
  if (d.file_type === "image") {
    inner = `<img class="preview__img" src="${url}" alt="${UI.esc(d.file_name)}"/>`;
  } else if (d.file_type === "pdf" && !isMobile) {
    inner = `<iframe class="preview__frame" src="${url}"></iframe>`;
  } else {
    const isPdf = d.file_type === "pdf";
    inner = `<div class="preview__noview">
      <div class="preview__noview-icon">${UI.fileIcon(d.file_type)}</div>
      <p>${isPdf ? "افتح الملف في عارض النظام للتصفّح والتكبير بسلاسة." : "لا تتوفّر معاينة مباشرة لهذا النوع."}</p>
      <div class="preview__noview-actions">
        <a class="btn btn--primary" href="${url}" target="_blank" rel="noopener">${iconDoc}<span>فتح الملف</span></a>
        <button class="btn btn--ghost" data-dl="${d.id}">${iconDownload}<span>تنزيل</span></button>
      </div>
    </div>`;
  }

  const m = UI.openModal(`
    <div class="preview">
      <div class="preview__head">
        <div class="preview__title">${UI.fileIcon(d.file_type)}<span>${UI.esc(d.file_name)}</span></div>
        <div class="preview__head-actions">
          <button class="icon-btn" data-dl="${d.id}" title="تنزيل">${iconDownload}</button>
          <button class="icon-btn" data-close title="إغلاق">${iconClose}</button>
        </div>
      </div>
      <div class="preview__body">${inner}</div>
      <div class="preview__foot">
        <span>${UI.esc(d.category)}</span><span>·</span>
        <span>${UI.fileSize(d.file_size)}</span><span>·</span>
        <span>${UI.esc(d.uploader?.full_name || "—")}</span><span>·</span>
        <span>${UI.dateTime(d.uploaded_at)}</span>
      </div>
    </div>`, "lg");

  m.querySelectorAll("[data-dl]").forEach((el) =>
    el.onclick = () => downloadDoc(el.dataset.dl));
}

async function downloadDoc(id) {
  const d = State.documents.find((x) => x.id === id);
  try {
    const url = await DB.signedUrl(d.storage_path, true);
    const a = document.createElement("a");
    a.href = url; a.download = d.file_name;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (ex) { UI.toast("تعذّر التنزيل: " + ex.message, "error"); }
}

async function deleteDocDialog(id) {
  const d = State.documents.find((x) => x.id === id);
  const ok = await UI.confirm("حذف الوثيقة", `سيتم حذف "${d.file_name}" نهائياً.`, "حذف");
  if (!ok) return;
  try {
    await DB.deleteDocument(d);
    await Promise.all([DB.loadCompanies(), DB.loadDocuments()]);
    UI.toast("تم حذف الوثيقة", "success");
    if (location.hash.startsWith("#company/")) renderDocs(location.hash.split("/")[1]);
    else route();
  } catch (ex) { UI.toast("فشل الحذف: " + ex.message, "error"); }
}

// ---------------------------------------------------------------------------
//  الإعدادات الشخصية
// ---------------------------------------------------------------------------
function renderSettings() {
  const v = document.getElementById("view");
  const p = State.profile;
  v.innerHTML = `
    <div class="page-head"><div>
      <h1 class="page-title">الإعدادات</h1>
      <p class="page-sub">بياناتك الشخصية وكلمة المرور</p>
    </div></div>
    <div class="settings-grid">
      <div class="card">
        <h3 class="card__title">الملف الشخصي</h3>
        <form id="st-profile" class="form">
          <label class="field"><span>الاسم الكامل</span>
            <input id="st-name" value="${UI.esc(p.full_name)}" required/></label>
          <label class="field"><span>البريد الإلكتروني</span>
            <input value="${UI.esc(p.email || "")}" disabled/></label>
          <label class="field"><span>الدور</span>
            <input value="${State.isAdmin() ? "مدير النظام" : "محامٍ"}" disabled/></label>
          <button class="btn btn--primary" type="submit">حفظ التغييرات</button>
        </form>
      </div>
      <div class="card">
        <h3 class="card__title">تغيير كلمة المرور</h3>
        <form id="st-pass" class="form">
          <label class="field"><span>كلمة المرور الجديدة</span>
            <input id="st-p1" type="password" minlength="6" required placeholder="6 أحرف على الأقل"/></label>
          <label class="field"><span>تأكيد كلمة المرور</span>
            <input id="st-p2" type="password" minlength="6" required/></label>
          <button class="btn btn--primary" type="submit">تحديث كلمة المرور</button>
        </form>
      </div>
    </div>`;

  document.getElementById("st-profile").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await DB.updateUserProfile(p.id, document.getElementById("st-name").value.trim());
      await Auth.loadProfile();
      UI.toast("تم حفظ البيانات", "success");
      screen().innerHTML = shell(); bindShell(); route();
    } catch (ex) { UI.toast("فشل الحفظ: " + ex.message, "error"); }
  };
  document.getElementById("st-pass").onsubmit = async (e) => {
    e.preventDefault();
    const p1 = document.getElementById("st-p1").value;
    const p2 = document.getElementById("st-p2").value;
    if (p1 !== p2) return UI.toast("كلمتا المرور غير متطابقتين", "warn");
    try {
      await Auth.updatePassword(p1);
      UI.toast("تم تحديث كلمة المرور", "success");
      e.target.reset();
    } catch (ex) { UI.toast("فشل التحديث: " + ex.message, "error"); }
  };
}

// أخطاء المصادقة بالعربي
function translateAuthError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "البريد أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed")) return "لم يتم تأكيد البريد بعد.";
  if (m.includes("rate limit") || m.includes("too many")) return "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.";
  if (m.includes("network")) return "تعذّر الاتصال بالخادم. تحقّق من الإنترنت.";
  if (m.includes("معطّل")) return msg;
  return msg || "حدث خطأ غير متوقع.";
}

// انطلاق
document.addEventListener("DOMContentLoaded", boot);
