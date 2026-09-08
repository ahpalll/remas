# Real Production Center Operations Workflow Architecture

## Overview

The Production Center Operations module (`firebase/center_operations_service.js`) provides an end-to-end orchestration and readiness verification layer for REMAS Educational Center SaaS. It binds all operational entities—Institutions, Academic Levels, Subjects, Teachers, Groups, Students, Teacher Assignments, Teaching Sessions, and Attendance Records—into a unified workflow.

---

## Complete Tenant Admin Operational Lifecycle Flow

```
1. Institution Provisioning (createInstitution)
       │
       ▼
2. Academic Structure Definition (createAcademicLevel, createSubject)
       │
       ▼
3. Teacher Onboarding & Qualifications (createTeacherProfile, assignTeacherQualifications)
       │
       ▼
4. Class Group Definition & Capacity Setup (createGroup with maxCapacity)
       │
       ▼
5. Student Registration & Group Enrollment (createStudent, enrollStudentInGroup)
       │
       ▼
6. Qualified Teacher Group Assignment (assignTeacherToGroup with qualification check)
       │
       ▼
7. Session Scheduling & Lifecycle (createSession, setSessionStatus)
       │ (SCHEDULED ➔ IN_PROGRESS ➔ COMPLETED)
       ▼
8. Roster Attendance Recording (recordSessionAttendance - PRESENT/LATE/ABSENT/EXCUSED)
```

---

## Security & Boundary Protections

1. **Multi-Tenant Scoping**: Every mutation and query mandates strict `institutionId` isolation.
2. **Teacher Qualification Guard**: Group teacher assignment verifies active status, subject qualification, and level qualification before saving.
3. **Session Schedule Conflict Guard**: Prevents scheduling overlapping sessions for the same room and date (`SESSION_SCHEDULE_CONFLICT`).
4. **Group Capacity Guard**: Enforces `maxCapacity` on class groups during student enrollment.
5. **Session Roster Authorization**: Teachers can only record attendance for sessions of groups they are assigned to (`TEACHER_NOT_ASSIGNED_TO_GROUP`).
6. **Audit Event Generation**: Emits auditable system logs for all operational lifecycle transitions (`CENTER_WORKFLOW_VERIFIED`, `TEACHING_ASSIGNMENT_CHANGED`, `SESSION_CREATED`, `SESSION_ATTENDANCE_RECORDED`).

---

## Verification & Operational Statuses

- **`PRODUCTION_CONNECTED`**: Live Firebase Admin SDK connected to `educenter-saas`.
- **`PRODUCTION_DATA_READY`**: System metadata and primary institution tenant configured.
- **`APPLICATION_OPERATIONAL`**: End-to-end workflow operational and operational metrics retrieved.
