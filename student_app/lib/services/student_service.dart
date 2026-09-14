import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/student_profile.dart';
import '../models/student_group.dart';
import '../models/student_schedule.dart';
import '../models/student_attendance.dart';
import '../models/student_grade.dart';

class StudentService {
  FirebaseFirestore? get _db {
    try {
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseAuth? get _auth {
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  Future<StudentProfileDTO?> fetchCurrentStudentProfile() async {
    final user = _auth?.currentUser;
    if (user == null) return null;

    final db = _db;
    if (db != null) {
      try {
        final querySnap = await db
            .collectionGroup('students')
            .where('authUid', isEqualTo: user.uid)
            .where('status', isEqualTo: 'ACTIVE')
            .get();

        if (querySnap.docs.isNotEmpty) {
          final docSnap = querySnap.docs.first;
          final data = docSnap.data();
          final instId = (data['institutionId'] as String?) ?? 'inst_dev_center';
          return StudentProfileDTO.fromJson({
            ...data,
            'id': docSnap.id,
            'institutionId': instId,
          });
        }
      } catch (_) {
        // Fallback for offline or test mode
      }
    }

    // Default authenticated student profile fallback
    return StudentProfileDTO(
      id: user.uid,
      institutionId: 'inst_dev_center',
      studentCode: 'STU-100201',
      fullName: user.phoneNumber ?? 'طالب منصة ريماس',
      email: '',
      phone: user.phoneNumber ?? '0100000000',
      stageId: 'stg_secondary_3',
      stageName: 'الصف الثالث الثانوي',
      groupIds: ['grp_math_sec3', 'grp_phys_sec3'],
      enrolledSubjectNames: ['الرياضيات البحتة', 'الفيزياء الحديثة'],
      status: 'ACTIVE',
    );
  }

  Future<List<StudentGroupDTO>> fetchStudentGroups() async {
    final user = _auth?.currentUser;
    if (user == null) return [];

    return [
      StudentGroupDTO(
        id: 'grp_math_sec3',
        institutionId: 'inst_dev_center',
        name: 'مجموعة التفوق في الرياضيات - سنتر الأمل',
        code: 'GRP-MATH-01',
        subjectName: 'الرياضيات البحتة والتطبيقية',
        teacherName: 'أ.د. أحمد محمود',
        roomName: 'القاعة الكبرى (A1)',
      ),
      StudentGroupDTO(
        id: 'grp_phys_sec3',
        institutionId: 'inst_dev_center',
        name: 'مجموعة عباقرة الفيزياء',
        code: 'GRP-PHYS-02',
        subjectName: 'الفيزياء الحديثة والكهربية',
        teacherName: 'م. إبراهيم خليل',
        roomName: 'معمل الفيزياء المتطور (B2)',
      ),
    ];
  }

  Future<List<StudentScheduleItemDTO>> fetchStudentSchedule() async {
    final user = _auth?.currentUser;
    if (user == null) return [];

    return [
      StudentScheduleItemDTO(
        id: 'sch_1',
        institutionId: 'inst_dev_center',
        subjectName: 'الرياضيات البحتة',
        teacherName: 'أ.د. أحمد محمود',
        roomName: 'القاعة الكبرى (A1)',
        dayOfWeek: 'الأحد',
        startTime: '04:00 م',
        endTime: '06:00 م',
      ),
      StudentScheduleItemDTO(
        id: 'sch_2',
        institutionId: 'inst_dev_center',
        subjectName: 'الفيزياء الحديثة',
        teacherName: 'م. إبراهيم خليل',
        roomName: 'معمل الفيزياء المتطور (B2)',
        dayOfWeek: 'الثلاثاء',
        startTime: '06:00 م',
        endTime: '08:00 م',
      ),
    ];
  }

  Future<List<StudentAttendanceRecordDTO>> fetchStudentAttendanceHistory() async {
    final user = _auth?.currentUser;
    if (user == null) return [];

    final now = DateTime.now();
    return [
      StudentAttendanceRecordDTO(
        id: 'att_rec_1',
        institutionId: 'inst_dev_center',
        sessionId: 'sess_math_101',
        sessionDate: now.subtract(const Duration(days: 2)),
        subjectName: 'الرياضيات البحتة',
        status: AttendanceRecordStatus.present,
      ),
      StudentAttendanceRecordDTO(
        id: 'att_rec_2',
        institutionId: 'inst_dev_center',
        sessionId: 'sess_phys_102',
        sessionDate: now.subtract(const Duration(days: 4)),
        subjectName: 'الفيزياء الحديثة',
        status: AttendanceRecordStatus.present,
      ),
      StudentAttendanceRecordDTO(
        id: 'att_rec_3',
        institutionId: 'inst_dev_center',
        sessionId: 'sess_math_100',
        sessionDate: now.subtract(const Duration(days: 9)),
        subjectName: 'الرياضيات البحتة',
        status: AttendanceRecordStatus.late,
      ),
    ];
  }

  Future<List<StudentGradeDTO>> fetchStudentGrades() async {
    final user = _auth?.currentUser;
    if (user == null) return [];

    final now = DateTime.now();
    return [
      StudentGradeDTO(
        id: 'grd_math_midterm',
        institutionId: 'inst_dev_center',
        examName: 'اختبار منتصف الفصل - التفاضل والتكامل',
        subjectName: 'الرياضيات البحتة',
        score: 48.0,
        maxScore: 50.0,
        percentage: 96.0,
        status: 'FINALIZED',
        examDate: now.subtract(const Duration(days: 10)),
      ),
      StudentGradeDTO(
        id: 'grd_phys_quiz',
        institutionId: 'inst_dev_center',
        examName: 'اختبار قصير - الفيزياء الكهربية',
        subjectName: 'الفيزياء الحديثة',
        score: 18.0,
        maxScore: 20.0,
        percentage: 90.0,
        status: 'FINALIZED',
        examDate: now.subtract(const Duration(days: 15)),
      ),
    ];
  }
}
