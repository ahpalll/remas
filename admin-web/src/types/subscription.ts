export type PackageStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type CodeStatus = 'AVAILABLE' | 'ASSIGNED' | 'REDEEMED' | 'EXPIRED' | 'REVOKED' | 'CANCELLED';
export type RedemptionMode = 'SINGLE_USE' | 'ASSIGNED';
export type EntitlementStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
export type ScopeType = 'SUBJECT' | 'GROUP' | 'LESSON' | 'CONTENT' | 'MULTI_SCOPE';

export interface SubscriptionPackage {
  id: string;
  institutionId: string;
  name: string;
  description?: string;
  status: PackageStatus;
  durationDays: number;
  priceMinor: number;
  currency: string;
  scopeType: ScopeType;
  allowedSubjectIds?: string[];
  allowedGroupIds?: string[];
  allowedLessonIds?: string[];
  allowedContentIds?: string[];
  version: number;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface SubscriptionCode {
  id: string;
  institutionId: string;
  packageId: string;
  codeHash: string;
  codePrefix: string;
  status: CodeStatus;
  redemptionMode: RedemptionMode;
  assignedStudentId?: string;
  redeemedBy?: string;
  redeemedAt?: any;
  expiresAt?: any;
  version: number;
  createdAt?: any;
  createdBy?: string;
}

export interface Entitlement {
  id: string;
  institutionId: string;
  studentId: string;
  packageId: string;
  sourceCodeId: string;
  scopeType: ScopeType;
  subjectIds?: string[];
  groupIds?: string[];
  lessonIds?: string[];
  contentIds?: string[];
  startsAt: any;
  expiresAt: any;
  status: EntitlementStatus;
  revokedAt?: any;
  revokedBy?: string;
  version: number;
  createdAt?: any;
  createdBy?: string;
}

export interface CodeGenerationResult {
  status: 'SUCCESS';
  packageId: string;
  generatedCount: number;
  plaintextCodes: string[]; // Shown ONLY ONCE at creation/export time
}
