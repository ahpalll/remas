import 'package:flutter/material.dart';
import '../models/student_grade.dart';
import '../services/student_service.dart';

class GradesScreen extends StatefulWidget {
  const GradesScreen({super.key});

  @override
  State<GradesScreen> createState() => _GradesScreenState();
}

class _GradesScreenState extends State<GradesScreen> {
  final StudentService _studentService = StudentService();
  List<StudentGradeDTO> _grades = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadGrades();
  }

  Future<void> _loadGrades() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
      });
    }
    final list = await _studentService.fetchStudentGrades();
    if (mounted) {
      setState(() {
        _grades = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('النتائج والدرجات'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadGrades,
              child: _grades.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        Center(
                            child: Text(
                                'لا توجد بيانات متاحة حاليًا.\nاسحب للأسفل لإعادة المحاولة.')),
                      ],
                    )
                  : ListView.builder(
                  padding: const EdgeInsets.all(16.0),
                  itemCount: _grades.length,
                  itemBuilder: (context, index) {
                    final g = _grades[index];
                    return Card(
                      elevation: 2,
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    g.examName,
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: g.percentage >= 85 ? Colors.green.shade100 : Colors.blue.shade100,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    '${g.percentage.toStringAsFixed(1)}%',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: g.percentage >= 85 ? Colors.green.shade900 : Colors.blue.shade900,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text('المادة: ${g.subjectName}', style: const TextStyle(color: Colors.grey)),
                            const SizedBox(height: 4),
                            Text('الدرجة: ${g.score} / ${g.maxScore}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepPurple)),
                            const SizedBox(height: 4),
                            Text('التاريخ: ${g.examDate.toString().split(' ').first}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ),
    );
  }
}
