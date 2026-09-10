import 'package:flutter/material.dart';
import '../services/ai_tutor_service.dart';
import 'ai_chat_screen.dart';
import 'ai_lesson_explainer_screen.dart';
import 'ai_self_test_screen.dart';
import 'ai_weakness_screen.dart';
import 'ai_study_plan_screen.dart';

/// Main Arabic RTL AI Dashboard ("المساعد الذكي") featuring 8 Quick-Action Cards
class AITutorHomeScreen extends StatelessWidget {
  final StudentAITutorService aiService;

  const AITutorHomeScreen({
    super.key,
    required this.aiService,
  });

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('المساعد الذكي — ريماس'),
          backgroundColor: Colors.deepPurple.shade800,
          foregroundColor: Colors.white,
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Banner
              Card(
                color: Colors.deepPurple.shade50,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.deepPurple.shade200),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: Colors.deepPurple.shade800,
                        child: const Icon(Icons.psychology, color: Colors.white, size: 36),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'مرحباً بك في المساعد الذكي',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'مساعدك المعتمد للشرح، التلخيص، الاختبارات، وتحليل المستوى بناءً على المواد الدراسية.',
                              style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

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
                          builder: (context) => AIChatScreen(aiService: aiService),
                        ),
                      );
                    },
                  ),
                  // Card 2: Lesson/Video Specific Q&A
                  _buildActionCard(
                    context,
                    title: 'اسأل عن الدرس / الفيديو',
                    subtitle: 'أسئلة مرتبطة بدرس معين',
                    icon: Icons.ondemand_video,
                    color: Colors.teal,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AIChatScreen(
                            aiService: aiService,
                            initialLessonId: 'les_math_calculus_01',
                            initialLessonTitle: 'درس التفاضل والتكامل',
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
                          builder: (context) => AILessonExplainerScreen(aiService: aiService, mode: 'EXPLAIN'),
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
                          builder: (context) => AILessonExplainerScreen(aiService: aiService, mode: 'SUMMARIZE'),
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
                          builder: (context) => AISelfTestScreen(aiService: aiService),
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
                          builder: (context) => AIWeaknessScreen(aiService: aiService),
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
                          builder: (context) => AIStudyPlanScreen(aiService: aiService),
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
                            aiService: aiService,
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
