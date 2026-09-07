# Student Enrollment & Group Operations Architecture

## Overview

The Student Enrollment & Group Operations module (`firebase/student_enrollment_service.js`) provides trusted backend lifecycle management for students, class group definitions, capacity tracking, active group enrollments, and guardian profile linking in REMAS Educational Center SaaS.

## Target Environment & Security Architecture

- **Target Firebase Project**: `educenter-saas`
- **Multi-Tenant Scope**: All operations mandate `institutionId` isolation.
- **Client Direct Writes**: Direct Firestore writes to `/students`, `/groups`, `/enrollments`, `/guardians`, `/studentGuardians` are DENIED in Firestore security rules (`allow write: if false`). All mutations execute via the Trusted Backend API.

## Data Schema Taxonomy

### 1. `/students/{studentId}`
```json
{
  "id": "stu_1725700000000_123",
  "institutionId": "inst_001",
  "studentCode": "STU-2026-X89A2K",
  "fullName": "أحمد محمود العلي",
  "phone": "+201012345678",
  "parentPhone": "+201098765432",
  "stageId": "stage_sec",
  "gradeId": "grade_sec_1",
  "status": "ACTIVE",
  "qrTokenHash": "a1b2c3d4e5f6...",
  "registrationDate": "2026-09-08T00:00:00.000Z",
  "notes": "",
  "createdAt": "2026-09-08T00:00:00.000Z",
  "updatedAt": "2026-09-08T00:00:00.000Z"
}
```

### 2. `/groups/{groupId}`
```json
{
  "id": "grp_1725700000000_456",
  "institutionId": "inst_001",
  "name": "مجموعة الفيزياء - الصف الأول الثانوي",
  "subjectId": "sub_physics",
  "teacherId": "tch_001",
  "roomId": "room_101",
  "stageId": "stage_sec",
  "gradeId": "grade_sec_1",
  "maxCapacity": 25,
  "enrolledCount": 12,
  "schedule": [],
  "feePerSession": 100,
  "status": "ACTIVE",
  "createdAt": "2026-09-08T00:00:00.000Z",
  "updatedAt": "2026-09-08T00:00:00.000Z"
}
```

### 3. `/enrollments/{enrollmentId}`
```json
{
  "id": "enr_1725700000000_789",
  "institutionId": "inst_001",
  "studentId": "stu_1725700000000_123",
  "groupId": "grp_1725700000000_456",
  "status": "ENROLLED",
  "enrolledAt": "2026-09-08T00:00:00.000Z",
  "updatedAt": "2026-09-08T00:00:00.000Z"
}
```

## Role Authorization & RBAC

| Role | Operations Allowed | Boundary Enforcement |
| :--- | :--- | :--- |
| `superAdmin` | Global full access across all institutions | Must specify `targetInstitutionId` |
| `institutionOwner` | Full access within assigned institution | Scoped strictly to `callerToken.institutionId` |
| `admin` | Full access within assigned institution | Scoped strictly to `callerToken.institutionId` |
| `teacher` | Read-only access to assigned groups/students | Direct administrative writes DENIED (`UNAUTHORIZED_CALLER_ROLE`) |
| `student` | Read-only access to own profile | Administrative writes DENIED (`UNAUTHORIZED_CALLER_ROLE`) |
| `parent` | Read-only access to linked children | Administrative writes DENIED (`UNAUTHORIZED_CALLER_ROLE`) |

## Student Status Lifecycle

```
[ ACTIVE ] ───► [ SUSPENDED ] ───► [ ACTIVE ]
    │                 │
    ├─────────► [ WITHDRAWN ] ───► [ ARCHIVED ]
    │                 │
    ├─────────► [ GRADUATED ] ───► [ ARCHIVED ]
    │
    └─────────► [ ARCHIVED ] (Terminal State)
```

## Auditable System Events

1. `STUDENT_ENROLLED`: Student profile created and code/QR generated.
2. `STUDENT_UPDATED`: Student profile updated.
3. `STUDENT_STATUS_CHANGED`: Student status transition.
4. `STUDENT_QR_REGENERATED`: Fresh raw token issued and hash updated.
5. `GROUP_CREATED`: Class group defined with max capacity.
6. `GROUP_UPDATED`: Group max capacity or details updated.
7. `GROUP_STATUS_CHANGED`: Group operational status updated.
8. `STUDENT_GROUP_ASSIGNED`: Student enrolled in group with capacity counter increment.
9. `STUDENT_GROUP_WITHDRAWN`: Student enrollment withdrawn with capacity counter decrement.
10. `STUDENT_GUARDIAN_LINKED`: Guardian profile linked to student.
