import '../models/exam_attempt.dart';

/// Canonical online-exam errors.
class OnlineExamException implements Exception {
  final String code;
  final String message;
  const OnlineExamException(this.code, this.message);
  @override
  String toString() => '$code: $message';
}

/// Canonical Student online-exam layer.
///
/// STOP: `exams`, `examQuestions`, `examAttempts`, `grades`, and
/// `gradeRevisions` are trusted-only in Rules (client create/update/delete
/// are `false`; reads are tenant-admin only). There is no student exam
/// contract in P1 scope, so listing is empty and any attempt lifecycle call
/// fails closed — never a simulated 100% PASS.
class OnlineExamStudentService {
  Future<List<AvailableExamDTO>> fetchAvailableExams() async {
    return [];
  }

  Future<Map<String, dynamic>> startExam(String examId) async {
    throw const OnlineExamException(
      'EXAM_CLIENT_UNSUPPORTED',
      'الامتحانات الإلكترونية غير متاحة للطالب حاليًا — تُدار عبر السنتر',
    );
  }

  Future<bool> saveAnswer(
    String attemptId,
    String questionId,
    String selectedOptionId,
    int expectedVersion,
  ) async {
    throw const OnlineExamException(
      'EXAM_CLIENT_UNSUPPORTED',
      'الامتحانات الإلكترونية غير متاحة للطالب حاليًا — تُدار عبر السنتر',
    );
  }

  Future<Map<String, dynamic>> submitExam(String attemptId) async {
    throw const OnlineExamException(
      'EXAM_CLIENT_UNSUPPORTED',
      'الامتحانات الإلكترونية غير متاحة للطالب حاليًا — تُدار عبر السنتر',
    );
  }
}
