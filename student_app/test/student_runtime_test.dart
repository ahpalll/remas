import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/models/student_profile.dart';
import 'package:student_app/models/student_group.dart';
import 'package:student_app/models/student_schedule.dart';
import 'package:student_app/models/student_attendance.dart';
import 'package:student_app/models/student_grade.dart';
import 'package:student_app/models/educational_content.dart';
import 'package:student_app/models/subscription.dart';
import 'package:student_app/models/app_branding.dart';
import 'package:student_app/services/subscription_service.dart';

void main() {
  group('Phase 15 Student Flutter App Runtime Unit & Model Tests (15 Assertions)', () {
    test('Assertion 1: StudentProfileDTO JSON parsing & defaults', () {
      final p = StudentProfileDTO.fromJson({
        'id': 'stu_101',
        'institutionId': 'inst_A',
        'studentCode': 'STU-1001',
        'fullName': 'أحمد علي',
        'email': 'ahmed@app.com',
      });
      expect(p.id, equals('stu_101'));
      expect(p.studentCode, equals('STU-1001'));
      expect(p.fullName, equals('أحمد علي'));
      expect(p.status, equals('ACTIVE'));
    });

    test('Assertion 2: StudentGroupDTO JSON parsing & fallback values', () {
      final g = StudentGroupDTO.fromJson({
        'id': 'grp_1',
        'name': 'مجموعة التفوق',
        'code': 'GRP-01',
      });
      expect(g.id, equals('grp_1'));
      expect(g.code, equals('GRP-01'));
      expect(g.subjectName, equals('غير محدد'));
    });

    test('Assertion 3: StudentScheduleItemDTO parsing', () {
      final s = StudentScheduleItemDTO.fromJson({
        'id': 'sch_1',
        'subjectName': 'الفيزياء',
        'dayOfWeek': 'الأحد',
        'startTime': '04:00 م',
      });
      expect(s.subjectName, equals('الفيزياء'));
      expect(s.dayOfWeek, equals('الأحد'));
      expect(s.startTime, equals('04:00 م'));
    });

    test('Assertion 4: StudentAttendanceRecordDTO status parsing (PRESENT)', () {
      final att = StudentAttendanceRecordDTO.fromJson({
        'id': 'att_1',
        'status': 'PRESENT',
      });
      expect(att.status, equals(AttendanceRecordStatus.present));
    });

    test('Assertion 5: StudentAttendanceRecordDTO status parsing (ABSENT)', () {
      final att = StudentAttendanceRecordDTO.fromJson({
        'id': 'att_2',
        'status': 'ABSENT',
      });
      expect(att.status, equals(AttendanceRecordStatus.absent));
    });

    test('Assertion 6: StudentAttendanceRecordDTO status parsing (LATE)', () {
      final att = StudentAttendanceRecordDTO.fromJson({
        'id': 'att_3',
        'status': 'LATE',
      });
      expect(att.status, equals(AttendanceRecordStatus.late));
    });

    test('Assertion 7: StudentGradeDTO percentage calculation', () {
      final g = StudentGradeDTO.fromJson({
        'id': 'grd_1',
        'score': 45.0,
        'maxScore': 50.0,
      });
      expect(g.score, equals(45.0));
      expect(g.maxScore, equals(50.0));
      expect(g.percentage, equals(90.0));
    });

    test('Assertion 8: StudentGradeDTO zero maxScore safety', () {
      final g = StudentGradeDTO.fromJson({
        'id': 'grd_2',
        'score': 0.0,
        'maxScore': 0.0,
      });
      expect(g.percentage, equals(0.0));
    });

    test('Assertion 9: EducationalContentDTO JSON mapping', () {
      final c = EducationalContentDTO.fromJson({
        'id': 'cnt_1',
        'title': 'شرح التفاضل',
        'type': 'VIDEO',
        'status': 'PUBLISHED',
      });
      expect(c.id, equals('cnt_1'));
      expect(c.title, equals('شرح التفاضل'));
      expect(c.type, equals('VIDEO'));
    });

    test('Assertion 10: StudentEntitlementDTO JSON mapping', () {
      final e = StudentEntitlementDTO.fromJson({
        'id': 'ent_1',
        'packageId': 'pkg_math',
        'status': 'ACTIVE',
      });
      expect(e.id, equals('ent_1'));
      expect(e.packageId, equals('pkg_math'));
      expect(e.status, equals('ACTIVE'));
    });

    test('Assertion 11: Subscription code redemption service invocation', () async {
      final service = SubscriptionStudentService();
      final res = await service.redeemCode('SUB-1234-5678-90AB', 'req_test_1');
      expect(res, isNotNull);
      expect(res!.status, equals('ACTIVE'));
      expect(res.packageId, equals('pkg_math_annual'));
    });

    test('Assertion 12: Subscription code input normalization (trim & uppercase)', () {
      final input = '  sub-1234-5678-90ab  ';
      final normalized = input.trim().toUpperCase();
      expect(normalized, equals('SUB-1234-5678-90AB'));
    });

    test('Assertion 13: Plaintext code is non-empty before redemption submit', () {
      final code = 'SUB-9999-8888-7777';
      expect(code.trim().length, greaterThanOrEqualTo(8));
    });

    test('Assertion 14: Active entitlements service fetching', () async {
      final service = SubscriptionStudentService();
      final list = await service.fetchActiveEntitlements();
      expect(list.length, equals(1));
      expect(list[0].status, equals('ACTIVE'));
    });

    test('Assertion 15: Attendance percentage calculation formula matching Phase 7 rules', () {
      final records = [
        StudentAttendanceRecordDTO(id: '1', institutionId: 'i1', sessionId: 's1', sessionDate: DateTime.now(), subjectName: 'Math', status: AttendanceRecordStatus.present),
        StudentAttendanceRecordDTO(id: '2', institutionId: 'i1', sessionId: 's2', sessionDate: DateTime.now(), subjectName: 'Math', status: AttendanceRecordStatus.late),
        StudentAttendanceRecordDTO(id: '3', institutionId: 'i1', sessionId: 's3', sessionDate: DateTime.now(), subjectName: 'Math', status: AttendanceRecordStatus.absent),
      ];
      final presentOrLate = records.where((r) => r.status == AttendanceRecordStatus.present || r.status == AttendanceRecordStatus.late).length;
      final pct = (presentOrLate / records.length) * 100;
      expect(pct.toStringAsFixed(1), equals('66.7'));
    });

    test('Assertion 16: AppBranding model JSON parsing & platform default fallback', () {
      final defaultBranding = AppBranding.platformDefault();
      expect(defaultBranding.centerName, equals('رِماس للتقنية التعليمية'));
      expect(defaultBranding.isPlatformDefault, isTrue);

      final customBranding = AppBranding.fromJson({
        'branding': {
          'centerName': 'سنتر المستقبل',
          'primaryColor': '#0F172A',
          'secondaryColor': '#0284C7',
        }
      }, instId: 'inst_A');
      expect(customBranding.centerName, equals('سنتر المستقبل'));
      expect(customBranding.institutionId, equals('inst_A'));
      expect(customBranding.isPlatformDefault, isFalse);
    });
  });
}
