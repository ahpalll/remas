import '../models/educational_content.dart';

/// Canonical content errors.
class ContentAccessException implements Exception {
  final String code;
  final String message;
  const ContentAccessException(this.code, this.message);
  @override
  String toString() => '$code: $message';
}

/// Canonical Student content layer (legacy, fail-closed).
///
/// DEPRECATED: P3 added real student-readable Worker routes
/// (`/mobile/student/lessons`, `/mobile/student/contents` — see
/// `StudentService.fetchLessons/fetchPublishedContents`). New code must use
/// `StudentService`; this class is kept only so old imports keep compiling
/// and keeps returning empty lists (fail closed, never demo data). Protected
/// media, once listed through the approved contract, must be streamed via
/// the canonical Worker (per-request auth, private R2) — never a permanent URL.
class ContentService {
  Future<List<LessonDTO>> fetchLessons(String subjectId) async {
    return [];
  }

  Future<List<EducationalContentDTO>> fetchPublishedContents(
      String subjectId) async {
    return [];
  }
}
