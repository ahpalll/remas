# Phase 17: Advanced Notifications & Push Notification System — Architecture Plan

---

## 1. Executive Summary & Core Objectives

Phase 17 implements a centralized, multi-tenant **Notifications and Push Notification System** across the SaaS platform.

### Core Objectives:
1. **Trusted Backend Gateway (`firebase/notification_service.js`)**:
   - `registerDevice(callerToken, payload)`: Registers client devices (FCM token, platform, appType) deriving `userId` and `institutionId` from verified token claims.
   - `refreshDeviceToken(callerToken, payload)` & `unregisterDevice(callerToken, payload)`: Token lifecycle and cleanup.
   - `sendTargetedNotification(callerToken, payload)` & `sendBroadcastNotification(callerToken, payload)`: Role-checked, tenant-isolated notification sending with idempotency (`dedupeKey`/`eventId`).
   - `getNotifications(callerToken, payload)`: Fetches user notifications. For parents, automatically queries linked children notifications only.
   - `markNotificationRead(callerToken, payload)` & `markAllNotificationsRead(callerToken, payload)`: Safe read status update.
   - `updateNotificationPreferences(callerToken, payload)`: User category preferences management.
2. **Category Whitelist & Deep Linking**:
   - Categories: `ATTENDANCE`, `GRADE`, `EXAM`, `ONLINE_EXAM`, `CONTENT`, `SUBSCRIPTION`, `SCHEDULE`, `SYSTEM`, `ANNOUNCEMENT`.
   - Deep Linking payloads (`category`, `entityId`, `targetScreen`).
3. **Security Invariants**:
   - FCM credentials and Admin keys are NEVER exposed in clients or stored in Firestore.
   - Parent A can ONLY access notifications belonging to linked children (`Child A`). Cross-parent access is DENIED.
   - Tenant isolation enforced (`Tenant A Admin` cannot broadcast to `Tenant B`).
   - Direct client writes to notifications or delivery logs are DENIED in Firestore Rules.
4. **Multi-Platform UI & Testing**:
   - Admin Web RTL Notification Dashboard (`admin-web/src/components/notifications/NotificationDashboard.tsx`).
   - Student App Notification Screen (`student_app/lib/screens/notifications_screen.dart`).
   - Parent App Notification Screen (`parent_app/lib/screens/notifications_screen.dart`).
   - Automated tests: 192 Rules assertions + 35 Notification Backend assertions + 15 Student Flutter unit assertions + 15 Parent Flutter unit assertions (Total **695 Executed Assertions**).

---

## 2. Architecture & Data Flow

```
[ Admin Web / Trigger Event ] ──► [ Trusted Backend (notification_service.js) ]
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   ▼                                             ▼
       [ Firestore Audit/History ]                      [ FCM Push Gateway ]
  /institutions/{inst}/notifications              (Mocked/Emulator-Safe Handler)
  /institutions/{inst}/devices                                   │
                   │                                             ▼
                   └─────────────────────────────► [ Student & Parent Mobile Apps ]
```
