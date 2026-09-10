# Phase 38 — Full Windows Center Desktop Architecture & Implementation

## Executive Summary
In Phase 38, the standalone Windows Center Desktop application (`remas-center-desktop`) was transformed from a hardware license status display shell into a comprehensive, desktop-first educational center management suite.

The desktop renderer now provides 15 operational modules accessed through a modern Arabic RTL interface with responsive topbar, sidebar navigation, dynamic main workspace, fast attendance scanner, payment receipt generator, and single-device hardware fingerprint binding overlay.

---

## Technical Architecture & Design System

### Core Desktop Stack
- **Runtime**: Electron `^30.0.0`
- **Main Process**: [main.js](file:///f:/remas/center-desktop/main.js)
- **Preload Isolation**: [preload.js](file:///f:/remas/center-desktop/preload.js) via `contextBridge` (`window.electronAPI.callBackendService`)
- **Desktop Backend Data Engine**: [center_desktop_services.js](file:///f:/remas/center-desktop/src/center_desktop_services.js)
- **Renderer Shell & Layout**: [index.html](file:///f:/remas/center-desktop/index.html)
- **Renderer UI Controller**: [desktop_app.js](file:///f:/remas/center-desktop/src/desktop_app.js)

### Security & Packaging Isolation Contract
1. **Zero External Directory Dependencies**: `center-desktop/main.js` requires only internal files within `center-desktop/`, maintaining strict portability for Electron packaging (`app.asar`).
2. **Zero API Key Exposure**: Production AI keys (Gemini / OpenRouter) are managed exclusively by SuperAdmin and stored in Firebase Functions Secret Manager. The Center Desktop renderer and backend service have zero access to raw secret keys.
3. **Single Device Fingerprint Binding**: Hardware fingerprint (`win_fp_...`) is verified at startup against registered license bindings. If revoked or unbound, an interactive overlay locks the application UI and displays device information with a rebind request option.
4. **72-Hour Offline Grace Period**: Centers can operate offline for up to 72 hours before online license heartbeat verification is required.

---

## 15 Operational Modules

| # | Module Name (Arabic / English) | Key Capabilities | Service Function |
|---|--------------------------------|------------------|------------------|
| 1 | **لوحة التحكم** (Dashboard) | Real-time metrics (students, revenue, monthly income, active groups, daily attendance rate), recent transaction feed | `getDashboardSummary` |
| 2 | **إدارة الطلاب** (Students) | Student directory, registration modal, search, edit, status toggle (Active/Inactive), parent link | `getStudents`, `createStudent` |
| 3 | **المعلمون** (Teachers) | Teacher directory, subject assignment, contact details, status | `getTeachers`, `createTeacher` |
| 4 | **المجموعات والمواد** (Groups & Subjects) | Group creation, capacity check (`maxCapacity`), subject assignment, schedule & teacher mapping | `getGroups`, `createGroup` |
| 5 | **كشك الحضور والغياب** (Attendance Kiosk) | Fast barcode / QR code scanning, manual attendance entry, status (مأكّد / متأخر / غائب) | `recordAttendance` |
| 6 | **جدول الحصص** (Schedule) | Session list, date & classroom filtering, duplicate session creation validation | `getSessions`, `createSession` |
| 7 | **المحتوى التعليمي** (Educational Content) | Lesson materials, video links, presigned Cloudflare R2 media gateway integration | `getContent` |
| 8 | **الاختبارات والدرجات** (Exams & Grades) | Exam creation, max score definition, student grade recording & validation | `getExams`, `recordGrade` |
| 9 | **الاشتراكات والباقات** (Subscriptions) | Student subscription plans, activation code redemption, entitlement status | `getSubscriptions` |
| 10 | **أولياء الأمور** (Parents) | Parent accounts, student linking (`studentIds`), parent phone search | `getParents` |
| 11 | **المالية والحسابات** (Finance) | Student tuition payments, receipt generation, center operational expense entry, balance ledger | `recordPayment`, `recordExpense` |
| 12 | **التقارير والإحصائيات** (Reports) | Attendance summaries, financial balance ledger, group enrollment reports | `getReports` |
| 13 | **إعدادات الذكاء الاصطناعي** (AI Settings) | Center AI usage quota, prompt customization, tutor enablement status | `getAISettings`, `updateAISettings` |
| 14 | **معلومات السنتر** (Center Info) | Center name, phone, address, currency, print logo/header setup | `getCenterInfo`, `updateCenterInfo` |
| 15 | **الترخيص والجهاز** (License & Device) | Device hardware fingerprint, host name, OS info, online status, binding status, rebind request flow | `getLicenseStatus`, `requestRebind` |

---

## Verification & Test Suite

Automated verification suite: [windows_desktop_full.test.js](file:///f:/remas/firebase/windows_desktop_full.test.js) (25 Assertions, 100% PASS).

- `npm run test:desktop_full` -> PASS (25/25)
- Monorepo backend suite (`npm run test:all`) -> PASS (911/911)
- Flutter test suites (Student, Teacher, Parent) -> PASS
- Web apps (`admin-web`, `parent-portal`) -> Built Clean
- Windows Installer -> `remas-center-desktop Setup 1.0.0-release.38.exe`

---

## Production Release Artifact
- Installer: `center-desktop/dist/remas-center-desktop Setup 1.0.0-release.38.exe`
- Target Version: `1.0.0-release.38`
- Target Firebase Project: `educenter-saas` (`educenter-saas-860c5`)
