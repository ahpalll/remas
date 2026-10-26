import 'package:flutter/material.dart';
import '../models/ai_models.dart';
import '../services/ai_tutor_service.dart';

/// Non-Diagnostic Weakness Analysis Screen ("تحليل مستواي")
class AIWeaknessScreen extends StatelessWidget {
  final StudentAITutorService aiService;

  const AIWeaknessScreen({super.key, required this.aiService});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('تحليل المستوي الدراسي الذكي')),
        body: FutureBuilder<AIWeaknessReportDTO>(
          future: aiService.analyzeWeaknesses(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            // Adaptive weakness analytics ships in AI-6; until then the
            // service honestly reports unavailability (never mock numbers).
            if (snapshot.hasError || snapshot.data == null) {
              final err = snapshot.error;
              final msg = err is TutorApiException
                  ? err.message
                  : 'تعذر جلب تقرير تحليل المستوى.';
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.analytics_outlined,
                          size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      Text(msg, textAlign: TextAlign.center),
                    ],
                  ),
                ),
              );
            }
            final report = snapshot.data!;

            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Card(
                    color: Colors.blue.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: Colors.blue.shade800,
                            child: Text(
                              '${report.overallPercentage.toInt()}%',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ),
                          const SizedBox(width: 16),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('المعدل العام للاختبارات', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                SizedBox(height: 4),
                                Text('تحليل تربوي أكاديمي قائم على نتائج الاختبارات المسجلة.', style: TextStyle(fontSize: 12, color: Colors.black54)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text('مواضيع الإتقان (نقاط القوة)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.green)),
                  const SizedBox(height: 8),
                  ...report.strongTopics.map((t) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.check_circle, color: Colors.green),
                          title: Text(t),
                        ),
                      )),
                  const SizedBox(height: 20),
                  const Text('مواضيع تتطلب المراجعة (نقاط التحسين)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.orange)),
                  const SizedBox(height: 8),
                  ...report.weakTopics.map((t) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.priority_high, color: Colors.orange),
                          title: Text(t),
                        ),
                      )),
                  const SizedBox(height: 20),
                  const Text('توصيات المساعد الذكي', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  ...report.recommendations.map((r) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('• ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            Expanded(child: Text(r, style: const TextStyle(fontSize: 14))),
                          ],
                        ),
                      )),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
