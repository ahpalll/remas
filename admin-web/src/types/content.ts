export type ContentType = 'VIDEO' | 'PDF' | 'IMAGE' | 'AUDIO' | 'DOCUMENT' | 'LESSON_NOTE' | 'LINK';
export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Lesson {
  id: string;
  institutionId: string;
  subjectId: string;
  stageId?: string;
  title: string;
  description?: string;
  lessonNumber: number;
  sortOrder: number;
  status: ContentStatus;
  version: number;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
  publishedAt?: any;
  archivedAt?: any;
}

export interface EducationalContent {
  id: string;
  institutionId: string;
  lessonId: string;
  subjectId: string;
  stageId?: string;
  groupId?: string;
  title: string;
  description?: string;
  contentType: ContentType;
  status: ContentStatus;
  sortOrder: number;
  tags?: string[];
  durationSeconds?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  externalReference?: string; // Neutral placeholder / LINK URL
  version: number;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
  publishedAt?: any;
  archivedAt?: any;
}
