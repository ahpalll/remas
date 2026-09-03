import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Exam, ExamQuestionSnapshot, Grade, GradeRevision, Question, QuestionBank } from '../types/exam';

export interface ExamContextType {
  questionBanks: QuestionBank[];
  questions: Question[];
  exams: Exam[];
  snapshots: ExamQuestionSnapshot[];
  grades: Grade[];
  revisions: GradeRevision[];
  loading: boolean;
  error: string | null;
  refreshExamCore: () => Promise<void>;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [snapshots, setSnapshots] = useState<ExamQuestionSnapshot[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [revisions, setRevisions] = useState<GradeRevision[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExamCore = async () => {
    if (!currentUser || !institutionId) {
      setQuestionBanks([]);
      setQuestions([]);
      setExams([]);
      setSnapshots([]);
      setGrades([]);
      setRevisions([]);
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

      const [qbData, qData, examData, snapData, gradeData, revData] = await Promise.all([
        getCollectionDocs<QuestionBank>('questionBanks'),
        getCollectionDocs<Question>('questions'),
        getCollectionDocs<Exam>('exams'),
        getCollectionDocs<ExamQuestionSnapshot>('examQuestions'),
        getCollectionDocs<Grade>('grades'),
        getCollectionDocs<GradeRevision>('gradeRevisions'),
      ]);

      setQuestionBanks(qbData);
      setQuestions(qData);
      setExams(examData);
      setSnapshots(snapData);
      setGrades(gradeData);
      setRevisions(revData);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات الامتحانات والدرجات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamCore();
  }, [currentUser, institutionId]);

  const value = {
    questionBanks,
    questions,
    exams,
    snapshots,
    grades,
    revisions,
    loading,
    error,
    refreshExamCore: fetchExamCore,
  };

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}

export function useExam(): ExamContextType {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExam must be used within an ExamProvider');
  }
  return context;
}
