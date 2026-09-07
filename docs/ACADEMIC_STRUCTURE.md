# Academic Structure & Teacher Operations Specification

## Overview
This document specifies the academic structure architecture, subject catalog taxonomy, teacher profiles management, and subject/level assignment engine for REMAS Educational Center SaaS.

---

## 1. Architectural Hierarchy

```
Institution (Tenant Boundary)
 │
 ├── Academic Levels / Grades (stages)
 │    ├── Name: e.g., "الصف الأول الثانوي"
 │    ├── Code: e.g., "sec_1"
 │    ├── Order: Integer sort index (1, 2, 3...)
 │    └── Status: ACTIVE | DISABLED | ARCHIVED
 │
 ├── Subjects Catalog (subjects)
 │    ├── Name: e.g., "الفيزياء"
 │    ├── Code: e.g., "physics"
 │    ├── Stage Link: Linked to Level ID or Global (null)
 │    └── Status: ACTIVE | DISABLED | ARCHIVED
 │
 └── Teacher Profiles (teachers)
      ├── User Link: Linked to Authentication Identity (UID)
      ├── Email: Teacher email
      ├── Phone: Phone number
      ├── Specialization: Academic discipline
      ├── Subject Assignments: Array of Subject IDs
      ├── Level Assignments: Array of Level IDs
      └── Status: ACTIVE | DISABLED | ARCHIVED
```

---

## 2. Multi-Tenant Authorization & Privilege Matrix

| Operation | SuperAdmin | Tenant Admin (`institutionOwner`, `admin`) | Teacher | Student / Parent |
| :--- | :---: | :---: | :---: | :---: |
| **Create / Edit Academic Level** | ALL | OWN TENANT ONLY | DENIED | DENIED |
| **Disable / Status Level** | ALL | OWN TENANT ONLY | DENIED | DENIED |
| **Create / Edit Subject** | ALL | OWN TENANT ONLY | DENIED | DENIED |
| **Disable / Status Subject** | ALL | OWN TENANT ONLY | DENIED | DENIED |
| **Create / Edit Teacher Profile** | ALL | OWN TENANT ONLY | DENIED | DENIED |
| **Assign Subjects/Levels to Teacher** | ALL | OWN TENANT ONLY | DENIED | DENIED |
| **Read Levels / Subjects / Teachers** | ALL | OWN TENANT ONLY | OWN TENANT ONLY | OWN TENANT ONLY |

---

## 3. Auditable Events & Data Boundary Safety

All academic structure operations produce structured audit log events:
- `ACADEMIC_LEVEL_CREATED`
- `ACADEMIC_LEVEL_UPDATED`
- `ACADEMIC_LEVEL_STATUS_CHANGED`
- `SUBJECT_CREATED`
- `SUBJECT_UPDATED`
- `SUBJECT_STATUS_CHANGED`
- `TEACHER_CREATED`
- `TEACHER_UPDATED`
- `TEACHER_STATUS_CHANGED`
- `TEACHER_ASSIGNMENT_CHANGED`

Zero passwords, bearer tokens, or private keys are recorded in log payloads or Firestore document structures.
