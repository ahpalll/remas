import '../models/educational_content.dart';

class EducationalContentStudentService {
  Future<List<LessonDTO>> fetchLessons(String subjectId) async {
    return [
      LessonDTO(
        id: 'les_math_1',
        institutionId: 'inst_dev_center',
        subjectId: subjectId,
        title: 'الدرس الأول: الجبر والمصفوفات',
        lessonNumber: 1,
        sortOrder: 1,
        status: 'PUBLISHED',
        version: 1,
      )
    ];
  }

  Future<List<EducationalContentDTO>> fetchContents(String lessonId) async {
    return [
      EducationalContentDTO(
        id: 'cnt_math_101',
        institutionId: 'inst_dev_center',
        lessonId: lessonId,
        subjectId: 'subj_math',
        title: 'ملخص درس الجبر والمصفوفات',
        contentType: 'PDF',
        status: 'PUBLISHED',
        sortOrder: 1,
        fileSizeBytes: 2097152,
      )
    ];
  }
}
