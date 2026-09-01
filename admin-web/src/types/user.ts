export type UserRole = 'superAdmin' | 'institutionOwner' | 'admin' | 'student' | 'parent';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface UserProfile {
  uid: string;               // Document ID (matches Firebase Auth UID - IMMUTABLE)
  institutionId: string;       // Tenant ID (IMMUTABLE)
  role: UserRole;            // Assigned Role (IMMUTABLE via client update)
  fullName: string;          // User full display name (CLIENT MUTABLE)
  email: string;             // User email (IMMUTABLE via client update)
  phone?: string;            // Contact phone (CLIENT MUTABLE)
  status: UserStatus;        // Profile state (SERVER CONTROLLED ONLY)
  createdAt: any;            // Firestore ServerTimestamp (IMMUTABLE)
  updatedAt: any;            // Firestore ServerTimestamp (CLIENT/SERVER MUTABLE)
  createdBy: string;         // Creator UID (IMMUTABLE)
  updatedBy: string;         // Updater UID (CLIENT/SERVER MUTABLE)
}
