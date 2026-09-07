export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'DISABLED' | 'ARCHIVED' | 'SUSPENDED' | 'MAINTENANCE' | 'COMPLETED' | 'CANCELLED';

export interface AcademicYear {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Term {
  id: string;
  institutionId: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Subject {
  id: string;
  institutionId: string;
  stageId?: string;
  name: string;
  code: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' | 'ARCHIVED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Teacher {
  id: string;
  institutionId: string;
  userId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  specialization?: string;
  subjectIds: string[];
  levelIds?: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' | 'SUSPENDED' | 'ARCHIVED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Stage {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  order: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DISABLED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Room {
  id: string;
  institutionId: string;
  name: string;
  capacity: number;
  location?: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Group {
  id: string;
  institutionId: string;
  academicYearId: string;
  termId: string;
  stageId: string;
  subjectId: string;
  teacherId: string;
  defaultRoomId: string;
  name: string;
  code: string;
  maxCapacity: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface Schedule {
  id: string;
  institutionId: string;
  groupId: string;
  teacherId: string;
  roomId: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'CANCELLED';
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}
