# ACADEMIC STRUCTURE SPECIFICATION (PHASE 49)

## Overview
This document specifies the academic structure hierarchy, data schemas, multi-tenant boundaries, and permission rules for Academic Years, Stages, and Subjects in the REMAS Educational Center SaaS.

---

## 1. Domain Entities & Schemas

### Academic Year
- **Firestore Collection**: `/institutions/{institutionId}/academicYears/{id}`
- **Fields**:
  - `id`: String (`AY_<timestamp>_<rand>`)
  - `institutionId`: String
  - `name`: String (e.g., `2025/2026`)
  - `startDate`: String (ISO Date `YYYY-MM-DD`)
  - `endDate`: String (ISO Date `YYYY-MM-DD`)
  - `status`: String (`ACTIVE` | `ARCHIVED`)
  - `createdAt`: String (ISO Timestamp)
  - `updatedAt`: String (ISO Timestamp)

### Stage
- **Firestore Collection**: `/institutions/{institutionId}/stages/{id}`
- **Fields**:
  - `id`: String (`STG_<timestamp>_<rand>`)
  - `institutionId`: String
  - `name`: String (e.g., `الثانوية العامة`)
  - `code`: String (e.g., `STG-SEC`)
  - `academicYearId`: String
  - `status`: String (`ACTIVE` | `ARCHIVED`)
  - `createdAt`: String (ISO Timestamp)
  - `updatedAt`: String (ISO Timestamp)

### Subject
- **Firestore Collection**: `/institutions/{institutionId}/subjects/{id}`
- **Fields**:
  - `id`: String (`SUBJ_<timestamp>_<rand>`)
  - `institutionId`: String
  - `name`: String (e.g., `الفيزياء الحديثة`)
  - `code`: String (e.g., `PHYS`)
  - `stageIds`: Array of Strings
  - `status`: String (`ACTIVE` | `ARCHIVED`)
  - `createdAt`: String (ISO Timestamp)
  - `updatedAt`: String (ISO Timestamp)

---

## 2. Multi-Tenant Security Rules

- **Read Access**: Granted to authenticated users in the tenant (`isTenantUser(institutionId)`) or SuperAdmin (`isSuperAdmin()`).
- **Write Access**: Restricted to Tenant Admins (`isTenantAdmin(institutionId)`) or SuperAdmin (`isSuperAdmin()`).
- **Cross-Tenant Violation**: Attempts to read or mutate academic structure elements across different institution boundaries yield `PERMISSION_DENIED`.
