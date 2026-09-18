# GROUP MANAGEMENT SPECIFICATION (PHASE 49)

## Overview
This document specifies group management, room allocation, capacity tracking, teacher assignment, and student group enrollment in REMAS Educational Center SaaS.

---

## 1. Group Document Schema
- **Firestore Path**: `/institutions/{institutionId}/groups/{id}`
- **Fields**:
  - `id`: String (`GRP_<timestamp>_<rand>`)
  - `institutionId`: String
  - `name`: String (e.g., `مجموعة التفوق`)
  - `academicYearId`: String
  - `stageId`: String
  - `subjectId`: String
  - `subjectName`: String
  - `teacherId`: String
  - `teacherName`: String
  - `roomId`: String
  - `room`: String (e.g., `قاعة 1`)
  - `maxCapacity`: Number (Default 30)
  - `enrolledCount`: Number
  - `monthlyFee`: Number (e.g., 300 LE)
  - `schedule`: String (e.g., `الأحد والأربعاء 04:00 مساءً`)
  - `status`: String (`ACTIVE` | `ARCHIVED`)
  - `createdAt`: String (ISO Timestamp)
  - `updatedAt`: String (ISO Timestamp)

---

## 2. Group Enrollment Engine

- **Canonical Relationship**:
  - Student document stores `groupIds` (Array of enrolled group IDs).
  - Adding a student to a group appends `groupId` to `student.groupIds` and increments `group.enrolledCount`.
  - Removing a student from a group filters `groupId` out of `student.groupIds` and decrements `group.enrolledCount`.
- **Capacity Control**:
  - Center Desktop UI tracks `enrolledCount / maxCapacity` in real-time.
