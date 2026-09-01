export type SessionState = 'INITIALIZING' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type AttendanceSource = 'MANUAL' | 'STUDENT_CODE' | 'BARCODE' | 'QR';

export interface AttendanceSession {
  id: string;
  institutionId: string;
  groupId: string;
  academicYearId: string;
  termId: string;
  scheduledSessionId?: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: SessionState;
  openedAt?: any;
  closedAt?: any;
  openedBy: string;
  closedBy?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface StudentAttendance {
  id: string; // studentId
  institutionId: string;
  attendanceSessionId: string;
  studentId: string;
  enrollmentId: string;
  groupId: string;
  status: AttendanceStatus;
  checkInAt?: any;
  lateMinutes?: number;
  recordedBy: string;
  source: AttendanceSource;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface AttendanceCorrection {
  id: string;
  institutionId: string;
  attendanceSessionId: string;
  studentAttendanceId: string;
  studentId: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  previousCheckInAt?: any;
  newCheckInAt?: any;
  previousLateMinutes?: number;
  newLateMinutes?: number;
  reason: string;
  correctedBy: string;
  correctedAt?: any;
}

export interface AttendanceSessionAudit {
  id: string;
  institutionId: string;
  sessionId: string;
  action: 'SESSION_OPENED' | 'SESSION_CLOSED' | 'SESSION_REOPENED' | 'SESSION_CANCELLED';
  reason?: string;
  performedBy: string;
  timestamp?: any;
}
