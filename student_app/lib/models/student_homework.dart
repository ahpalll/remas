/// Canonical homework + submission DTOs (P3: student-eligible reads).
class StudentHomeworkDTO {
  final String id;
  final String institutionId;
  final String? lessonId;
  final String? subjectId;
  final String title;
  final String? description;
  final String? instructions;
  final String? dueAt;
  final double? maxScore;
  final String? mode;
  final String status;

  StudentHomeworkDTO({
    required this.id,
    required this.institutionId,
    this.lessonId,
    this.subjectId,
    required this.title,
    this.description,
    this.instructions,
    this.dueAt,
    this.maxScore,
    this.mode,
    required this.status,
  });

  factory StudentHomeworkDTO.fromJson(Map<String, dynamic> json) {
    return StudentHomeworkDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      lessonId: json['lessonId'],
      subjectId: json['subjectId'],
      title: json['title'] ?? 'واجب',
      description: json['description'],
      instructions: json['instructions'],
      dueAt: json['dueAt'],
      maxScore: (json['maxScore'] as num?)?.toDouble(),
      mode: json['mode'],
      status: json['status'] ?? 'PUBLISHED',
    );
  }
}

class StudentSubmissionDTO {
  final String id;
  final String homeworkId;
  final String studentId;
  final String status;
  final String? textAnswer;
  final double? score;
  final String? teacherFeedback;
  final String? submittedAt;
  final String? gradedAt;

  StudentSubmissionDTO({
    required this.id,
    required this.homeworkId,
    required this.studentId,
    required this.status,
    this.textAnswer,
    this.score,
    this.teacherFeedback,
    this.submittedAt,
    this.gradedAt,
  });

  factory StudentSubmissionDTO.fromJson(Map<String, dynamic> json) {
    return StudentSubmissionDTO(
      id: json['id'] ?? '',
      homeworkId: json['homeworkId'] ?? '',
      studentId: json['studentId'] ?? '',
      status: json['status'] ?? 'SUBMITTED',
      textAnswer: json['textAnswer'],
      score: (json['score'] as num?)?.toDouble(),
      teacherFeedback: json['teacherFeedback'],
      submittedAt: json['submittedAt'],
      gradedAt: json['gradedAt'],
    );
  }
}
