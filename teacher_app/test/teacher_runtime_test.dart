import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/models/teacher_models.dart';
import 'package:teacher_app/services/teacher_services.dart';

void main() {
  group('Phase 34 Dedicated Teacher App Runtime Unit & Security Tests (15 Assertions)', () {
    late TeacherAuthService authService;
    late TeacherDataService dataService;

    setUp(() {
      authService = TeacherAuthService();
      dataService = TeacherDataService(authService: authService);
    });

    test('Assertion 1: Valid teacher login grants authenticated session', () async {
      final res = await authService.loginWithTeacherCredentials(
        email: 'teacher@remas.edu',
        password: 'Password123!',
      );
      expect(res['success'], isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.currentTeacher, isNotNull);
      expect(authService.currentTeacher!.email, equals('teacher@remas.edu'));
    });

    test('Assertion 2: Student email during teacher login is rejected (UNAUTHORIZED_ROLE)', () async {
      final res = await authService.loginWithTeacherCredentials(
        email: 'student@remas.edu',
        password: 'Password123!',
      );
      expect(res['success'], isFalse);
      expect(res['errorCode'], equals('UNAUTHORIZED_ROLE'));
      expect(authService.isAuthenticated, isFalse);
    });

    test('Assertion 3: Parent email during teacher login is rejected (UNAUTHORIZED_ROLE)', () async {
      final res = await authService.loginWithTeacherCredentials(
        email: 'parent@remas.edu',
        password: 'Password123!',
      );
      expect(res['success'], isFalse);
      expect(res['errorCode'], equals('UNAUTHORIZED_ROLE'));
      expect(authService.isAuthenticated, isFalse);
    });

    test('Assertion 4: TeacherProfileDTO JSON parsing & defaults', () {
      final dto = TeacherProfileDTO.fromJson({
        'teacherId': 'teacher_99',
        'fullName': 'أ.د. حسام عادل',
        'email': 'hosam@remas.edu',
        'subjects': ['الكيمياء'],
        'institutionId': 'inst_001',
      });
      expect(dto.teacherId, equals('teacher_99'));
      expect(dto.fullName, equals('أ.د. حسام عادل'));
      expect(dto.subjects.length, equals(1));
    });

    test('Assertion 5: Fetch assigned groups returns teacher groups', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final groups = await dataService.fetchAssignedGroups();
      expect(groups.length, equals(2));
      expect(groups.first.groupId, equals('group_math_101'));
    });

    test('Assertion 6: Security Guard: Unauthorized group access is rejected', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      expect(
        () async => await dataService.fetchGroupRoster(groupId: 'other_teacher_group'),
        throwsA(predicate((e) => e.toString().contains('FORBIDDEN_GROUP_ACCESS'))),
      );
    });

    test('Assertion 7: Fetch assigned sessions returns teacher sessions', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final sessions = await dataService.fetchAssignedSessions();
      expect(sessions.length, equals(2));
      expect(sessions.first.sessionId, equals('sess_math_2026_0910'));
    });

    test('Assertion 8: Security Guard: Accessing another teacher sessions is rejected', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      expect(
        () async => await dataService.fetchAssignedSessions(teacherIdFilter: 'teacher_other_999'),
        throwsA(predicate((e) => e.toString().contains('FORBIDDEN_TEACHER_SCOPE'))),
      );
    });

    test('Assertion 9: Attendance recording with valid statuses succeeds', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final attService = TeacherAttendanceService(authService: authService);
      final records = [
        TeacherAttendanceRecordDTO(sessionId: 'sess_1', studentId: 'std_1', status: 'PRESENT', markedAt: '2026-09-10'),
        TeacherAttendanceRecordDTO(sessionId: 'sess_1', studentId: 'std_2', status: 'LATE', markedAt: '2026-09-10'),
      ];
      final res = await attService.submitSessionAttendance(
        sessionId: 'sess_1',
        targetTeacherId: 'teacher_001',
        records: records,
      );
      expect(res['success'], isTrue);
      expect(res['recordCount'], equals(2));
    });

    test('Assertion 10: Security Guard: Marking attendance for another teacher session is rejected', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final attService = TeacherAttendanceService(authService: authService);
      final records = [
        TeacherAttendanceRecordDTO(sessionId: 'sess_1', studentId: 'std_1', status: 'PRESENT', markedAt: '2026-09-10'),
      ];
      final res = await attService.submitSessionAttendance(
        sessionId: 'sess_1',
        targetTeacherId: 'teacher_other_888',
        records: records,
      );
      expect(res['success'], isFalse);
      expect(res['errorCode'], equals('FORBIDDEN_TEACHER_SCOPE'));
    });

    test('Assertion 11: Invalid attendance status is rejected', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final attService = TeacherAttendanceService(authService: authService);
      final records = [
        TeacherAttendanceRecordDTO(sessionId: 'sess_1', studentId: 'std_1', status: 'INVALID_STATUS', markedAt: '2026-09-10'),
      ];
      final res = await attService.submitSessionAttendance(
        sessionId: 'sess_1',
        targetTeacherId: 'teacher_001',
        records: records,
      );
      expect(res['success'], isFalse);
      expect(res['errorCode'], equals('INVALID_ATTENDANCE_STATUS'));
    });

    test('Assertion 12: Assessment grades fetching returns authorized student grades', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final gradingService = TeacherGradingService(authService: authService);
      final grades = await gradingService.fetchAssessmentGrades(examId: 'exam_1', groupId: 'group_math_101');
      expect(grades.length, equals(2));
      expect(grades.first.percentage, equals(90.0));
    });

    test('Assertion 13: Security Guard: Fetching grades for unauthorized group is rejected', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final gradingService = TeacherGradingService(authService: authService);
      expect(
        () async => await gradingService.fetchAssessmentGrades(examId: 'exam_1', groupId: 'unauthorized_group'),
        throwsA(predicate((e) => e.toString().contains('FORBIDDEN_EXAM_ACCESS'))),
      );
    });

    test('Assertion 14: Updating student grade with invalid bounds is rejected', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      final gradingService = TeacherGradingService(authService: authService);
      final res = await gradingService.updateStudentGrade(
        examId: 'exam_1',
        studentId: 'std_1',
        score: 110.0, // > maxScore 100.0
        maxScore: 100.0,
      );
      expect(res['success'], isFalse);
      expect(res['errorCode'], equals('INVALID_SCORE_BOUNDS'));
    });

    test('Assertion 15: Logout resets session state completely', () async {
      await authService.loginWithTeacherCredentials(email: 'teacher@remas.edu', password: 'Password123!');
      expect(authService.isAuthenticated, isTrue);
      await authService.logout();
      expect(authService.isAuthenticated, isFalse);
      expect(authService.currentTeacher, isNull);
    });
  });
}
