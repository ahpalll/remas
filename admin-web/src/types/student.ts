export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN' | 'GRADUATED' | 'ARCHIVED';
export type EnrollmentStatus = 'ENROLLED' | 'WITHDRAWN' | 'COMPLETED';
export type GuardianRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';

export interface Student {
  id: string;
  institutionId: string;
  userId?: string;
  studentCode: string;
  qrTokenHash: string;
  fullName: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE';
  status: StudentStatus;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Enrollment {
  id: string;
  institutionId: string;
  studentId: string;
  groupId: string;
  academicYearId: string;
  termId: string;
  status: EnrollmentStatus;
  enrolledAt?: any;
  withdrawnAt?: any;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Guardian {
  id: string;
  institutionId: string;
  userId?: string;
  fullName: string;
  phone: string;
  email?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface StudentGuardian {
  id: string;
  institutionId: string;
  studentId: string;
  guardianId: string;
  isPrimary: boolean;
  relationshipType: GuardianRelationship;
  createdAt?: any;
  createdBy?: string;
}
