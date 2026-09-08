# Reception Kiosk QR Attendance Scanner Specification

## Overview & Architecture
The **Fast Reception Kiosk QR Attendance Scanner Mode** is designed for educational center receptionists to register student attendance in high-density throughput environments (e.g., peak arrival hours before session start).

- **Location**: `admin-web/src/components/attendance/ReceptionKioskQRScanner.tsx`
- **Target Platform**: Admin Web Portal & Local Kiosk Terminals
- **Tenant Target**: `educenter-saas`

---

## Technical Features & Protocol

### 1. Continuous Rapid Scanning Input Stream
- Hardware USB/Bluetooth Barcode Readers interact as keyboard emulation streams into an auto-focused, border-highlighted input field.
- After each scan, the input buffer automatically resets and re-establishes cursor focus (`inputRef.current.focus()`).

### 2. Security & Hashing Safeguards
- **Zero Raw Secret Storage**: The Kiosk never stores or logs unhashed QR secrets.
- **Tenant Verification**: Each scanned token includes tenant payload claims (`STU_<studentId>_<tenantId>_<hash>`). Cross-tenant tokens trigger an immediate `UNAUTHORIZED` security block.

### 3. Verification & Error State Mapping

| Status Code | Visual Badge Color | Arabic Display Message | Cause / Rule Triggered |
| :--- | :--- | :--- | :--- |
| `SUCCESS` | Green (`#1b5e20`) | تم تسجيل الحضور بنجاح | Active session matching tenant student token; first time recorded. |
| `ALREADY_RECORDED` | Orange (`#e65100`) | حضور مسجل بالفعل لهذه الجلسة | Duplicate scan attempt for the same student in the same session. |
| `INVALID_QR` | Red (`#b71c1c`) | رمز QR غير صالح أو منتهي الصلاحية | Token malformed, length < 3, or checksum invalid. |
| `STUDENT_NOT_FOUND` | Pink/Red (`#880e4f`) | لم يتم العثور على سجل طالب مطبق | Student record does not exist in target institution database. |
| `SESSION_NOT_FOUND` | Purple (`#4a148c`) | خطأ: لم يتم اختيار جلسة حضور نشطة | Session is closed, cancelled, or unselected. |
| `UNAUTHORIZED` | Deep Purple (`#311b92`) | مرفوض: الطالب ينتمي لمؤسسة أخرى | Token tenant ID does not match active institution ID (`Tenant Leak`). |

---

## Real-Time Kiosk Audit Stream
- Maintains an in-memory & audit log stream of up to 50 recent scans.
- Captures `logId`, `timestamp`, `studentToken`, `studentName`, `sessionId`, `status`, and `message`.

---

## Audit & Compliance
All successful kiosk scans emit structured audit logs to Firestore under `/institutions/{tenantId}/auditLogs/` with event `KIOSK_QR_ATTENDANCE_RECORDED`.
