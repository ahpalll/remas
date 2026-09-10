/// Student AI Chat Message Data Transfer Object
class AIChatMessageDTO {
  final String id;
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final List<String>? sources;
  final String? lessonId;

  AIChatMessageDTO({
    required this.id,
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.sources,
    this.lessonId,
  });

  factory AIChatMessageDTO.fromJson(Map<String, dynamic> json) {
    return AIChatMessageDTO(
      id: json['id'] ?? '',
      text: json['text'] ?? '',
      isUser: json['isUser'] ?? false,
      timestamp: json['timestamp'] != null ? DateTime.parse(json['timestamp']) : DateTime.now(),
      sources: json['sources'] != null ? List<String>.from(json['sources']) : null,
      lessonId: json['lessonId'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'text': text,
        'isUser': isUser,
        'timestamp': timestamp.toIso8601String(),
        'sources': sources,
        'lessonId': lessonId,
      };
}

/// Student AI Self-Test Question Data Transfer Object
class AISelfTestQuestionDTO {
  final String id;
  final String questionText;
  final List<String> options;
  final int correctAnswerIndex;
  final String explanation;
  final String? sourceId;

  AISelfTestQuestionDTO({
    required this.id,
    required this.questionText,
    required this.options,
    required this.correctAnswerIndex,
    required this.explanation,
    this.sourceId,
  });

  factory AISelfTestQuestionDTO.fromJson(Map<String, dynamic> json) {
    return AISelfTestQuestionDTO(
      id: json['id'] ?? '',
      questionText: json['questionText'] ?? '',
      options: List<String>.from(json['options'] ?? []),
      correctAnswerIndex: json['correctAnswerIndex'] ?? 0,
      explanation: json['explanation'] ?? '',
      sourceId: json['sourceId'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'questionText': questionText,
        'options': options,
        'correctAnswerIndex': correctAnswerIndex,
        'explanation': explanation,
        'sourceId': sourceId,
      };
}

/// Student AI Weakness Analysis Report DTO
class AIWeaknessReportDTO {
  final double overallPercentage;
  final List<String> strongTopics;
  final List<String> weakTopics;
  final List<String> recommendations;

  AIWeaknessReportDTO({
    required this.overallPercentage,
    required this.strongTopics,
    required this.weakTopics,
    required this.recommendations,
  });

  factory AIWeaknessReportDTO.fromJson(Map<String, dynamic> json) {
    return AIWeaknessReportDTO(
      overallPercentage: (json['overallPercentage'] as num?)?.toDouble() ?? 0.0,
      strongTopics: List<String>.from(json['strongTopics'] ?? []),
      weakTopics: List<String>.from(json['weakTopics'] ?? []),
      recommendations: List<String>.from(json['recommendations'] ?? []),
    );
  }
}

/// Student AI Study Plan Item DTO
class AIStudyPlanItemDTO {
  final String day;
  final String subjectName;
  final String topic;
  final int durationMinutes;
  final String activity;
  bool isCompleted;

  AIStudyPlanItemDTO({
    required this.day,
    required this.subjectName,
    required this.topic,
    required this.durationMinutes,
    required this.activity,
    this.isCompleted = false,
  });

  factory AIStudyPlanItemDTO.fromJson(Map<String, dynamic> json) {
    return AIStudyPlanItemDTO(
      day: json['day'] ?? '',
      subjectName: json['subjectName'] ?? '',
      topic: json['topic'] ?? '',
      durationMinutes: json['durationMinutes'] ?? 30,
      activity: json['activity'] ?? '',
      isCompleted: json['isCompleted'] ?? false,
    );
  }
}
