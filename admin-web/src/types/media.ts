export type MediaStatus = 'UPLOAD_PENDING' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';

export interface MediaObjectMetadata {
  storageProvider: 'R2';
  objectKey: string;
  mediaVersion: number;
  mediaStatus: MediaStatus;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  checksum?: string;
  uploadedAt?: any;
  uploadedBy?: string;
}

export interface UploadSessionResponse {
  status: 'SUCCESS';
  institutionId: string;
  contentId: string;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  mediaStatus: MediaStatus;
}
