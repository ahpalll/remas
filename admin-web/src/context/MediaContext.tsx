import React, { createContext, useContext, useState } from 'react';
import { MediaObjectMetadata, UploadSessionResponse } from '../types/media';

export interface MediaContextType {
  requestUploadSession: (contentId: string, contentType: string, mimeType: string, fileSizeBytes: number, filename?: string) => Promise<UploadSessionResponse | null>;
  finalizeUpload: (contentId: string, objectKey: string) => Promise<boolean>;
  actionMessage: string | null;
  clearActionMessage: () => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const requestUploadSession = async (contentId: string, contentType: string, mimeType: string, fileSizeBytes: number, filename?: string): Promise<UploadSessionResponse | null> => {
    setActionMessage('BLOCKED / USER ACTION REQUIRED: يتطلب رفع الملف المباشر إلى Cloudflare R2 إعداد مفاتيح الإنتاج R2_ACCESS_KEY و R2_SECRET وترخيص Wrangler.');
    return null;
  };

  const finalizeUpload = async (contentId: string, objectKey: string): Promise<boolean> => {
    setActionMessage('BLOCKED / USER ACTION REQUIRED: إنهاء الرفع واختبار الملف يتطلب نشر Cloud Functions Endpoints الحقيقية.');
    return false;
  };

  const clearActionMessage = () => setActionMessage(null);

  const value = {
    requestUploadSession,
    finalizeUpload,
    actionMessage,
    clearActionMessage,
  };

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia(): MediaContextType {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
}
