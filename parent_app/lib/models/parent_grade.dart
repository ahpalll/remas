class ParentGradeDTO {
  final String id;
  final String examName;
  final String subjectName;
  final double score;
  final double maxScore;
  final double percentage;
  final String status;

  ParentGradeDTO({
    required this.id,
    required this.examName,
    required this.subjectName,
    required this.score,
    required this.maxScore,
    required this.percentage,
    required this.status,
  });

  factory ParentGradeDTO.fromJson(Map<String, dynamic> json) {
    return ParentGradeDTO(
      id: json['id'] ?? '',
      examName: json['examName'] ?? '',
      subjectName: json['subjectName'] ?? '',
      score: (json['score'] as num?)?.toDouble() ?? 0.0,
      maxScore: (json['maxScore'] as num?)?.toDouble() ?? 100.0,
      percentage: (json['percentage'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] ?? 'FINALIZED',
    );
  }
}
