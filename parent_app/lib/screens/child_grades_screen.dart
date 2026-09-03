import 'package:flutter/material.dart';
import '../models/parent_grade.dart';
import '../services/parent_data_service.dart';

class ChildGradesScreen extends StatefulWidget {
  final ParentDataService dataService;
  final String childId;
  const ChildGradesScreen({super.key, required this.dataService, required this.childId});

  @override
  State<ChildGradesScreen> createState() => _ChildGradesScreenState();
}

class _ChildGradesScreenState extends State<ChildGradesScreen> {
  List<ParentGradeDTO> _grades = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadGrades();
  }

  Future<void> _loadGrades() async {
    final list = await widget.dataService.fetchChildGrades(widget.childId);
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
      appBar: AppBar(title: const Text('درجات ونتائج الطالب')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _grades.length,
              itemBuilder: (context, index) {
                final g = _grades[index];
                return Card(
                  elevation: 2,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: g.percentage >= 80 ? Colors.green : Colors.orange,
                      child: Text('${g.percentage.toInt()}%', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                    ),
                    title: Text(g.examName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('المادة: ${g.subjectName} • الدرجة: ${g.score} من ${g.maxScore}'),
                    trailing: const Chip(
                      label: Text('معتمدة', style: TextStyle(fontSize: 12)),
                      backgroundColor: Colors.greenAccent,
                    ),
                  ),
                );
              },
            ),
    );
  }
}
