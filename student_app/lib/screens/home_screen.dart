import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../services/ai_tutor_service.dart';
import 'profile_screen.dart';
import 'groups_screen.dart';
import 'schedule_screen.dart';
import 'attendance_screen.dart';
import 'grades_screen.dart';
import 'online_exams_list_screen.dart';
import 'educational_content_screen.dart';
import 'subscription_screen.dart';
import 'notifications_screen.dart';
import 'ai_tutor_home_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final authService = AuthService();
    final aiService = StudentAITutorService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('منصة الطالب'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'الإشعارات',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const StudentNotificationsScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ProfileScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await authService.signOut();
            },
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              elevation: 3,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    const CircleAvatar(
                      radius: 28,
                      backgroundColor: Colors.deepPurple,
                      child: Icon(Icons.person, size: 32, color: Colors.white),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'أهلاً بك، ${user?.email?.split('@').first ?? "طالب"}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'كود الطالب: STU-100201',
                            style: TextStyle(color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'الخدمات الأكاديمية:',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                children: [
                  _buildDashboardTile(
                    context,
                    title: 'المساعد الذكي',
                    subtitle: 'شرح، تلخيص، واختبارات',
                    icon: Icons.psychology,
                    color: Colors.purple.shade800,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => AITutorHomeScreen(aiService: aiService)),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'الامتحانات الإلكترونية',
                    subtitle: 'الاختبارات والتقييمات',
                    icon: Icons.assignment_outlined,
                    color: Colors.blue,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const OnlineExamsListScreen()),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'المجموعات والمواد',
                    subtitle: 'مجموعاتي الدراسية',
                    icon: Icons.group_work,
                    color: Colors.teal,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const GroupsScreen()),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'الجدول الدراسي',
                    subtitle: 'المواعيد والقاعات',
                    icon: Icons.schedule,
                    color: Colors.orange,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const ScheduleScreen()),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'الحضور والغياب',
                    subtitle: 'سجل المحاضرات',
                    icon: Icons.calendar_today,
                    color: Colors.green,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const AttendanceScreen()),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'النتائج والدرجات',
                    subtitle: 'تقارير الأداء',
                    icon: Icons.grade,
                    color: Colors.purple,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const GradesScreen()),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'المحتوى التعليمي',
                    subtitle: 'الشروحات والوسائط',
                    icon: Icons.video_library,
                    color: Colors.indigo,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const EducationalContentScreen()),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'الاشتراكات والأكواد',
                    subtitle: 'تفعيل الكود والصلاحيات',
                    icon: Icons.confirmation_number_outlined,
                    color: Colors.deepOrange,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const SubscriptionScreen()),
                      );
                    },
                  ),
                  _buildDashboardTile(
                    context,
                    title: 'الملف الشخصي',
                    subtitle: 'بياناتي والحساب',
                    icon: Icons.person_pin,
                    color: Colors.brown,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const ProfileScreen()),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboardTile(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 36, color: color),
              const SizedBox(height: 8),
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 11, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
