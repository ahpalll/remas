import '../models/educational_content.dart';

class ContentService {
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

  Future<List<EducationalContentDTO>> fetchPublishedContents(String subjectId) async {
    return [
      EducationalContentDTO(
        id: 'cnt_math_101',
        institutionId: 'inst_dev_center',
        lessonId: 'les_math_1',
        subjectId: subjectId,
        title: 'فيديو شرح المصفوفات والتفاضل',
        contentType: 'VIDEO',
        status: 'PUBLISHED',
        sortOrder: 1,
        durationSeconds: 1800,
        fileSizeBytes: 15478900,
      ),
      EducationalContentDTO(
        id: 'cnt_math_102',
        institutionId: 'inst_dev_center',
        lessonId: 'les_math_1',
        subjectId: subjectId,
        title: 'ملف تمارين محلولة (PDF)',
        contentType: 'PDF',
        status: 'PUBLISHED',
        sortOrder: 2,
        fileSizeBytes: 2097152,
      ),
    ];
  }
}

typedef EducationalContentStudentService = ContentService;
