# 🚀 Rivo Release & Multi-Platform Update Guidelines
*(دليل وقواعد إصدار التحديثات لجميع منصات ريفو)*

> **مهم جداً لأي جلسة ذكاء اصطناعي (AI Assistant) أو مطور مستقبلي:**
> عند إصدار أي تحديث جديد لـ Rivo (سواء كان Web أو Android أو iOS أو Windows Desktop)، يجب الالتزام الصارم بالخطوات التالية لضمان وصول التحديث لكافة المستخدمين وتحديث الموقع تلقائياً.

---

## 1. تحديث أرقام الإصدارات (Version Bumping)
يجب رفع رقم الإصدار والـ Build في جميع الملفات التالية بشكل موحد:
- `src/version.js`: `APP_VERSION`, `BUILD_NUMBER`, `FULL_VERSION`, `BUILD_DATE`
- `src/native/version.js`: `APP_VERSION`, `BUILD_NUMBER`
- `package.json`: `"version": "x.y.z"`
- `app.json`: `"version": "x.y.z"`, `"android.versionCode"`, `"ios.buildNumber"`
- `android/app/build.gradle`: `versionCode`, `versionName`
- `desktop-app/Form1.cs`: `currentVersion = "x.y.z"`
- `server/index.js`: كائن `APP_VERSIONS_DATA`

---

## 2. بناء ونشر حزم التثبيت (Release Artifacts)
يجب بناء الحزم ووضعها في مجلدات التحميل الرسمية على السيرفر:

1. **الويب (Web Dist):**
   ```powershell
   npm.cmd run build
   ```
2. **تطبيق الويندوز (Windows Desktop Standalone .EXE):**
   - يتم البناء كـ Single-File مستقل تماماً ومدمج داخله `WebView2Loader.dll`:
   ```powershell
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
   ```
   - نسخ `Rivo.exe` الناتج إلى:
     - `public/downloads/Rivo.exe`
     - `dist/downloads/Rivo.exe`
3. **تطبيق الأندرويد (Android .APK):**
   - نسخ الـ APK إلى `public/downloads/Rivo-v<VERSION>.apk` و `public/downloads/Rivo.apk` و `dist/downloads/`.
4. **تطبيق الآيفون (iOS .IPA):**
   - نسخ الـ IPA إلى `public/downloads/Rivo-v<VERSION>.ipa` و `public/downloads/Rivo.ipa` و `dist/downloads/`.

---

## 3. تحديث صفحة التحميل في الموقع (Download Screen)
- يجب التأكد من تحديث `src/screens/DownloadScreen.jsx`:
  - بطاقة Windows: تعرض أحدث إصدار ورابط `/downloads/Rivo.exe`.
  - بطاقة Android: تعرض أحدث إصدار ورابط `/downloads/Rivo-v<VERSION>.apk`.
  - بطاقة iOS: تعرض أحدث إصدار ورابط `/downloads/Rivo-v<VERSION>.ipa`.
- تنظيف النسخ القديمة التي تسبق الإصدار الجديد من مساحة القرص.

---

## 4. إرسال وتنبيه أصحاب النسخ القديمة بالتحديث (Update Notifications)
لضمان معرفة جميع مستخدمي النسخ السابقة بوجود إصدار جديد:
1. تحديث `APP_VERSIONS_DATA` في `server/index.js` بالإصدار الجديد وملاحظات التحديث.
2. إرسال تنبيه عبر Socket لجميع المستخدمين المتصلين من خلال استدعاء:
   ```
   GET /api/app/broadcast-update
   ```
3. في واجهة الويب والتطبيقات:
   - يظهر شريط تنبيه علوي فوري:
     `🎉 يتوفر إصدار جديد من ريفو (vX.X.X)! اضغط هنا للتحديث والاستمتاع بالميزات الجديدة.`
   - زر التحديث يوجه المستخدم مباشرة لصفحة التحميل `/download`.
4. في تطبيق الويندوز (`Rivo.exe`):
   - يفحص التحديثات تلقائياً عند الفتح.
   - إذا وجد إصداراً أحدث، يقوم بتنزيله في الخلفية وإعادة تشغيل البرنامج في نفس مكانه تلقائياً (In-place self-restart) بدون توجيه المستخدم لمتصفح خارجي أو إعادة تثبيت يدوية.
