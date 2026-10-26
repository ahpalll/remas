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
  List<TutorSubjectDTO> _subjects = [];
  String? _selectedSubjectId;
  bool _subjectsLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSubjects();
  }

  Future<void> _loadSubjects() async {
    try {
      final list = await widget.aiService.fetchSubjects();
      if (!mounted) return;
      setState(() {
        _subjects = list;
        _subjectsLoading = false;
        if (list.length == 1) {
          _selectedSubjectId = list.first.subjectId;
          _loadStudyPlan();
        } else {
          _isLoading = false;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _subjectsLoading = false;
        _isLoading = false;
        _error = e is TutorApiException
            ? e.message
            : 'تعذر تحميل المواد الدراسية.';
      });
    }
  }

  Future<void> _loadStudyPlan() async {
    final subjectId = _selectedSubjectId;
    if (subjectId == null) {
      setState(() {
        _isLoading = false;
        _error = 'اختر المادة الدراسية أولًا.';
      });
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final list = await widget.aiService.generateStudyPlan(
        targetDate: DateTime.now().toIso8601String().split('T').first,
        subjectId: subjectId,
      );
      if (!mounted) return;
      setState(() {
        _items = list;
        if (list.isEmpty) {
          _error = 'تعذر إنشاء خطة من المصادر المعتمدة حاليًا.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is TutorApiException
            ? e.message
            : 'حدث خطأ أثناء إنشاء الخطة. ($e)';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('خطة المذاكرة الذكية')),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: _subjectsLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _subjects.isEmpty
                      ? Text(_error ?? 'لا توجد مواد متاحة.',
                          style: const TextStyle(color: Colors.red))
                      : DropdownButtonFormField<String>(
                          value: _selectedSubjectId,
                          decoration: const InputDecoration(
                            labelText: 'اختر المادة الدراسية',
                            border: OutlineInputBorder(),
                          ),
                          items: _subjects
                              .map((s) => DropdownMenuItem(
                                  value: s.subjectId,
                                  child: Text(s.name)))
                              .toList(),
                          onChanged: (val) {
                            setState(() {
                              _selectedSubjectId = val;
                              _items = [];
                            });
                            _loadStudyPlan();
                          },
                        ),
            ),
            if (_error != null && _subjects.isNotEmpty)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16),
                child: Text(_error!,
                    style: const TextStyle(color: Colors.red)),
              ),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items.length,
                      itemBuilder: (context, index) {
                        final item = _items[index];
                        return Card(
                          margin:
                              const EdgeInsets.only(bottom: 12),
                          child: CheckboxListTile(
                            value: item.isCompleted,
                            onChanged: (val) {
                              setState(() {
                                item.isCompleted = val ?? false;
                              });
                            },
                            title: Text(
                                '${item.day}: ${item.subjectName} - ${item.topic}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                            subtitle: Text(
                                'المدة: ${item.durationMinutes} دقيقة | النشاط: ${item.activity}'),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
