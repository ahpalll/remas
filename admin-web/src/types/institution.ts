export type InstitutionStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type InstitutionType = 'center' | 'school' | 'academy' | 'private';

export interface Institution {
  id: string;                // Document ID (matches institutionId)
  institutionId: string;       // Unique tenant key (IMMUTABLE for ALL roles)
  name: string;              // Required center name
  legalName?: string;        // Optional legal name
  type: InstitutionType;     // Institution type
  phone?: string;            // Contact phone
  email?: string;            // Official email
  address?: string;          // Address
  city?: string;             // City
  country?: string;          // Country
  logoUrl?: string;          // Logo URL
  status: InstitutionStatus; // Lifecycle state ('ACTIVE' | 'SUSPENDED' | 'ARCHIVED')
  ownerId?: string;          // Reference to owner user UID (IMMUTABLE for ALL roles)
  createdAt: string;         // Created ISO timestamp
  updatedAt: string;         // Updated ISO timestamp
  createdBy: string;         // Creator UID (Must match request.auth.uid)
  updatedBy: string;         // Updater UID (Must match request.auth.uid)
}
