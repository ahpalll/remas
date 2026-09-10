import 'package:flutter/material.dart';
import '../models/ai_models.dart';
import '../services/ai_tutor_service.dart';

/// Interactive Study Plan Timetable Screen ("خطة مذاكرتي")
class AIStudyPlanScreen extends StatefulWidget {
  final StudentAITutorService aiService;

  const AIStudyPlanScreen({super.key, required this.aiService});

  @override
  State<AIStudyPlanScreen> createState() => _AIStudyPlanScreenState();
}

class _AIStudyPlanScreenState extends State<AIStudyPlanScreen> {
  List<AIStudyPlanItemDTO> _items = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStudyPlan();
  }

  Future<void> _loadStudyPlan() async {
    final list = await widget.aiService.generateStudyPlan(targetDate: '2026-09-30');
    setState(() {
      _items = list;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('خطة المذاكرة الذكية')),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _items.length,
                itemBuilder: (context, index) {
                  final item = _items[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: CheckboxListTile(
                      value: item.isCompleted,
                      onChanged: (val) {
                        setState(() {
                          item.isCompleted = val ?? false;
                        });
                      },
                      title: Text('${item.day}: ${item.subjectName} - ${item.topic}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('المدة: ${item.durationMinutes} دقيقة | النشاط: ${item.activity}'),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
