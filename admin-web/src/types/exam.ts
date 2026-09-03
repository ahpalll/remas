export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type ExamType = 'PAPER' | 'ASSIGNMENT' | 'ASSESSMENT' | 'PRACTICE' | 'ONLINE';
export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_TEXT';
export type ResultStatus = 'PASS' | 'FAIL';
export type GradingStatus = 'PENDING' | 'GRADED' | 'REVIEW_REQUIRED' | 'FINALIZED';

export interface QuestionOption {
  optionId: string;
  questionId?: string;
  text: string;
  order: number;
  isCorrect?: boolean; // Trusted administrative data only
}

export interface QuestionBank {
  id: string;
  institutionId: string;
  name: string;
  subjectId: string;
  stageId?: string;
  description?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Question {
  id: string;
  institutionId: string;
  questionBankId?: string;
  subjectId: string;
  stageId?: string;
  questionType: QuestionType;
  prompt: string;
  explanation?: string;
  marksHundredths: number; // Integer hundredths: 100 = 1.00 mark
  options?: QuestionOption[];
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface ExamQuestionSnapshot {
  id: string;
  examId: string;
  questionId: string;
  prompt: string;
  questionType: QuestionType;
  marksHundredths: number;
  options?: QuestionOption[];
  correctAnswer?: any; // Trusted data only
  order: number;
}

export interface Exam {
  id: string;
  institutionId: string;
  title: string;
  description?: string;
  examType: ExamType;
  academicYearId: string;
  termId?: string;
  stageId: string;
  subjectId: string;
  groupId?: string;
  totalMarksHundredths: number;
  passingMarksHundredths: number;
  status: ExamStatus;
  scheduledAt?: string;
  publishedAt?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Grade {
  id: string; // Deterministic: grade_{examId}_{studentId}
  institutionId: string;
  examId: string;
  studentId: string;
  groupId?: string;
  totalMarksHundredths: number;
  earnedMarksHundredths: number;
  percentageHundredths: number;
  resultStatus: ResultStatus;
  gradingStatus: GradingStatus;
  gradedAt?: any;
  gradedBy?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface GradeRevision {
  id: string;
  gradeId: string;
  institutionId: string;
  previousEarnedMarksHundredths: number;
  newEarnedMarksHundredths: number;
  previousStatus: GradingStatus;
  newStatus: GradingStatus;
  reason: string;
  changedBy: string;
  changedAt: any;
}

export interface QuestionImportRow {
  prompt: string;
  questionType: QuestionType;
  marks: number;
  subjectId: string;
  stageId?: string;
  options?: string[];
  correctAnswer: string;
}

export interface QuestionImportReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: { row: number; error: string }[];
}
