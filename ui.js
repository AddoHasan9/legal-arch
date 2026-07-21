// ============================================================================
//  أدوات الواجهة: إشعارات، نوافذ منبثقة، تنسيق، أيقونات
// ============================================================================

const UI = {
  // ------- إشعار سريع (Toast) -------
  toast(message, type = "info") {
    const wrap = document.getElementById("toast-wrap");
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span class="toast__dot"></span><span>${UI.esc(message)}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast--show"));
    setTimeout(() => {
      el.classList.remove("toast--show");
      setTimeout(() => el.remove(), 250);
    }, 3400);
  },

  // ------- نافذة تأكيد -------
  confirm(title, message, confirmText = "تأكيد") {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `
        <div class="modal modal--sm" role="dialog" aria-modal="true">
          <h3 class="modal__title">${UI.esc(title)}</h3>
          <p class="modal__text">${UI.esc(message)}</p>
          <div class="modal__actions">
            <button class="btn btn--ghost" data-act="cancel">إلغاء</button>
            <button class="btn btn--danger" data-act="ok">${UI.esc(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add("modal-backdrop--show"));
      const close = (val) => {
        backdrop.classList.remove("modal-backdrop--show");
        setTimeout(() => backdrop.remove(), 200);
        resolve(val);
      };
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close(false);
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "ok") close(true);
        if (act === "cancel") close(false);
      });
    });
  },

  // ------- فتح/إغلاق نافذة محتوى -------
  openModal(html, size = "md") {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal modal--${size}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("modal-backdrop--show"));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.closest("[data-close]")) UI.closeModal(backdrop);
    });
    return backdrop;
  },

  closeModal(backdrop) {
    backdrop.classList.remove("modal-backdrop--show");
    setTimeout(() => backdrop.remove(), 200);
  },

  // ------- تهريب النص (منع XSS) -------
  esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },

  // ------- تنسيق التاريخ بالعربي -------
  date(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("ar-IQ", {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch { return iso; }
  },

  dateTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ar-IQ", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  },

  // ------- تنسيق حجم الملف -------
  fileSize(bytes) {
    if (!bytes) return "0 B";
    const u = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
  },

  // ------- تحديد نوع الملف من الامتداد -------
  fileType(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["doc", "docx", "rtf"].includes(ext)) return "word";
    if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
    return "other";
  },

  // ------- أيقونة SVG حسب نوع الملف -------
  fileIcon(type) {
    const icons = {
      pdf:   `<svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.6"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6"/><text x="12" y="17" font-size="6" fill="currentColor" text-anchor="middle" font-family="Arial" font-weight="bold">PDF</text></svg>`,
      word:  `<svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.6"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6"/><text x="12" y="17" font-size="5.5" fill="currentColor" text-anchor="middle" font-family="Arial" font-weight="bold">DOC</text></svg>`,
      excel: `<svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.6"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6"/><text x="12" y="17" font-size="5.5" fill="currentColor" text-anchor="middle" font-family="Arial" font-weight="bold">XLS</text></svg>`,
      image: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="9.5" r="1.5" fill="currentColor"/><path d="M21 16l-5-5L5 20" stroke="currentColor" stroke-width="1.6"/></svg>`,
      other: `<svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.6"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6"/></svg>`,
    };
    return icons[type] || icons.other;
  },

  // ------- تصنيفات الوثائق -------
  categories: ["عقود", "ترخيص", "فواتير", "مراسلات", "أحكام قضائية", "هويات ومستندات", "أخرى"],

  // ------- حالة فارغة -------
  empty(icon, title, hint) {
    return `<div class="empty">
      <div class="empty__icon">${icon}</div>
      <p class="empty__title">${UI.esc(title)}</p>
      ${hint ? `<p class="empty__hint">${UI.esc(hint)}</p>` : ""}
    </div>`;
  },

  // ------- حروف أولى للاسم (Avatar) -------
  initials(name) {
    const parts = String(name || "؟").trim().split(/\s+/);
    return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  },
};
