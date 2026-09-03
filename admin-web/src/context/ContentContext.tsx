import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { EducationalContent, Lesson } from '../types/content';

export interface ContentContextType {
  lessons: Lesson[];
  contents: EducationalContent[];
  loading: boolean;
  error: string | null;
  refreshContentCore: () => Promise<void>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [contents, setContents] = useState<EducationalContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContentCore = async () => {
    if (!currentUser || !institutionId) {
      setLessons([]);
      setContents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const getCollectionDocs = async <T,>(colName: string): Promise<T[]> => {
        const ref = collection(db, 'institutions', institutionId, colName);
        const snap = await getDocs(query(ref));
        const items: T[] = [];
        snap.forEach((docSnap) => {
          items.push({ ...(docSnap.data() as T), id: docSnap.id });
        });
        return items;
      };

      const [lessonData, contentData] = await Promise.all([
        getCollectionDocs<Lesson>('lessons'),
        getCollectionDocs<EducationalContent>('contents'),
      ]);

      setLessons(lessonData);
      setContents(contentData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات المحتوى التعليمي.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContentCore();
  }, [currentUser, institutionId]);

  const value = {
    lessons,
    contents,
    loading,
    error,
    refreshContentCore: fetchContentCore,
  };

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextType {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
}
