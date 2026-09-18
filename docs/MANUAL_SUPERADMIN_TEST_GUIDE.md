# REMAS EDU — SuperAdmin Android App Manual Testing Guide

## 1. Overview & Objectives

This document serves as the step-by-step, non-technical manual acceptance guide for the **REMAS Educational Center SaaS — SuperAdmin Mobile Control Center Android App** (`superadmin_app`).

The guide allows the product owner or platform operator to execute end-to-end manual verification across all **11 SuperAdmin screens** (`SA-001` through `SA-011`) on a physical Android smartphone or Android emulator.

---

## 2. Test Environment & Prerequisites

- **Target APK**: `superadmin_app/build/app/outputs/flutter-apk/app-release.apk`
- **Application Package**: `com.remasedu.superadmin`
- **Target Firebase Project**: `educenter-saas-860c5`
- **SuperAdmin Account**: `admin@remas.edu`
- **Required Claims**: `{ role: 'superAdmin' }`
- **Device Support**: Android 8.0+ (API Level 26+)

> [!IMPORTANT]
> - Do **NOT** expose or print passwords in test documentation. Use the securely provisioned platform credentials.
> - Verify that the Android device has an active Wi-Fi or cellular data connection to communicate with Cloud Firestore.

---

## 3. Step-by-Step Screen Test Matrix

### Test 01 — SA-001: SuperAdmin Login Screen
- **Screen ID**: `SA-001`
- **Arabic Name**: شاشة تسجيل دخول المدير العام
- **Preconditions**: Fresh installation of `app-release.apk`.
- **Test Steps**:
  1. Open the app from the Android home launcher.
  2. Confirm the branded splash screen displays the official REMAS EDU logo and dark glassmorphism styling.
  3. Enter an invalid email (e.g. `wrong@remas.edu`) and tap **تسجيل الدخول**.
  4. Verify that an Arabic error message is displayed (`بيانات الدخول غير صحيحة` or `غير مصرح بالوصول`).
  5. Enter valid SuperAdmin credentials (`admin@remas.edu` + valid password) and tap **تسجيل الدخول**.
- **Expected Result**:
  - Credentials and `{ role: 'superAdmin' }` custom claim are validated against Firebase Auth.
  - User is successfully authenticated and navigated to the SuperAdmin Overview Dashboard (`SA-002`).
  - Closing and reopening the app preserves the authenticated session.
- **Evidence to Capture**: Screenshot of Login Screen & Error Feedback message.

---

### Test 02 — SA-002: Overview Dashboard Screen
- **Screen ID**: `SA-002`
- **Arabic Name**: لوحة تحكم منصة ريماس التعليمية
- **Preconditions**: User successfully logged in as `admin@remas.edu`.
- **Test Steps**:
  1. Inspect the main metric cards at the top of the screen:
     - **إجمالي السناتر المسجلة** (Total Institutions)
     - **التراخيص النشطة** (Active Licenses)
     - **الأجهزة المربوطة** (Bound Devices)
     - **حسابات المستخدمين** (Total Accounts)
  2. Verify that values are loaded directly from live Cloud Firestore collections (`/institutions`, `/licenses`, `/deviceBindings`, `/users`).
  3. Tap each navigation action card (**إدارة السناتر**, **التراخيص**, **الأجهزة**, **إعدادات الذكاء الاصطناعي**).
- **Expected Result**:
  - Live data counts match Firestore records without static or fake hardcoded numbers.
  - Navigation cards smoothly transition to the corresponding management screens.
- **Evidence to Capture**: Screenshot of SuperAdmin Overview Dashboard.

---

### Test 03 — SA-003: Institutions Management Screen
- **Screen ID**: `SA-003`
- **Arabic Name**: شاشة إدارة السناتر التعليمية
- **Preconditions**: Navigated from Dashboard or bottom navigation menu.
- **Test Steps**:
  1. Review the list of educational centers (`inst_remas001`, `inst_remas002`, `inst_phase48`).
  2. Inspect each card displaying Center Name, Institution Code, Status Badge (`نشط` / `معلق`), Student Count, and Teacher Count.
  3. Tap on an institution card (e.g. `inst_phase48`) to view detailed metadata.
- **Expected Result**:
  - Institutions list loads accurately from `/institutions` in Firestore.
  - Status badges clearly distinguish `ACTIVE` centers from `SUSPENDED` centers.
- **Evidence to Capture**: Screenshot of Institutions List & Detail View.

---

### Test 04 — SA-004: Center 5-Step Guided Onboarding Wizard
- **Screen ID**: `SA-004`
- **Arabic Name**: معالج إضافة سنتر جديد (5 خطوات)
- **Preconditions**: Tap **+ إضافة سنتر جديد** button on `SA-003`.
- **Test Steps**:
  1. **Step 1 (بيانات السنتر)**: Enter Center Name (e.g. `سنتر النجاح التعليمي`) and Code (e.g. `SUCCESS001`). Tap Next.
  2. **Step 2 (دعوة مالك السنتر)**: Enter Owner Email (e.g. `owner.success@remas.edu`) and Owner Name. Tap Next.
  3. **Step 3 (تخصيص الترخيص)**: Select Plan (PRO / ENTERPRISE) and Expiry Duration. Tap Next.
  4. **Step 4 (ربط الجهاز)**: Confirm Single-Device Binding Policy. Tap Next.
  5. **Step 5 (التأكيد والإنشاء)**: Review summary and tap **إنشاء السنتر وإصدار الدعوة**.
- **Expected Result**:
  - Institution record is created under `/institutions/inst_success001`.
  - Pending invitation is written to `/invitations/inv_...`.
  - License is written to `/licenses/lic_...` with status `ACTIVE`.
  - Success dialog displays instructions for running the local CLI provisioning script.
- **Evidence to Capture**: Screenshots of Wizard Steps 1 through 5 and Confirmation Dialog.

---

### Test 05 — SA-005: License Operations & Lifecycle Screen
- **Screen ID**: `SA-005`
- **Arabic Name**: شاشة إدارة تراخيص التشغيل
- **Preconditions**: Navigated to Licenses tab.
- **Test Steps**:
  1. Review active licenses list (`lic_remas001`, `lic_phase48`).
  2. Inspect License Code format (`REMAS-XXXX-YYYY-ZZZZ`), Institution ID, Expiry Date, and Status Badge.
  3. Tap on a license action menu:
     - Test **إيقاف مؤقت (Suspend)**: Confirm status changes to `SUSPENDED`.
     - Test **إعادة تفعيل (Activate)**: Confirm status returns to `ACTIVE`.
- **Expected Result**:
  - License lifecycle state changes immediately in Cloud Firestore (`/licenses/{licenseId}`).
  - Center Desktop applications attached to a suspended license are blocked from operational access.
- **Evidence to Capture**: Screenshots of Active, Suspended, and Restored License status badges.

---

### Test 06 — SA-006: Hardware Security & Device Bindings Screen
- **Screen ID**: `SA-006`
- **Arabic Name**: شاشة ربط وتأمين أجهزة التشغيل
- **Preconditions**: Navigated to Device Bindings tab.
- **Test Steps**:
  1. Review list of bound hardware devices across institutions.
  2. Verify fields: Device ID, Hardware Fingerprint hash (truncated), Institution ID, License ID, Status (`BOUND` / `UNBOUND` / `REVOKED`).
  3. Tap **فك ربط الجهاز (Release/Unbind)** for a test binding.
  4. Confirm the safety dialog and execute unbind.
- **Expected Result**:
  - Binding document status updates to `UNBOUND` in Firestore (`/deviceBindings/{bindingId}`).
  - The center owner can now bind a new desktop device upon next login.
- **Evidence to Capture**: Screenshots of Device Binding List & Unbind Confirmation Dialog.

---

### Test 07 — SA-007: User Accounts & RBAC Claims Screen
- **Screen ID**: `SA-007`
- **Arabic Name**: شاشة إدارة حسابات المنصة والأدوار
- **Preconditions**: Navigated to User Accounts view.
- **Test Steps**:
  1. View top-level user account entries stored under `/users`.
  2. Verify Custom Claim role badges:
     - `superAdmin` (Purple Badge)
     - `institutionOwner` (Blue Badge)
     - `teacher` (Green Badge)
     - `student` (Orange Badge)
     - `parent` (Teal Badge)
  3. Verify that non-privileged account modification attempts are strictly rejected by Security Rules.
- **Expected Result**:
  - All accounts accurately reflect their assigned role and institution scope.
  - Impersonation or role elevation attempts are denied.
- **Evidence to Capture**: Screenshot of User Accounts list showing role badges.

---

### Test 08 — SA-008: AI Provider & Key Security Screen
- **Screen ID**: `SA-008`
- **Arabic Name**: شاشة إعدادات الذكاء الاصطناعي والحصص
- **Preconditions**: Navigated to AI Control Screen.
- **Test Steps**:
  1. Inspect the AI Provider selection toggle (**Google Gemini** vs **OpenRouter**).
  2. Inspect the Model Selection dropdown (e.g. `gemini-1.5-pro`, `claude-3-5-sonnet`).
  3. Verify that API keys are stored securely on server/trusted side and are **NEVER** displayed in plaintext in the mobile UI.
  4. Check center quota usage meters.
- **Expected Result**:
  - Zero plaintext API keys or credentials exposed in the client UI.
  - Provider toggles and quota limits update in Firestore configuration (`/system/ai_config`).
- **Evidence to Capture**: Screenshot of AI Control Panel showing key redaction and provider options.

---

### Test 09 — SA-009: System Health & Infrastructure Screen
- **Screen ID**: `SA-009`
- **Arabic Name**: شاشة حالة وحجم النظام والبنية التحتية
- **Preconditions**: Navigated to System Health tab.
- **Test Steps**:
  1. Review platform connection indicators:
     - **Cloud Firestore**: Connected / Operational
     - **Firebase Auth**: Operational
     - **Cloudflare R2 Storage**: Operational
  2. Inspect latency indicators and active build version (`1.0.0-release.49.8`).
- **Expected Result**:
  - Health indicators correctly reflect live connectivity without artificial dummy data.
- **Evidence to Capture**: Screenshot of System Health Monitoring Panel.

---

### Test 10 — SA-010: Usage & Analytics Screen
- **Screen ID**: `SA-010`
- **Arabic Name**: شاشة تحليلات الاستهلاك والتخزين
- **Preconditions**: Navigated to Usage Analytics tab.
- **Test Steps**:
  1. Review center storage usage meters (PDFs, Images, Video Streaming bandwidth).
  2. Inspect student subscription entitlement counts per center.
- **Expected Result**:
  - Analytics graphs and progress bars accurately render stored resource metrics.
- **Evidence to Capture**: Screenshot of Usage & Entitlement Analytics Screen.

---

### Test 11 — SA-011: Security Event & Audit Logs Screen
- **Screen ID**: `SA-011`
- **Arabic Name**: شاشة سجلات الأمان والتدقيق
- **Preconditions**: Navigated to Security Audit Logs tab.
- **Test Steps**:
  1. Review the real-time security audit log stream.
  2. Verify fields: Timestamp, Actor UID, Action Type (e.g. `LICENSE_SUSPENDED`, `DEVICE_UNBOUND`), Target ID, and Institution ID.
  3. Filter logs by Action Type or Institution ID.
- **Expected Result**:
  - Audit log entries populate chronologically from `/auditLogs`.
  - Sensitive passwords or authentication secrets are never recorded in audit entries.
- **Evidence to Capture**: Screenshot of Audit Logs list.

---

## 4. Manual Acceptance Summary Table

| Test ID | Screen ID | Arabic Screen Name | Target Role | Expected Status |
|:---|:---|:---|:---|:---|
| **TEST-01** | `SA-001` | شاشة تسجيل دخول المدير العام | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-02** | `SA-002` | لوحة تحكم منصة ريماس | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-03** | `SA-003` | شاشة إدارة السناتر التعليمية | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-04** | `SA-004` | معالج إضافة سنتر جديد (5 خطوات) | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-05** | `SA-005` | شاشة إدارة تراخيص التشغيل | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-06** | `SA-006` | شاشة ربط وتأمين أجهزة التشغيل | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-07** | `SA-007` | شاشة إدارة حسابات المنصة والأدوار | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-08** | `SA-008` | شاشة إعدادات الذكاء الاصطناعي | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-09** | `SA-009` | شاشة حالة وحجم النظام | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-10** | `SA-010` | شاشة تحليلات الاستهلاك والتخزين | superAdmin | `PENDING` (Product Owner Test) |
| **TEST-11** | `SA-011` | شاشة سجلات الأمان والتدقيق | superAdmin | `PENDING` (Product Owner Test) |
