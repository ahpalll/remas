import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/student_profile.dart';
import 'mobile_worker_client.dart';
import 'student_service.dart';

/// Canonical homework submission errors (P3 direct-write contract).
class HomeworkSubmitException implements Exception {
  final String code;
  final String message;
  const HomeworkSubmitException(this.code, this.message);
  @override
  String toString() => '$code: $message';
}

/// Student homework submission — DIRECT Firestore create, enforced
/// entirely by Rules (P3 homeworkSubmissions create branch): own studentId,
/// PUBLISHED + eligible homework, SUBMITTED/LATE, no score, locked fields.
/// No Worker write endpoint exists by design; failures surface typed codes.
class StudentHomeworkService {
  final StudentService _students;
  StudentHomeworkService({StudentService? students})
      : _students = students ?? StudentService();

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

  /// Submits a text answer for an eligible homework. Throws
  /// [HomeworkSubmitException] with the Rules-denial mapped code.
  Future<void> submitTextAnswer({
    required String homeworkId,
    required String textAnswer,
    bool late = false,
  }) async {
    if (_auth?.currentUser == null) {
      throw const HomeworkSubmitException(
        'UNAUTHENTICATED',
        'يجب تسجيل الدخول أولًا',
      );
    }
    if (textAnswer.trim().isEmpty) {
      throw const HomeworkSubmitException(
        'INVALID_INPUT',
        'نص الإجابة مطلوب',
      );
    }
    StudentProfileDTO? profile;
    try {
      final list = await _students.fetchStudentMemberships();
      if (list.length != 1) {
        throw const HomeworkSubmitException(
          'INSTITUTION_SELECTION_REQUIRED',
          'اختر المؤسسة أولًا من الملف الشخصي',
        );
      }
      profile = list.first;
    } on StudentResolutionException catch (e) {
      throw HomeworkSubmitException(e.code, e.message);
    } on MobileWorkerException catch (e) {
      throw HomeworkSubmitException(e.code, e.message);
    }
    final db = _db;
    if (db == null) {
      throw const HomeworkSubmitException(
        'FIRESTORE_UNAVAILABLE',
        'تعذر الاتصال بقاعدة البيانات',
      );
    }
    try {
      await db
          .collection('institutions')
          .doc(profile.institutionId)
          .collection('homeworkSubmissions')
          .add({
        'institutionId': profile.institutionId,
        'homeworkId': homeworkId,
        'studentId': profile.id,
        'status': late ? 'LATE' : 'SUBMITTED',
        'textAnswer': textAnswer.trim(),
        'submittedAt': DateTime.now().toIso8601String(),
      });
    } on FirebaseException catch (e) {
      throw HomeworkSubmitException(
        _codeOf(e),
        'تعذر إرسال الواجب: ${_codeOf(e)}',
      );
    }
  }

  static String _codeOf(FirebaseException e) {
    if (e.code == 'permission-denied') return 'FORBIDDEN_SUBMISSION';
    if (e.code == 'unavailable' || e.code == 'deadline-exceeded') {
      return 'NETWORK_ERROR';
    }
    return 'SUBMIT_FAILED';
  }
}
