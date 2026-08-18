// ============================================================================
//  أرشيف الوثائق — غلاف سطح المكتب (Electron)
//  يفتح الموقع المنشور فعلياً بنافذة مستقلة، بدون شريط عنوان متصفح.
//  أي تحديث على الموقع نفسه ينعكس هنا تلقائياً — بلا حاجة لإعادة بناء exe.
// ============================================================================
const { app, BrowserWindow, shell, Menu, session } = require("electron");
const path = require("path");

// ✏️ عدّل هذا الرابط لو تغيّر دومين موقعك مستقبلاً
const APP_URL = "https://legal-archive-beta.vercel.app";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 600,
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#F5F5F7",
    autoHideMenuBar: true, // يخفي القائمة العلوية (File/Edit...) لمظهر أنظف
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // إزالة القائمة نهائياً (اختياري — شكل أقرب لتطبيق حقيقي)
  Menu.setApplicationMenu(null);

  mainWindow.loadURL(APP_URL);

  // فتح أي رابط خارجي (مثل روابط تنزيل ملفات موقّتة) بالمتصفح الافتراضي بدل نافذة جديدة داخل التطبيق
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // شاشة خطأ ودّية لو انقطع الإنترنت
  mainWindow.webContents.on("did-fail-load", (_e, errorCode) => {
    if (errorCode === -3) return; // تجاهل إلغاء تحميل عادي
    mainWindow.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`
        <html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
        <style>
          body{font-family:Tahoma,Arial,sans-serif;background:#F5F5F7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
          .box{text-align:center;color:#1D1D1F}
          button{margin-top:16px;padding:10px 22px;border-radius:999px;border:none;background:#1D1D1F;color:#fff;font-size:14px;cursor:pointer}
        </style></head>
        <body><div class="box">
          <h2>تعذّر الاتصال بالموقع</h2>
          <p>تأكّد من اتصالك بالإنترنت ثم أعد المحاولة</p>
          <button onclick="location.reload()">إعادة المحاولة</button>
        </div></body></html>
      `)
    );
  });
}

app.whenReady().then(() => {
  // سياسة أمان بسيطة: منع فتح نوافذ منبثقة غير متوقعة
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
