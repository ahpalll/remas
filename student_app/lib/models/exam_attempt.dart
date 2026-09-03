class AttemptQuestionSnapshot {
  final String id;
  final String questionId;
  final String attemptId;
  final String prompt;
  final String questionType;
  final int marksHundredths;
  final List<AttemptQuestionOption> options;
  final int order;

  AttemptQuestionSnapshot({
    required this.id,
    required this.questionId,
    required this.attemptId,
    required this.prompt,
    required this.questionType,
    required this.marksHundredths,
    required this.options,
    required this.order,
  });

  factory AttemptQuestionSnapshot.fromJson(Map<String, dynamic> json) {
    var rawOpts = json['options'] as List? ?? [];
    List<AttemptQuestionOption> opts = rawOpts
        .map((o) => AttemptQuestionOption.fromJson(Map<String, dynamic>.from(o)))
        .toList();
    return AttemptQuestionSnapshot(
      id: json['id'] ?? '',
      questionId: json['questionId'] ?? '',
      attemptId: json['attemptId'] ?? '',
      prompt: json['prompt'] ?? '',
      questionType: json['questionType'] ?? 'MCQ',
      marksHundredths: json['marksHundredths'] ?? 0,
      options: opts,
      order: json['order'] ?? 1,
    );
  }
}

class AttemptQuestionOption {
  final String optionId;
  final String text;
  final int order;

  AttemptQuestionOption({
    required this.optionId,
    required this.text,
    required this.order,
  });

  factory AttemptQuestionOption.fromJson(Map<String, dynamic> json) {
    return AttemptQuestionOption(
      optionId: json['optionId'] ?? '',
      text: json['text'] ?? '',
      order: json['order'] ?? 1,
    );
  }
}

class AvailableExamDTO {
  final String examId;
  final String title;
  final String? description;
  final String subjectId;
  final String stageId;
  final int durationMinutes;
  final int totalMarksHundredths;
  final bool canStart;

  AvailableExamDTO({
    required this.examId,
    required this.title,
    this.description,
    required this.subjectId,
    required this.stageId,
    required this.durationMinutes,
    required this.totalMarksHundredths,
    required this.canStart,
  });

  factory AvailableExamDTO.fromJson(Map<String, dynamic> json) {
    return AvailableExamDTO(
      examId: json['examId'] ?? '',
      title: json['title'] ?? '',
      description: json['description'],
      subjectId: json['subjectId'] ?? '',
      stageId: json['stageId'] ?? '',
      durationMinutes: json['durationMinutes'] ?? 30,
      totalMarksHundredths: json['totalMarksHundredths'] ?? 0,
      canStart: json['canStart'] ?? true,
    );
  }
}
