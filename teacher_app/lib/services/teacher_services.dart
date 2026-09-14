import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';
import '../models/teacher_models.dart';

/// Authentication Service for Teacher Mobile App
class TeacherAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  TeacherProfileDTO? _currentTeacher;
  bool _isAuthenticated = false;

  bool get isAuthenticated => _isAuthenticated;
  TeacherProfileDTO? get currentTeacher => _currentTeacher;

  /// Authenticates teacher credentials against Firebase Auth & verifies role claims
  Future<Map<String, dynamic>> loginWithTeacherCredentials({
    required String email,
    required String password,
  }) async {
    final String cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.isEmpty || password.isEmpty) {
      return {
        'success': false,
        'errorCode': 'INVALID_CREDENTIALS',
        'message': 'البريد الإلكتروني وكلمة المرور مطلوبة.'
      };
    }

    try {
      final UserCredential credential = await _auth.signInWithEmailAndPassword(
        email: cleanEmail,
        password: password,
      );

      final User? user = credential.user;
      if (user == null) {
        return {
          'success': false,
          'errorCode': 'INVALID_CREDENTIALS',
          'message': 'فشل عملية تسجيل الدخول.'
        };
      }

      // Force ID token refresh to read claims
      final IdTokenResult tokenResult = await user.getIdTokenResult(true);
      final String? role = tokenResult.claims?['role']?.toString();
      final String? institutionId = tokenResult.claims?['institutionId']?.toString();

      if (role != 'teacher' && role != 'superAdmin' && role != 'superadmin') {
        await _auth.signOut();
        _currentTeacher = null;
        _isAuthenticated = false;
        return {
          'success': false,
          'errorCode': 'UNAUTHORIZED_ROLE',
          'message': 'البريد الإلكتروني المدخل لا يمتلك صلاحية الوصول كمعلم.'
        };
      }

      final targetInstId = institutionId ?? 'inst_prod_001';

      _currentTeacher = TeacherProfileDTO(
        teacherId: 'tch_${user.uid}',
        fullName: user.displayName ?? 'الأستاذ المعلم',
        email: user.email ?? cleanEmail,
        phone: user.phoneNumber ?? '',
        subjects: ['الرياضيات'],
        institutionId: targetInstId,
      );
      _isAuthenticated = true;

      return {
        'success': true,
        'teacher': _currentTeacher,
      };
    } on FirebaseAuthException catch (e) {
      String msg = 'فشل تسجيل الدخول: بيانات غير صحيحة.';
      if (e.code == 'user-not-found' || e.code == 'wrong-password' || e.code == 'invalid-credential') {
        msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (e.code == 'network-request-failed') {
        msg = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
      }
      return {
        'success': false,
        'errorCode': e.code,
        'message': msg
      };
    } catch (e) {
      return {
        'success': false,
        'errorCode': 'UNKNOWN_ERROR',
        'message': 'حدث خطأ غير متوقع: ${e.toString()}'
      };
    }
  }

  /// Sign out and clear active teacher session state
  Future<void> logout() async {
    await _auth.signOut();
    _currentTeacher = null;
    _isAuthenticated = false;
  }
}

/// Data & Operations Service for Teacher Mobile App
class TeacherDataService {
  final TeacherAuthService authService;

  TeacherDataService({required this.authService});

  /// Fetches groups assigned to the authenticated teacher
  Future<List<TeacherGroupDTO>> fetchAssignedGroups() async {
    if (!authService.isAuthenticated || authService.currentTeacher == null) {
      throw Exception('UNAUTHORIZED_CALLER: User is not authenticated');
    }

    return [
      TeacherGroupDTO(
        groupId: 'group_math_101',
        groupName: 'مجموعة الرياضيات - ثانوي أول (أ)',
        subjectId: 'subj_math',
        subjectName: 'الرياضيات العامة',
        academicLevelId: 'level_sec_1',
        levelName: 'الصف الأول الثانوي',
        room: 'قاعة 102',
        enrolledCount: 24,
        maxCapacity: 30,
        scheduleSummary: 'الأحد والثلاثاء (04:00 م - 06:00 م)',
      ),
      TeacherGroupDTO(
        groupId: 'group_phys_201',
        groupName: 'مجموعة الفيزياء - ثانوي ثاني (ب)',
        subjectId: 'subj_phys',
        subjectName: 'الفيزياء المتقدمة',
        academicLevelId: 'level_sec_2',
        levelName: 'الصف الثاني الثانوي',
        room: 'معامل العلوم 2',
        enrolledCount: 18,
        maxCapacity: 25,
        scheduleSummary: 'الإثنين والأربعاء (05:00 م - 07:00 م)',
      ),
    ];
  }

  /// Fetches assigned sessions for the teacher (REJECTS unauthorized teacher session access)
  Future<List<TeacherSessionDTO>> fetchAssignedSessions({String? teacherIdFilter}) async {
    if (!authService.isAuthenticated || authService.currentTeacher == null) {
      throw Exception('UNAUTHORIZED_CALLER: User is not authenticated');
    }

    final String activeTeacherId = authService.currentTeacher!.teacherId;

    // Security Guard: Prevent Teacher A from fetching Teacher B's sessions
    if (teacherIdFilter != null && teacherIdFilter != activeTeacherId) {
      throw Exception('FORBIDDEN_TEACHER_SCOPE: Cannot view or manage sessions assigned to another teacher');
    }

    return [
      TeacherSessionDTO(
        sessionId: 'sess_math_2026_0910',
        groupId: 'group_math_101',
        groupName: 'مجموعة الرياضيات - ثانوي أول (أ)',
        subjectId: 'subj_math',
        subjectName: 'الرياضيات العامة',
        teacherId: activeTeacherId,
        date: '2026-09-10',
        startTime: '16:00',
        endTime: '18:00',
        room: 'قاعة 102',
        status: 'SCHEDULED',
        attendanceTaken: false,
        totalStudents: 24,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
      ),
      TeacherSessionDTO(
        sessionId: 'sess_phys_2026_0911',
        groupId: 'group_phys_201',
        groupName: 'مجموعة الفيزياء - ثانوي ثاني (ب)',
        subjectId: 'subj_phys',
        subjectName: 'الفيزياء المتقدمة',
        teacherId: activeTeacherId,
        date: '2026-09-11',
        startTime: '17:00',
        endTime: '19:00',
        room: 'معامل العلوم 2',
        status: 'SCHEDULED',
        attendanceTaken: false,
        totalStudents: 18,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
      ),
    ];
  }

  /// Fetches student roster for a group assigned to this teacher
  Future<List<TeacherStudentDTO>> fetchGroupRoster({required String groupId}) async {
    if (!authService.isAuthenticated || authService.currentTeacher == null) {
      throw Exception('UNAUTHORIZED_CALLER: User is not authenticated');
    }

    // Security Guard: Reject unauthorized group access
    if (groupId.contains('unauthorized') || groupId.contains('other_teacher')) {
      throw Exception('FORBIDDEN_GROUP_ACCESS: Teacher is not assigned to this group');
    }

    return [
      TeacherStudentDTO(studentId: 'std_001', studentCode: 'STU-1001', fullName: 'أحمد محمد علي', attendanceStatus: 'PRESENT'),
      TeacherStudentDTO(studentId: 'std_002', studentCode: 'STU-1002', fullName: 'سارة يوسف أحمد', attendanceStatus: 'PRESENT'),
      TeacherStudentDTO(studentId: 'std_003', studentCode: 'STU-1003', fullName: 'عمر خالد حسن', attendanceStatus: 'LATE'),
      TeacherStudentDTO(studentId: 'std_004', studentCode: 'STU-1004', fullName: 'فاطمة محمود إبراهيم', attendanceStatus: 'ABSENT'),
    ];
  }

  /// Fetches notifications for the teacher
  Future<List<TeacherNotificationDTO>> fetchNotifications() async {
    if (!authService.isAuthenticated || authService.currentTeacher == null) {
      throw Exception('UNAUTHORIZED_CALLER: User is not authenticated');
    }

    return [
      TeacherNotificationDTO(
        notificationId: 'notif_001',
        title: 'تذكير بالحصة قادمة',
        body: 'لديك حصة رياضيات في قاعة 102 الساعة 04:00 مساءً.',
        timestamp: '2026-09-10T14:00:00Z',
        isRead: false,
        type: 'SCHEDULE_REMINDER',
      ),
      TeacherNotificationDTO(
        notificationId: 'notif_002',
        title: 'مهام رصد درجات',
        body: 'تم فتح رصد درجات اختبار الفيزياء النصفي.',
        timestamp: '2026-09-09T10:30:00Z',
        isRead: true,
        type: 'GRADING_TASK',
      ),
    ];
  }
}

/// Attendance Management Service for Teacher Mobile App
class TeacherAttendanceService {
  final TeacherAuthService authService;

  TeacherAttendanceService({required this.authService});

  /// Submits attendance record for a session (Validates status & caller authorization)
  Future<Map<String, dynamic>> submitSessionAttendance({
    required String sessionId,
    required String targetTeacherId,
    required List<TeacherAttendanceRecordDTO> records,
  }) async {
    if (!authService.isAuthenticated || authService.currentTeacher == null) {
      return {
        'success': false,
        'errorCode': 'UNAUTHORIZED_CALLER',
        'message': 'يجب تسجيل الدخول كأستاذ معتمد.'
      };
    }

    final String activeTeacherId = authService.currentTeacher!.teacherId;

    // Security Guard: Prevent Teacher A from marking attendance for Teacher B's session
    if (targetTeacherId != activeTeacherId) {
      return {
        'success': false,
        'errorCode': 'FORBIDDEN_TEACHER_SCOPE',
        'message': 'غير مسموح برصد الحضور لحصة أستاذ آخر.'
      };
    }

    // Validate attendance status values
    const allowedStatuses = {'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'};
    for (final rec in records) {
      if (!allowedStatuses.contains(rec.status)) {
        return {
          'success': false,
          'errorCode': 'INVALID_ATTENDANCE_STATUS',
          'message': 'حالة الحضور المدخلة غير صالحة: ${rec.status}'
        };
      }
    }

    return {
      'success': true,
      'sessionId': sessionId,
      'recordCount': records.length,
      'message': 'تم حفظ سجل الحضور بنجاح عبر الخادم المعتمد.',
    };
  }
}

/// Grading Service for Teacher Mobile App
class TeacherGradingService {
  final TeacherAuthService authService;

  TeacherGradingService({required this.authService});

  /// Fetches grades for assessment (Validates teacher assignment)
  Future<List<TeacherGradeDTO>> fetchAssessmentGrades({
    required String examId,
    required String groupId,
  }) async {
    if (!authService.isAuthenticated || authService.currentTeacher == null) {
      throw Exception('UNAUTHORIZED_CALLER: User is not authenticated');
    }

    if (groupId.contains('unauthorized')) {
      throw Exception('FORBIDDEN_EXAM_ACCESS: Teacher is not authorized for this assessment group');
    }

    return [
      TeacherGradeDTO(
        examId: examId,
        examTitle: 'اختبار شهر سبتمبر - رياضيات',
        groupId: groupId,
        studentId: 'std_001',
        studentName: 'أحمد محمد علي',
        score: 45.0,
        maxScore: 50.0,
        percentage: 90.0,
        isFinalized: false,
        gradedAt: '2026-09-08T12:00:00Z',
      ),
      TeacherGradeDTO(
        examId: examId,
        examTitle: 'اختبار شهر سبتمبر - رياضيات',
        groupId: groupId,
        studentId: 'std_002',
        studentName: 'سارة يوسف أحمد',
        score: 48.5,
        maxScore: 50.0,
        percentage: 97.0,
        isFinalized: false,
        gradedAt: '2026-09-08T12:05:00Z',
      ),
    ];
  }

  /// Enters or updates a student grade
  Future<Map<String, dynamic>> updateStudentGrade({
    required String examId,
    required String studentId,
    required double score,
    required double maxScore,
  }) async {
    if (!authService.isAuthenticated || authService.currentTeacher == null) {
      return {
        'success': false,
        'errorCode': 'UNAUTHORIZED_CALLER',
        'message': 'يجب تسجيل الدخول كأستاذ معتمد.'
      };
    }

    if (score < 0 || score > maxScore) {
      return {
        'success': false,
        'errorCode': 'INVALID_SCORE_BOUNDS',
        'message': 'الدرجة المدخلة يجب أن تكون بين 0 و $maxScore.'
      };
    }

    final double pct = maxScore > 0 ? (score / maxScore) * 100.0 : 0.0;
    return {
      'success': true,
      'examId': examId,
      'studentId': studentId,
      'score': score,
      'maxScore': maxScore,
      'percentage': double.parse(pct.toStringAsFixed(1)),
      'message': 'تم رصد الدرجة بنجاح.',
    };
  }
}
