import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/student_profile.dart';
import '../models/student_group.dart';
import '../models/student_schedule.dart';
import '../models/student_attendance.dart';
import '../models/student_grade.dart';
import '../models/canonical_ref.dart';
import '../models/student_homework.dart';
import '../models/educational_content.dart';
import '../models/app_branding.dart';

class StudentResolutionException implements Exception {
  final String code;
  final String message;
  const StudentResolutionException(this.code, this.message);
  @override
  String toString() => '$code: $message';
}

/// Canonical Student Service — directly connected to Cloud Firestore.
/// Reads real center data (Groups, Schedule, Attendance, Grades, Profile, Branding).
class StudentService {
  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  StudentService({FirebaseFirestore? firestore, FirebaseAuth? auth})
      : _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance;

  StudentProfileDTO? _activeMembership;
  StudentProfileDTO? get activeMembership => _activeMembership;

  void setActiveMembership(StudentProfileDTO membership) {
    _activeMembership = membership;
  }

  void clearActiveMembership() {
    _activeMembership = null;
  }

  static const List<String> _knownInstitutions = [
    'rdYkP0iEoIz1HvcU3sel',
    'YOiA0CVF7kGNuwsqRgjk',
    'OIpycS1wngp53gqxDXla',
  ];

  static String normalizeDigits(String input) {
    const eastern = '٠١٢٣٤٥٦٧٨٩';
    const arabic = '۰۱۲۳۴۵۶۷۸۹';
    final sb = StringBuffer();
    for (final ch in input.split('')) {
      final e = eastern.indexOf(ch);
      if (e >= 0) {
        sb.write(e);
        continue;
      }
      final a = arabic.indexOf(ch);
      if (a >= 0) {
        sb.write(a);
        continue;
      }
      sb.write(ch);
    }
    return sb.toString();
  }

  /// Converts day number (0-6) or English day name to Arabic day name
  static String formatDayName(dynamic day) {
    if (day == null) return 'الأحد';
    final str = day.toString().trim().toLowerCase();
    switch (str) {
      case '0':
      case 'sunday':
      case 'sun':
        return 'الأحد';
      case '1':
      case 'monday':
      case 'mon':
        return 'الإثنين';
      case '2':
      case 'tuesday':
      case 'tue':
        return 'الثلاثاء';
      case '3':
      case 'wednesday':
      case 'wed':
        return 'الأربعاء';
      case '4':
      case 'thursday':
      case 'thu':
        return 'الخميس';
      case '5':
      case 'friday':
      case 'fri':
        return 'الجمعة';
      case '6':
      case 'saturday':
      case 'sat':
        return 'السبت';
      default:
        return day.toString();
    }
  }

  /// Fetch all active student memberships for the currently authenticated user
  Future<List<StudentProfileDTO>> fetchStudentMemberships() async {
    if (_activeMembership != null) return [_activeMembership!];

    final user = _auth.currentUser;
    if (user == null) {
      return [];
    }

    final uid = user.uid;
    DocumentSnapshot<Map<String, dynamic>>? foundDoc;
    String? foundInstId;

    // 1. Try collectionGroup by authUid
    try {
      final snapAuth = await _firestore
          .collectionGroup('students')
          .where('authUid', isEqualTo: uid)
          .limit(1)
          .get();
      if (snapAuth.docs.isNotEmpty) {
        foundDoc = snapAuth.docs.first;
        foundInstId = foundDoc.reference.parent.parent?.id;
      }
    } catch (_) {}

    // 2. Direct tenant queries fallback by authUid
    if (foundDoc == null) {
      for (final instId in _knownInstitutions) {
        try {
          final snap = await _firestore
              .collection('institutions')
              .doc(instId)
              .collection('students')
              .where('authUid', isEqualTo: uid)
              .limit(1)
              .get();
          if (snap.docs.isNotEmpty) {
            foundDoc = snap.docs.first;
            foundInstId = instId;
            break;
          }
        } catch (_) {}
      }
    }

    // 3. Fallback: match by phone / normalizedPhone extracted from user's email
    if (foundDoc == null && user.email != null && user.email!.startsWith('stu_')) {
      final rawDigits = user.email!.replaceAll('stu_', '').replaceAll('@remas.local', '');
      final candidatePhones = [
        rawDigits,
        '+$rawDigits',
        rawDigits.startsWith('20') ? '0${rawDigits.substring(2)}' : rawDigits,
      ];

      for (final instId in _knownInstitutions) {
        for (final p in candidatePhones) {
          try {
            final snapPhone = await _firestore
                .collection('institutions')
                .doc(instId)
                .collection('students')
                .where('normalizedPhone', isEqualTo: p)
                .limit(1)
                .get();
            if (snapPhone.docs.isNotEmpty) {
              foundDoc = snapPhone.docs.first;
              foundInstId = instId;
              break;
            }

            final snapRaw = await _firestore
                .collection('institutions')
                .doc(instId)
                .collection('students')
                .where('phone', isEqualTo: p)
                .limit(1)
                .get();
            if (snapRaw.docs.isNotEmpty) {
              foundDoc = snapRaw.docs.first;
              foundInstId = instId;
              break;
            }
          } catch (_) {}
        }
        if (foundDoc != null) break;
      }
    }

    if (foundDoc == null || !foundDoc.exists) {
      throw const StudentResolutionException(
        'NOT_LINKED',
        'لا يوجد ملف طالب مرتبط بهذا الحساب — تواصل مع إدارة السنتر',
      );
    }

    final data = foundDoc.data() ?? {};
    final instId = (data['institutionId'] ?? foundInstId ?? 'rdYkP0iEoIz1HvcU3sel').toString();

    // Auto-link authUid in Firestore if needed
    if (data['authUid'] != uid) {
      try {
        await foundDoc.reference.update({
          'authUid': uid,
          'authEmail': user.email ?? '',
          'updatedAt': FieldValue.serverTimestamp(),
        });
      } catch (_) {}
    }

    final rawGroupIds = data['groupIds'];
    final List<String> groupIds = [];
    if (rawGroupIds is List) {
      for (final g in rawGroupIds) {
        if (g != null && g.toString().isNotEmpty) groupIds.add(g.toString());
      }
    } else if (data['groupId'] != null && data['groupId'].toString().isNotEmpty) {
      groupIds.add(data['groupId'].toString());
    }

    final profile = StudentProfileDTO(
      id: data['id'] ?? foundDoc.id,
      institutionId: instId,
      studentCode: data['studentCode'] ?? data['code'] ?? '',
      fullName: data['fullName'] ?? data['name'] ?? 'طالب',
      email: data['email'] ?? user.email ?? '',
      phone: data['phone'] ?? '',
      stageId: data['stageId'] ?? '',
      stageName: data['stageName'] ?? 'المرحلة الدراسية',
      groupIds: groupIds,
      enrolledSubjectNames: List<String>.from(data['enrolledSubjectNames'] ?? []),
      status: (data['status'] ?? 'ACTIVE').toString(),
      isVip: data['isVip'] == true,
      aiQuestionsBalance: int.tryParse((data['aiQuestionsBalance'] ?? 0).toString()) ?? 0,
      unlockedFeatures: List<String>.from(data['unlockedFeatures'] ?? []),
      aiVipExpiresAt: data['aiVipExpiresAt']?.toString(),
    );

    _activeMembership = profile;
    return [profile];
  }

  /// Current student profile (resolves active membership first)
  Future<StudentProfileDTO?> fetchCurrentStudentProfile({bool forceRefresh = false}) async {
    if (_activeMembership != null && !forceRefresh) return _activeMembership;
    final list = await fetchStudentMemberships();
    return list.isNotEmpty ? list.first : null;
  }

  /// Redeem an AI Voucher Code linked to the student from the center
  Future<Map<String, dynamic>> redeemAiVoucherCode(String code) async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) {
      throw Exception('تعذر العثور على بيانات الطالب. يرجى تسجيل الدخول مجدداً.');
    }

    final cleanCode = code.trim().toUpperCase();
    if (cleanCode.isEmpty) {
      throw Exception('يرجى إدخال كود التفعيل');
    }

    final instId = profile.institutionId;
    final studentId = profile.id;

    // Search for voucher in Firestore under institution
    final q = await _firestore
        .collection('institutions')
        .doc(instId)
        .collection('aiVouchers')
        .where('code', isEqualTo: cleanCode)
        .limit(1)
        .get();

    if (q.docs.isEmpty) {
      throw Exception('كود التفعيل غير صالح أو غير موجود بالسنتر');
    }

    final vDoc = q.docs.first;
    final vData = vDoc.data();

    // Check status
    if (vData['status'] == 'REDEEMED') {
      throw Exception('تم استخدام هذا الكود وتفعيله مسبقاً');
    }

    // Check allocation: if allocated to a student from center dashboard, ensure it matches this student
    final allocatedStudentId = vData['allocatedStudentId']?.toString();
    if (allocatedStudentId != null && allocatedStudentId.isNotEmpty && allocatedStudentId != studentId) {
      throw Exception('هذا الكود مخصص ومربوط بطالب آخر في السنتر');
    }

    final int quota = int.tryParse((vData['quotaQuestions'] ?? 50).toString()) ?? 50;
    final List<String> voucherFeatures = List<String>.from(vData['features'] ?? ['ai_tutor']);
    final String? expiresAt = vData['expiresAt']?.toString();

    // Mark voucher redeemed
    await vDoc.reference.update({
      'status': 'REDEEMED',
      'redeemedByStudentId': studentId,
      'redeemedByStudentName': profile.fullName,
      'redeemedAt': DateTime.now().toIso8601String(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // Fetch and update student document
    final sDocRef = _firestore.collection('institutions').doc(instId).collection('students').doc(studentId);
    final sSnap = await sDocRef.get();
    final sData = sSnap.data() ?? {};

    final currentBalance = int.tryParse((sData['aiQuestionsBalance'] ?? 0).toString()) ?? 0;
    final newBalance = currentBalance + quota;
    final existingFeatures = List<String>.from(sData['unlockedFeatures'] ?? []);
    final mergedFeatures = {...existingFeatures, ...voucherFeatures}.toList();

    await sDocRef.update({
      'isVip': true,
      'aiQuestionsBalance': newBalance,
      'unlockedFeatures': mergedFeatures,
      'aiVipExpiresAt': expiresAt,
      'lastVoucherCode': cleanCode,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // Force refresh active profile
    _activeMembership = null;
    await fetchCurrentStudentProfile(forceRefresh: true);

    return {
      'success': true,
      'quotaAdded': quota,
      'newBalance': newBalance,
      'features': mergedFeatures,
      'name': (vData['name'] ?? 'باقة VIP للمساعد الذكي').toString(),
    };
  }

  /// Fetch Enrolled Groups for the student
  Future<List<StudentGroupDTO>> fetchStudentGroups() async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];

    final instId = profile.institutionId;
    final groupIds = profile.groupIds;
    if (groupIds.isEmpty) return [];

    final List<StudentGroupDTO> groups = [];
    for (final gid in groupIds) {
      try {
        final gDoc = await _firestore
            .collection('institutions')
            .doc(instId)
            .collection('groups')
            .doc(gid)
            .get();

        if (gDoc.exists && gDoc.data() != null) {
          final d = gDoc.data()!;
          groups.add(StudentGroupDTO(
            id: d['id'] ?? gDoc.id,
            institutionId: instId,
            name: d['name'] ?? 'مجموعة دراسية',
            code: d['code'] ?? '',
            subjectName: d['subjectName'] ?? d['subject'] ?? 'المادة الدراسية',
            teacherName: d['teacherName'] ?? d['teacher'] ?? 'المعلم',
            roomName: d['roomName'] ?? d['room'] ?? 'القاعة',
          ));
        }
      } catch (_) {}
    }

    return groups;
  }

  /// Fetch Student Schedule (Classes and Timetables)
  Future<List<StudentScheduleItemDTO>> fetchStudentSchedule() async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];

    final instId = profile.institutionId;
    final groupIds = profile.groupIds;
    if (groupIds.isEmpty) return [];

    final List<StudentScheduleItemDTO> items = [];

    for (final gid in groupIds) {
      try {
        final gDoc = await _firestore
            .collection('institutions')
            .doc(instId)
            .collection('groups')
            .doc(gid)
            .get();

        if (!gDoc.exists || gDoc.data() == null) continue;
        final gd = gDoc.data()!;
        final subjectName = (gd['subjectName'] ?? gd['name'] ?? 'مادة دراسية').toString();
        final teacherName = (gd['teacherName'] ?? 'المعلم').toString();
        final roomName = (gd['roomName'] ?? 'القاعة').toString();

        // 1. Group schedule field (array of schedule objects)
        final rawSchedule = gd['schedule'] ?? gd['schedules'];
        if (rawSchedule is List && rawSchedule.isNotEmpty) {
          for (final s in rawSchedule) {
            if (s is Map) {
              final sm = Map<String, dynamic>.from(s);
              items.add(StudentScheduleItemDTO(
                id: (sm['id'] ?? '${gid}_${items.length}').toString(),
                institutionId: instId,
                subjectName: subjectName,
                teacherName: teacherName,
                roomName: (sm['roomName'] ?? roomName).toString(),
                dayOfWeek: formatDayName(sm['dayOfWeek'] ?? sm['day']),
                startTime: (sm['startTime'] ?? sm['time'] ?? '04:00 م').toString(),
                endTime: (sm['endTime'] ?? '06:00 م').toString(),
              ));
            }
          }
        } else {
          // 2. Query schedules subcollection
          try {
            final sSnap = await _firestore
                .collection('institutions')
                .doc(instId)
                .collection('schedules')
                .where('groupId', isEqualTo: gid)
                .get();

            for (final doc in sSnap.docs) {
              final sm = doc.data();
              items.add(StudentScheduleItemDTO(
                id: doc.id,
                institutionId: instId,
                subjectName: subjectName,
                teacherName: teacherName,
                roomName: (sm['roomName'] ?? roomName).toString(),
                dayOfWeek: formatDayName(sm['dayOfWeek'] ?? sm['day']),
                startTime: (sm['startTime'] ?? '04:00 م').toString(),
                endTime: (sm['endTime'] ?? '06:00 م').toString(),
              ));
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    return items;
  }

  /// Fetch Student Attendance History
  Future<List<StudentAttendanceRecordDTO>> fetchStudentAttendanceHistory() async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];

    final instId = profile.institutionId;
    final studentId = profile.id;
    final List<StudentAttendanceRecordDTO> records = [];

    // Query institutions/{instId}/attendance
    try {
      final snap = await _firestore
          .collection('institutions')
          .doc(instId)
          .collection('attendance')
          .where('studentId', isEqualTo: studentId)
          .limit(100)
          .get();

      for (final doc in snap.docs) {
        final d = doc.data();
        DateTime sessionDate = DateTime.now();
        if (d['date'] != null) {
          sessionDate = DateTime.tryParse(d['date'].toString()) ?? sessionDate;
        } else if (d['sessionDate'] != null) {
          sessionDate = DateTime.tryParse(d['sessionDate'].toString()) ?? sessionDate;
        } else if (d['timestamp'] is Timestamp) {
          sessionDate = (d['timestamp'] as Timestamp).toDate();
        }

        AttendanceRecordStatus status = AttendanceRecordStatus.absent;
        final st = (d['status'] ?? '').toString().toUpperCase();
        if (st == 'PRESENT' || st == 'ATTENDED' || st == 'حاضر') {
          status = AttendanceRecordStatus.present;
        } else if (st == 'LATE' || st == 'متأخر') {
          status = AttendanceRecordStatus.late;
        } else if (st == 'EXCUSED' || st == 'معذور') {
          status = AttendanceRecordStatus.excused;
        }

        records.add(StudentAttendanceRecordDTO(
          id: doc.id,
          institutionId: instId,
          sessionId: (d['sessionId'] ?? '').toString(),
          sessionDate: sessionDate,
          subjectName: (d['subjectName'] ?? d['subject'] ?? 'حصة دراسية').toString(),
          status: status,
        ));
      }
    } catch (_) {}

    // Sort newest first
    records.sort((a, b) => b.sessionDate.compareTo(a.sessionDate));
    return records;
  }

  /// Fetch Student Grades and Exam Results
  Future<List<StudentGradeDTO>> fetchStudentGrades() async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];

    final instId = profile.institutionId;
    final studentId = profile.id;
    final List<StudentGradeDTO> grades = [];

    try {
      final snap = await _firestore
          .collection('institutions')
          .doc(instId)
          .collection('grades')
          .where('studentId', isEqualTo: studentId)
          .limit(100)
          .get();

      for (final doc in snap.docs) {
        final d = doc.data();
        final score = double.tryParse((d['score'] ?? d['degree'] ?? 0).toString()) ?? 0.0;
        final maxScore = double.tryParse((d['maxScore'] ?? d['totalDegree'] ?? 100).toString()) ?? 100.0;
        final pct = maxScore > 0 ? (score / maxScore) * 100 : 0.0;

        DateTime date = DateTime.now();
        if (d['examDate'] != null) {
          date = DateTime.tryParse(d['examDate'].toString()) ?? date;
        } else if (d['date'] != null) {
          date = DateTime.tryParse(d['date'].toString()) ?? date;
        } else if (d['timestamp'] is Timestamp) {
          date = (d['timestamp'] as Timestamp).toDate();
        }

        grades.add(StudentGradeDTO(
          id: doc.id,
          institutionId: instId,
          examName: (d['examName'] ?? d['title'] ?? 'اختبار دوري').toString(),
          subjectName: (d['subjectName'] ?? d['subject'] ?? 'المادة الدراسية').toString(),
          score: score,
          maxScore: maxScore,
          percentage: pct,
          status: (d['status'] ?? 'FINALIZED').toString(),
          examDate: date,
        ));
      }
    } catch (_) {}

    // Fallback: check exams collection
    if (grades.isEmpty) {
      try {
        final snapExams = await _firestore
            .collection('institutions')
            .doc(instId)
            .collection('exams')
            .limit(20)
            .get();

        for (final doc in snapExams.docs) {
          final d = doc.data();
          final results = d['results'] ?? d['studentDegrees'];
          if (results is Map && results[studentId] != null) {
            final res = results[studentId];
            final score = double.tryParse((res['score'] ?? res).toString()) ?? 0.0;
            final maxScore = double.tryParse((d['maxScore'] ?? 100).toString()) ?? 100.0;
            grades.add(StudentGradeDTO(
              id: doc.id,
              institutionId: instId,
              examName: (d['title'] ?? d['name'] ?? 'اختبار').toString(),
              subjectName: (d['subjectName'] ?? 'المادة').toString(),
              score: score,
              maxScore: maxScore,
              percentage: maxScore > 0 ? (score / maxScore) * 100 : 0.0,
              status: 'FINALIZED',
              examDate: DateTime.now(),
            ));
          }
        }
      } catch (_) {}
    }

    grades.sort((a, b) => b.examDate.compareTo(a.examDate));
    return grades;
  }

  /// Fetch Center / Institution Branding dynamically
  Future<AppBranding> fetchBranding([String? institutionId]) async {
    final instId = institutionId ?? _activeMembership?.institutionId;
    if (instId == null || instId.isEmpty) {
      return AppBranding.platformDefault();
    }

    try {
      final doc = await _firestore.collection('institutions').doc(instId).get();
      if (doc.exists && doc.data() != null) {
        return AppBranding.fromJson(doc.data()!, instId: instId);
      }
    } catch (_) {}

    return AppBranding.platformDefault();
  }

  /// Subjects list for the institution
  Future<List<CanonicalRefDTO>> fetchInstitutionSubjects(String institutionId) async {
    try {
      final snap = await _firestore
          .collection('institutions')
          .doc(institutionId)
          .collection('subjects')
          .get();

      return snap.docs.map((d) {
        final data = d.data();
        return CanonicalRefDTO(
          id: d.id,
          institutionId: institutionId,
          name: (data['name'] ?? 'مادة').toString(),
        );
      }).toList();
    } catch (_) {
      return [];
    }
  }

  /// Stages list for the institution
  Future<List<CanonicalRefDTO>> fetchInstitutionStages(String institutionId) async {
    try {
      final snap = await _firestore
          .collection('institutions')
          .doc(institutionId)
          .collection('stages')
          .get();

      return snap.docs.map((d) {
        final data = d.data();
        return CanonicalRefDTO(
          id: d.id,
          institutionId: institutionId,
          name: (data['name'] ?? 'المرحلة').toString(),
        );
      }).toList();
    } catch (_) {
      return [];
    }
  }

  /// Educational Content (Materials & Videos)
  Future<List<EducationalContentDTO>> fetchEducationalContents(String subjectId) async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];

    final instId = profile.institutionId;
    final List<EducationalContentDTO> contents = [];

    try {
      final snap = await _firestore
          .collection('institutions')
          .doc(instId)
          .collection('contents')
          .where('subjectId', isEqualTo: subjectId)
          .get();

      for (final doc in snap.docs) {
        final d = doc.data();
        contents.add(EducationalContentDTO(
          id: doc.id,
          institutionId: instId,
          lessonId: (d['lessonId'] ?? '').toString(),
          subjectId: subjectId,
          stageId: d['stageId']?.toString(),
          title: (d['title'] ?? 'محتوى تعليمي').toString(),
          description: d['description']?.toString(),
          contentType: (d['contentType'] ?? d['type'] ?? 'DOCUMENT').toString(),
          status: (d['status'] ?? 'PUBLISHED').toString(),
          sortOrder: int.tryParse((d['sortOrder'] ?? 1).toString()) ?? 1,
          durationSeconds: int.tryParse((d['durationSeconds'] ?? 0).toString()),
          fileSizeBytes: int.tryParse((d['fileSizeBytes'] ?? d['sizeBytes'] ?? 0).toString()),
          url: d['url']?.toString(),
          videoProvider: d['videoProvider']?.toString(),
        ));
      }
    } catch (_) {}

    return contents;
  }

  /// Student Homework Assignments
  Future<List<StudentHomeworkDTO>> fetchHomeworkList() async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];

    final instId = profile.institutionId;
    final groupIds = profile.groupIds;
    final List<StudentHomeworkDTO> list = [];

    for (final gid in groupIds) {
      try {
        final snap = await _firestore
            .collection('institutions')
            .doc(instId)
            .collection('homework')
            .where('groupId', isEqualTo: gid)
            .get();

        for (final doc in snap.docs) {
          final d = doc.data();
          list.add(StudentHomeworkDTO(
            id: doc.id,
            institutionId: instId,
            lessonId: d['lessonId']?.toString(),
            subjectId: d['subjectId']?.toString(),
            title: (d['title'] ?? 'واجب منزلي').toString(),
            description: d['description']?.toString(),
            instructions: d['instructions']?.toString(),
            dueAt: (d['dueAt'] ?? d['dueDate'] ?? '').toString(),
            maxScore: double.tryParse((d['maxScore'] ?? 10).toString()),
            mode: d['mode']?.toString(),
            status: (d['status'] ?? 'PUBLISHED').toString(),
          ));
        }
      } catch (_) {}
    }

    return list;
  }

  /// Alias for educational content screen
  Future<List<EducationalContentDTO>> fetchPublishedContents([String? subjectId]) async {
    if (subjectId != null && subjectId.isNotEmpty) {
      return fetchEducationalContents(subjectId);
    }
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];
    final instId = profile.institutionId;
    final List<EducationalContentDTO> contents = [];

    try {
      final snap = await _firestore
          .collection('institutions')
          .doc(instId)
          .collection('contents')
          .limit(50)
          .get();

      for (final doc in snap.docs) {
        final d = doc.data();
        contents.add(EducationalContentDTO(
          id: doc.id,
          institutionId: instId,
          lessonId: (d['lessonId'] ?? '').toString(),
          subjectId: (d['subjectId'] ?? '').toString(),
          stageId: d['stageId']?.toString(),
          title: (d['title'] ?? 'محتوى تعليمي').toString(),
          description: d['description']?.toString(),
          contentType: (d['contentType'] ?? d['type'] ?? 'DOCUMENT').toString(),
          status: (d['status'] ?? 'PUBLISHED').toString(),
          sortOrder: int.tryParse((d['sortOrder'] ?? 1).toString()) ?? 1,
          durationSeconds: int.tryParse((d['durationSeconds'] ?? 0).toString()),
          fileSizeBytes: int.tryParse((d['fileSizeBytes'] ?? d['sizeBytes'] ?? 0).toString()),
          url: d['url']?.toString(),
          videoProvider: d['videoProvider']?.toString(),
        ));
      }
    } catch (_) {}

    return contents;
  }

  /// Alias for homework list
  Future<List<StudentHomeworkDTO>> fetchHomework([String? subjectId]) async {
    return fetchHomeworkList();
  }

  /// Verify and consume a Video Watch Code in Firestore
  Future<Map<String, dynamic>> verifyAndConsumeVideoWatchCode(
    String code, {
    String? subjectId,
  }) async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) {
      throw Exception('تعذر التحقق من ملف الطالب');
    }
    final cleanCode = code.trim().toUpperCase();
    if (cleanCode.isEmpty) {
      throw Exception('يرجى إدخال كود المشاهدة');
    }

    final instId = profile.institutionId;
    final snap = await _firestore
        .collection('institutions')
        .doc(instId)
        .collection('videoWatchCodes')
        .where('code', isEqualTo: cleanCode)
        .limit(1)
        .get();

    if (snap.docs.isEmpty) {
      throw Exception('كود المشاهدة غير صحيح أو غير مسجل بالسنتر');
    }

    final docSnap = snap.docs.first;
    final data = docSnap.data();
    final int maxViews = int.tryParse((data['maxViews'] ?? 2).toString()) ?? 2;
    final int viewsUsed = int.tryParse((data['viewsUsed'] ?? 0).toString()) ?? 0;
    final String? redeemedBy = data['redeemedByStudentId']?.toString();

    if (redeemedBy != null && redeemedBy.isNotEmpty && redeemedBy != profile.id) {
      throw Exception('هذا الكود مستخدم ومربوط بطالب آخر');
    }

    if (viewsUsed >= maxViews || data['status'] == 'EXHAUSTED') {
      throw Exception('انتهت عدد مرات المشاهدة المسموحة لهذا الكود ($viewsUsed/$maxViews)');
    }

    final int nextViews = viewsUsed + 1;
    await docSnap.reference.update({
      'viewsUsed': nextViews,
      'status': nextViews >= maxViews ? 'EXHAUSTED' : 'ACTIVE',
      'redeemedByStudentId': profile.id,
      'redeemedByStudentName': profile.fullName,
      'lastWatchedAt': DateTime.now().toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
    });

    return {
      'success': true,
      'viewsUsed': nextViews,
      'maxViews': maxViews,
    };
  }

  /// Fetch student submissions for a specific homework
  Future<List<StudentSubmissionDTO>> fetchMySubmissions(String homeworkId) async {
    final profile = await fetchCurrentStudentProfile();
    if (profile == null) return [];

    final instId = profile.institutionId;
    final studentId = profile.id;
    final List<StudentSubmissionDTO> list = [];

    try {
      final snap = await _firestore
          .collection('institutions')
          .doc(instId)
          .collection('submissions')
          .where('homeworkId', isEqualTo: homeworkId)
          .where('studentId', isEqualTo: studentId)
          .get();

      for (final doc in snap.docs) {
        final d = doc.data();
        list.add(StudentSubmissionDTO(
          id: doc.id,
          homeworkId: homeworkId,
          studentId: studentId,
          status: (d['status'] ?? 'SUBMITTED').toString(),
          textAnswer: d['textAnswer']?.toString(),
          score: double.tryParse((d['score'] ?? 0).toString()),
          teacherFeedback: d['teacherFeedback']?.toString(),
          submittedAt: d['submittedAt']?.toString(),
          gradedAt: d['gradedAt']?.toString(),
        ));
      }
    } catch (_) {}

    return list;
  }
}
