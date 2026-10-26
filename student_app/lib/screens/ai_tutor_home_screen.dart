import 'package:flutter/material.dart';
import '../services/ai_tutor_service.dart';
import 'ai_chat_screen.dart';
import 'ai_lesson_explainer_screen.dart';
import 'ai_self_test_screen.dart';
import 'ai_weakness_screen.dart';
import 'ai_study_plan_screen.dart';

import '../services/student_service.dart';
import 'ai_vip_activation_screen.dart';

/// Main Arabic RTL AI Dashboard ("المساعد الذكي") featuring 8 Quick-Action Cards
class AITutorHomeScreen extends StatefulWidget {
  final StudentAITutorService aiService;

  const AITutorHomeScreen({
    super.key,
    required this.aiService,
  });

  @override
  State<AITutorHomeScreen> createState() => _AITutorHomeScreenState();
}

class _AITutorHomeScreenState extends State<AITutorHomeScreen> {
  final StudentService _studentService = StudentService();

  @override
  Widget build(BuildContext context) {
    final profile = _studentService.activeMembership;
    final balance = profile?.aiQuestionsBalance ?? 0;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('المساعد الذكي — ريماس'),
          backgroundColor: Colors.deepPurple.shade800,
          foregroundColor: Colors.white,
          actions: [
            IconButton(
              icon: const Icon(Icons.add_card),
              tooltip: 'شحن كود إضافي',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => AIVipActivationScreen(aiService: widget.aiService)),
                ).then((_) => setState(() {}));
              },
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // VIP Banner & Quota Balance
              Card(
                color: const Color(0xFF1E1B4B),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: Color(0xFF8B5CF6)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF8B5CF6).withOpacity(0.25),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.workspace_premium, color: Color(0xFFFBBF24), size: 32),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Text(
                                  'المساعد الذكي VIP',
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF065F46),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'مفعل 🟢',
                                    style: TextStyle(color: Color(0xFF86EFAC), fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'رصيد الأسئلة المتبقي: $balance سؤال ذكي',
                              style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFC084FC),
                          side: const BorderSide(color: Color(0xFF8B5CF6)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => AIVipActivationScreen(aiService: widget.aiService)),
                          ).then((_) => setState(() {}));
                        },
                        child: const Text('شحن كود ➕', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              const Text(
                'الخدمات الذكية المتاحة (8 أدوات)',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              // 8 Quick Action Cards Grid
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.25,
                children: [
                  // Card 1: Interactive Chat
                  _buildActionCard(
                    context,
                    title: 'اسأل المساعد',
                    subtitle: 'محادثة تعليمية ذكية',
                    icon: Icons.chat_bubble_outline,
                    color: Colors.indigo,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AIChatScreen(aiService: widget.aiService),
                        ),
                      );
                    },
                  ),
                  // Card 2: Quick review with REVIEW mode
                  _buildActionCard(
                    context,
                    title: 'مراجعة سريعة',
                    subtitle: 'نقاط وأسئلة مراجعة',
                    icon: Icons.rate_review,
                    color: Colors.teal,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AIChatScreen(
                            aiService: widget.aiService,
                            initialMode: 'REVIEW',
                          ),
                        ),
                      );
                    },
                  ),
                  // Card 3: Lesson Explainer
                  _buildActionCard(
                    context,
                    title: 'اشرح لي الدرس',
                    subtitle: 'شرح مبسط وتفصيلي',
                    icon: Icons.menu_book,
                    color: Colors.deepOrange,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AILessonExplainerScreen(aiService: widget.aiService, mode: 'EXPLAIN'),
                        ),
                      );
                    },
                  ),
                  // Card 4: Content Summarizer
                  _buildActionCard(
                    context,
                    title: 'لخص لي',
                    subtitle: 'أهم النقاط والقوانين',
                    icon: Icons.summarize,
                    color: Colors.amber.shade900,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AILessonExplainerScreen(aiService: widget.aiService, mode: 'SUMMARIZE'),
                        ),
                      );
                    },
                  ),
                  // Card 5: Self-Test Generator
                  _buildActionCard(
                    context,
                    title: 'اختبرني',
                    subtitle: 'أسئلة وتدريبات تفاعلية',
                    icon: Icons.quiz,
                    color: Colors.purple,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AISelfTestScreen(aiService: widget.aiService),
                        ),
                      );
                    },
                  ),
                  // Card 6: Weakness Analysis
                  _buildActionCard(
                    context,
                    title: 'تحليل مستواي',
                    subtitle: 'نقاط القوة والتحسين',
                    icon: Icons.analytics,
                    color: Colors.blue.shade800,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AIWeaknessScreen(aiService: widget.aiService),
                        ),
                      );
                    },
                  ),
                  // Card 7: Study Plan Timetable
                  _buildActionCard(
                    context,
                    title: 'خطة مذاكرتي',
                    subtitle: 'جدول مذاكرة تفاعلي',
                    icon: Icons.calendar_month,
                    color: Colors.green.shade800,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AIStudyPlanScreen(aiService: widget.aiService),
                        ),
                      );
                    },
                  ),
                  // Card 8: Exam Preparation
                  _buildActionCard(
                    context,
                    title: 'استعد للامتحان',
                    subtitle: 'قائمة مراجعة سريعة',
                    icon: Icons.assignment_turned_in,
                    color: Colors.red.shade800,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AIChatScreen(
                            aiService: widget.aiService,
                            initialPrompt: 'استعد للامتحان: أنشئ لي خطة مراجعة سريعة لاختبار الرياضيات.',
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: color.withValues(alpha: 0.2)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: color.withValues(alpha: 0.12),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 10),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
