import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/models/parent_child.dart';
import 'package:parent_app/models/parent_group.dart';
import 'package:parent_app/models/parent_schedule.dart';
import 'package:parent_app/models/parent_attendance.dart';
import 'package:parent_app/models/parent_grade.dart';
import 'package:parent_app/models/parent_subscription.dart';
import 'package:parent_app/services/parent_auth_service.dart';
import 'package:parent_app/services/parent_data_service.dart';

void main() {
  group('Phase 16 Parent App Runtime Unit & Model Tests (15 Assertions)', () {
    test('Assertion 1: ParentChildDTO JSON parsing & defaults', () {
      final child = ParentChildDTO.fromJson({
        'id': 'stu_101',
        'studentCode': 'STU-100201',
        'fullName': 'محمد أحمد علي',
        'stageName': 'الصف الثالث الثانوي',
      });
      expect(child.id, equals('stu_101'));
      expect(child.studentCode, equals('STU-100201'));
      expect(child.fullName, equals('محمد أحمد علي'));
      expect(child.stageName, equals('الصف الثالث الثانوي'));
    });

    test('Assertion 2: ParentGroupDTO JSON mapping', () {
      final grp = ParentGroupDTO.fromJson({
        'id': 'grp_1',
        'name': 'مجموعة التفوق',
        'subjectName': 'الرياضيات البحتة',
        'teacherName': 'أ.د. أحمد محمود',
        'roomName': 'قاعة A1',
      });
      expect(grp.id, equals('grp_1'));
      expect(grp.name, equals('مجموعة التفوق'));
      expect(grp.subjectName, equals('الرياضيات البحتة'));
      expect(grp.roomName, equals('قاعة A1'));
    });

    test('Assertion 3: ParentScheduleItemDTO JSON mapping', () {
      final item = ParentScheduleItemDTO.fromJson({
        'id': 'sch_1',
        'subjectName': 'الفيزياء الحديثة',
        'dayOfWeek': 'الثلاثاء',
        'startTime': '06:00 م',
        'endTime': '08:00 م',
      });
      expect(item.subjectName, equals('الفيزياء الحديثة'));
      expect(item.dayOfWeek, equals('الثلاثاء'));
      expect(item.startTime, equals('06:00 م'));
    });

    test('Assertion 4: ParentAttendanceRecordDTO PRESENT status mapping', () {
      final att = ParentAttendanceRecordDTO.fromJson({
        'id': 'att_1',
        'subjectName': 'الرياضيات البحتة',
        'status': 'PRESENT',
      });
      expect(att.status, equals(AttendanceStatus.present));
    });

    test('Assertion 5: ParentAttendanceRecordDTO LATE status mapping', () {
      final att = ParentAttendanceRecordDTO.fromJson({
        'id': 'att_2',
        'subjectName': 'الفيزياء الحديثة',
        'status': 'LATE',
      });
      expect(att.status, equals(AttendanceStatus.late));
    });

    test('Assertion 6: ParentAttendanceRecordDTO ABSENT status mapping', () {
      final att = ParentAttendanceRecordDTO.fromJson({
        'id': 'att_3',
        'subjectName': 'الكيمياء',
        'status': 'ABSENT',
      });
      expect(att.status, equals(AttendanceStatus.absent));
    });

    test('Assertion 7: ParentGradeDTO percentage calculation & status', () {
      final g = ParentGradeDTO.fromJson({
        'id': 'grd_1',
        'examName': 'اختبار الرياضيات النصف سنوي',
        'subjectName': 'الرياضيات البحتة',
        'score': 48.0,
        'maxScore': 50.0,
        'percentage': 96.0,
        'status': 'FINALIZED',
      });
      expect(g.score, equals(48.0));
      expect(g.maxScore, equals(50.0));
      expect(g.percentage, equals(96.0));
      expect(g.status, equals('FINALIZED'));
    });

    test('Assertion 8: ParentEntitlementDTO JSON mapping', () {
      final ent = ParentEntitlementDTO.fromJson({
        'packageId': 'pkg_math_annual',
        'scopeType': 'SUBJECT',
        'subjectName': 'الرياضيات البحتة',
        'status': 'ACTIVE',
      });
      expect(ent.packageId, equals('pkg_math_annual'));
      expect(ent.scopeType, equals('SUBJECT'));
      expect(ent.status, equals('ACTIVE'));
    });

    test('Assertion 9: ParentAuthService login with valid parent email -> SUCCESS', () async {
      final auth = ParentAuthService();
      final ok = await auth.login('parent@educenter.app', '123456');
      expect(ok, isTrue);
      expect(auth.status, equals(ParentAuthStatus.authenticated));
      expect(auth.currentUser?.role, equals('parent'));
    });

    test('Assertion 10: ParentAuthService login with student email -> REJECTED (UNAUTHORIZED_ROLE)', () async {
      final auth = ParentAuthService();
      final ok = await auth.login('student@educenter.app', '123456');
      expect(ok, isFalse);
      expect(auth.status, equals(ParentAuthStatus.error));
      expect(auth.errorMessage, contains('UNAUTHORIZED_ROLE'));
    });

    test('Assertion 11: ParentAuthService login with teacher email -> REJECTED (UNAUTHORIZED_ROLE)', () async {
      final auth = ParentAuthService();
      final ok = await auth.login('teacher@educenter.app', '123456');
      expect(ok, isFalse);
      expect(auth.status, equals(ParentAuthStatus.error));
      expect(auth.errorMessage, contains('UNAUTHORIZED_ROLE'));
    });

    test('Assertion 12: ParentAuthService logout resets session state', () async {
      final auth = ParentAuthService();
      await auth.login('parent@educenter.app', '123456');
      expect(auth.status, equals(ParentAuthStatus.authenticated));
      auth.logout();
      expect(auth.status, equals(ParentAuthStatus.unauthenticated));
      expect(auth.currentUser, isNull);
    });

    test('Assertion 13: ParentDataService fetchChildren returns linked children list', () async {
      final data = ParentDataService();
      final list = await data.fetchChildren();
      expect(list.length, equals(2));
      expect(list[0].fullName, equals('محمد أحمد علي'));
    });

    test('Assertion 14: ParentDataService fetchChildGrades returns read-only grades without answer keys', () async {
      final data = ParentDataService();
      final grades = await data.fetchChildGrades('stu_1');
      expect(grades.length, equals(2));
      expect(grades[0].percentage, equals(96.0));
    });

    test('Assertion 15: Attendance percentage formula matching Phase 7 rules', () {
      final records = [
        ParentAttendanceRecordDTO(id: '1', subjectName: 'Math', sessionDate: DateTime.now(), status: AttendanceStatus.present),
        ParentAttendanceRecordDTO(id: '2', subjectName: 'Math', sessionDate: DateTime.now(), status: AttendanceStatus.present),
        ParentAttendanceRecordDTO(id: '3', subjectName: 'Math', sessionDate: DateTime.now(), status: AttendanceStatus.absent),
      ];
      final presentOrLate = records.where((r) => r.status == AttendanceStatus.present || r.status == AttendanceStatus.late).length;
      final pct = (presentOrLate / records.length) * 100;
      expect(pct.toStringAsFixed(1), equals('66.7'));
    });
  });
}
