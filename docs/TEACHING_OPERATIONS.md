# Academic Operations & Teaching Workflow Architecture

## Overview

The Academic Operations & Teaching Workflow module (`firebase/academic_operations_service.js`) provides trusted backend lifecycle management for teaching group assignments, scheduled class sessions, schedule conflict prevention, and session attendance recording in REMAS Educational Center SaaS.

## Target Environment & Security Architecture

- **Target Firebase Project**: `educenter-saas`
- **Multi-Tenant Scope**: All operations mandate `institutionId` isolation.
- **Client Direct Writes**: Direct Firestore writes to `/sessions`, `/attendanceSessions`, and `/attendanceRecords` are DENIED in Firestore security rules (`allow write: if false`). All mutations execute via the Trusted Backend API.

## Data Schema Taxonomy

### 1. `/sessions/{sessionId}`
```json
{
  "id": "sess_1725800000000_123",
  "institutionId": "inst_001",
  "groupId": "grp_001",
  "subjectId": "sub_physics",
  "teacherId": "tch_001",
  "roomId": "room_101",
  "title": "حصة الفيزياء - قوانين الحركة",
  "sessionDate": "2026-09-10",
  "startTime": "10:00",
  "endTime": "12:00",
  "status": "SCHEDULED",
  "notes": "",
  "createdAt": "2026-09-08T00:00:00.000Z",
  "updatedAt": "2026-09-08T00:00:00.000Z"
}
```

### 2. `/attendanceRecords/{recordId}`
```json
{
  "id": "att_rec_sess_123_stu_456",
  "institutionId": "inst_001",
  "sessionId": "sess_1725800000000_123",
  "groupId": "grp_001",
  "studentId": "stu_456",
  "status": "PRESENT",
  "lateMinutes": 0,
  "notes": "",
  "recordedBy": "usr_owner_inst1",
  "createdAt": "2026-09-08T00:00:00.000Z",
  "updatedAt": "2026-09-08T00:00:00.000Z"
}
```

## Role Authorization & RBAC

| Role | Operations Allowed | Boundary Enforcement |
| :--- | :--- | :--- |
| `superAdmin` | Global full access across all institutions | Must specify `targetInstitutionId` |
| `institutionOwner` | Full access within assigned institution | Scoped strictly to `callerToken.institutionId` |
| `admin` | Full access within assigned institution | Scoped strictly to `callerToken.institutionId` |
| `teacher` | Sessions & attendance for assigned groups only | Rejects unassigned group/session operations (`TEACHER_NOT_ASSIGNED_TO_GROUP`) |
| `student` | Read-only access to own group sessions | Direct administrative writes DENIED (`UNAUTHORIZED_CALLER_ROLE`) |
| `parent` | Read-only access to linked children sessions | Direct administrative writes DENIED (`UNAUTHORIZED_CALLER_ROLE`) |

## Teaching Session Status Lifecycle

```
[ SCHEDULED ] ───► [ IN_PROGRESS ] ───► [ COMPLETED ] (Terminal State)
      │                   │
      └───────────────────┴───► [ CANCELLED ] (Terminal State)
```

## Auditable System Events

1. `TEACHING_ASSIGNMENT_CHANGED`: Qualified teacher assigned to group.
2. `SESSION_CREATED`: Scheduled teaching session created.
3. `SESSION_UPDATED`: Session details updated.
4. `SESSION_STATUS_CHANGED`: Session status transition.
5. `SESSION_ATTENDANCE_RECORDED`: Attendance records created for session roster.
