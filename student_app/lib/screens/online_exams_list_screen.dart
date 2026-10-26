import 'package:flutter/material.dart';
import '../models/exam_attempt.dart';
import '../services/online_exam_service.dart';
import 'exam_runtime_screen.dart';

class OnlineExamsListScreen extends StatefulWidget {
  const OnlineExamsListScreen({super.key});

  @override
  State<OnlineExamsListScreen> createState() => _OnlineExamsListScreenState();
}

class _OnlineExamsListScreenState extends State<OnlineExamsListScreen> {
  final OnlineExamStudentService _service = OnlineExamStudentService();
  List<AvailableExamDTO> _exams = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadExams();
  }

  Future<void> _loadExams() async {
    final res = await _service.fetchAvailableExams();
    setState(() {
      _exams = res;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الامتحانات الإلكترونية المتاحة'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _exams.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: Text(
                      'لا توجد بيانات متاحة حاليًا.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : ListView.builder(
              padding: const EdgeInsets.all(16.0),
              itemCount: _exams.length,
              itemBuilder: (context, index) {
                final exam = _exams[index];
                return Card(
                  elevation: 2,
                  margin: const EdgeInsets.only(bottom: 12.0),
                  child: ListTile(
                    title: Text(exam.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('المدة: ${exam.durationMinutes} دقيقة | الدرجة الكلية: ${(exam.totalMarksHundredths / 100).toStringAsFixed(0)}'),
                    trailing: ElevatedButton(
                      onPressed: exam.canStart
                          ? () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => ExamRuntimeScreen(examId: exam.examId, title: exam.title),
                                ),
                              );
                            }
                          : null,
                      child: const Text('ابدأ الامتحان'),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
