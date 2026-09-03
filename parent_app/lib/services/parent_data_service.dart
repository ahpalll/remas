import '../models/parent_child.dart';
import '../models/parent_group.dart';
import '../models/parent_schedule.dart';
import '../models/parent_attendance.dart';
import '../models/parent_grade.dart';
import '../models/parent_subscription.dart';

class ParentDataService {
  Future<List<ParentChildDTO>> fetchChildren() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return [
      ParentChildDTO(
        id: 'stu_1',
        studentCode: 'STU-100201',
        fullName: 'محمد أحمد علي',
        stageName: 'الصف الثالث الثانوي',
        groupName: 'مجموعة التفوق في الرياضيات',
        recentGradePercentage: 96.0,
        attendancePercentage: 100.0,
      ),
      ParentChildDTO(
        id: 'stu_2',
        studentCode: 'STU-100202',
        fullName: 'سارة أحمد علي',
        stageName: 'الصف الأول الثانوي',
        groupName: 'مجموعة عباقرة الفيزياء',
        recentGradePercentage: 90.0,
        attendancePercentage: 95.0,
      ),
    ];
  }

  Future<List<ParentGroupDTO>> fetchChildGroups(String childId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return [
      ParentGroupDTO(
        id: 'grp_1',
        name: 'مجموعة التفوق',
        subjectName: 'الرياضيات البحتة',
        teacherName: 'أ.د. أحمد محمود',
        roomName: 'قاعة A1',
      ),
      ParentGroupDTO(
        id: 'grp_2',
        name: 'مجموعة عباقرة الفيزياء',
        subjectName: 'الفيزياء الحديثة',
        teacherName: 'م. إبراهيم خليل',
        roomName: 'قاعة B2',
      ),
    ];
  }

  Future<List<ParentScheduleItemDTO>> fetchChildSchedule(String childId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return [
      ParentScheduleItemDTO(
        id: 'sch_1',
        subjectName: 'الرياضيات البحتة',
        dayOfWeek: 'الأحد',
        startTime: '04:00 م',
        endTime: '06:00 م',
        roomName: 'قاعة A1',
      ),
      ParentScheduleItemDTO(
        id: 'sch_2',
        subjectName: 'الفيزياء الحديثة',
        dayOfWeek: 'الثلاثاء',
        startTime: '06:00 م',
        endTime: '08:00 م',
        roomName: 'قاعة B2',
      ),
    ];
  }

  Future<List<ParentAttendanceRecordDTO>> fetchChildAttendance(String childId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return [
      ParentAttendanceRecordDTO(
        id: 'att_1',
        subjectName: 'الرياضيات البحتة',
        sessionDate: DateTime.now().subtract(const Duration(days: 2)),
        status: AttendanceStatus.present,
      ),
      ParentAttendanceRecordDTO(
        id: 'att_2',
        subjectName: 'الفيزياء الحديثة',
        sessionDate: DateTime.now().subtract(const Duration(days: 5)),
        status: AttendanceStatus.present,
      ),
    ];
  }

  Future<List<ParentGradeDTO>> fetchChildGrades(String childId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return [
      ParentGradeDTO(
        id: 'grd_1',
        examName: 'اختبار الرياضيات النصف سنوي',
        subjectName: 'الرياضيات البحتة',
        score: 48,
        maxScore: 50,
        percentage: 96.0,
        status: 'FINALIZED',
      ),
      ParentGradeDTO(
        id: 'grd_2',
        examName: 'اختبار قصير الفيزياء',
        subjectName: 'الفيزياء الحديثة',
        score: 18,
        maxScore: 20,
        percentage: 90.0,
        status: 'FINALIZED',
      ),
    ];
  }

  Future<Map<String, dynamic>> fetchChildContentAccess(String childId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return {
      'contentAvailabilityNotice': 'المحتوى التعليمي متاح للطالب عبر تطبيق الطالب الخاص به.',
      'activeEntitlements': [
        ParentEntitlementDTO(
          packageId: 'pkg_math_annual',
          scopeType: 'SUBJECT',
          subjectName: 'الرياضيات البحتة',
          status: 'ACTIVE',
          expiresAt: DateTime.now().add(const Duration(days: 100)),
        )
      ]
    };
  }
}
