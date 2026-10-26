import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../services/ai_tutor_service.dart';
import '../services/student_service.dart';
import '../services/branding_service.dart';
import '../models/app_branding.dart';
import '../models/student_profile.dart';
import 'profile_screen.dart';
import 'groups_screen.dart';
import 'homework_screen.dart';
import 'schedule_screen.dart';
import 'attendance_screen.dart';
import 'grades_screen.dart';
import 'online_exams_list_screen.dart';
import 'educational_content_screen.dart';
import 'notifications_screen.dart';
import 'ai_tutor_home_screen.dart';
import 'ai_chat_screen.dart';
import 'ai_lesson_explainer_screen.dart';
import 'ai_self_test_screen.dart';
import 'ai_vip_activation_screen.dart';

class HomeScreen extends StatefulWidget {
  final AppBranding? branding;
  const HomeScreen({super.key, this.branding});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final StudentService _studentService = StudentService();
  final BrandingService _brandingService = BrandingService();
  final StudentAITutorService _aiService = StudentAITutorService();
  final AuthService _authService = AuthService();

  AppBranding? _branding;
  StudentProfileDTO? _profile;
  bool _isLoading = true;
  int _groupsCount = 0;
  String _attendanceRate = '100%';

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);

    // 1. Fetch Dynamic Center Branding
    AppBranding b = widget.branding ?? await _brandingService.fetchAuthenticatedBranding();

    // 2. Fetch Profile & Live Stats
    StudentProfileDTO? p;
    int gCount = 0;
    String attRate = '—';

    try {
      p = await _studentService.fetchCurrentStudentProfile();
      if (p != null) {
        gCount = p.groupIds.length;

        // Fetch quick attendance rate
        try {
          final history = await _studentService.fetchStudentAttendanceHistory();
          if (history.isNotEmpty) {
            final present = history.where((r) => r.status.name == 'present').length;
            attRate = '${((present / history.length) * 100).toInt()}%';
          }
        } catch (_) {}
      }
    } catch (_) {}

    if (mounted) {
      setState(() {
        _branding = b;
        _profile = p;
        _groupsCount = gCount;
        _attendanceRate = attRate;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = _branding ?? widget.branding ?? AppBranding.platformDefault();
    final user = FirebaseAuth.instance.currentUser;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          elevation: 0,
          backgroundColor: b.primaryColor,
          foregroundColor: Colors.white,
          titleSpacing: 16,
          title: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.asset(
                  'assets/logo.png',
                  width: 32,
                  height: 32,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => (b.logoUrl != null && b.logoUrl!.isNotEmpty)
                      ? Image.network(b.logoUrl!, width: 32, height: 32, errorBuilder: (_, __, ___) => const Icon(Icons.school, size: 28))
                      : const Icon(Icons.school, size: 28),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      b.centerName,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      b.welcomeMessage,
                      style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.85)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.notifications_none_rounded),
              tooltip: 'الإشعارات',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const StudentNotificationsScreen()),
                );
              },
            ),
            IconButton(
              icon: const Icon(Icons.logout_rounded),
              tooltip: 'تسجيل الخروج',
              onPressed: () async => await _authService.signOut(),
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: _loadDashboardData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_isLoading) ...[
                  const LinearProgressIndicator(minHeight: 3),
                  const SizedBox(height: 8),
                ],
                // 1. Modern Hero Profile Banner
                _buildStudentHeroBanner(b, user),

                const SizedBox(height: 16),

                // 2. Featured AI Tutor Interactive Banner
                _buildAiTutorHeroBanner(),

                const SizedBox(height: 20),

                // 3. Academic Services Section Title
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'الخدمات الأكاديمية والأنشطة',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    Text(
                      _profile?.stageName ?? 'المرحلة الدراسية',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: b.secondaryColor,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // 4. Interactive Grid of Services
                _buildServicesGrid(context, b),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Modern Gradient Student Greeting Card with Quick Stats
  Widget _buildStudentHeroBanner(AppBranding b, User? user) {
    final studentName = _profile?.fullName ?? (user?.email?.split('@').first ?? 'طالب رِماس');
    final studentCode = _profile?.studentCode ?? '—';

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [b.primaryColor, const Color(0xFF1E1B4B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: b.primaryColor.withOpacity(0.25),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withOpacity(0.15),
                  border: Border.all(color: Colors.white.withOpacity(0.3), width: 1.5),
                ),
                child: const Icon(Icons.person, color: Colors.white, size: 34),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'أهلاً بك يا بطل،',
                      style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.85)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      studentName,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withOpacity(0.2)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.qr_code, color: Colors.white, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      studentCode,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),
          const Divider(color: Colors.white24, height: 1),
          const SizedBox(height: 14),

          // 3 Quick Indicator Pills
          Row(
            children: [
              _buildStatPill('المجموعات المسجلة', '$_groupsCount مجموعات', Icons.group_outlined),
              const SizedBox(width: 10),
              _buildStatPill('نسبة الحضور', _attendanceRate, Icons.check_circle_outline),
              const SizedBox(width: 10),
              _buildStatPill('الحالة الأكاديمية', 'نشط ومنتظم', Icons.verified_outlined),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatPill(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 13, color: Colors.white70),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    label,
                    style: const TextStyle(fontSize: 10, color: Colors.white70),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToAi(BuildContext context, Widget destination) {
    final isVip = _profile?.isVip == true && (_profile?.aiQuestionsBalance ?? 0) > 0;
    if (isVip) {
      Navigator.push(context, MaterialPageRoute(builder: (context) => destination));
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => AIVipActivationScreen(aiService: _aiService)),
      ).then((_) {
        _loadDashboardData();
      });
    }
  }

  /// Interactive AI Tutor Featured Banner
  Widget _buildAiTutorHeroBanner() {
    final isVip = _profile?.isVip == true && (_profile?.aiQuestionsBalance ?? 0) > 0;
    final balance = _profile?.aiQuestionsBalance ?? 0;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isVip
              ? [const Color(0xFF6D28D9), const Color(0xFF4C1D95)]
              : [const Color(0xFF1E293B), const Color(0xFF0F172A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isVip ? const Color(0xFFC084FC).withOpacity(0.5) : const Color(0xFF334155),
        ),
        boxShadow: [
          BoxShadow(
            color: isVip ? const Color(0xFF7C3AED).withOpacity(0.3) : Colors.black.withOpacity(0.2),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: isVip ? Colors.white.withOpacity(0.2) : const Color(0xFF334155),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isVip ? Icons.auto_awesome : Icons.lock_outline,
                  color: isVip ? const Color(0xFFFBBF24) : const Color(0xFFEF4444),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'المساعد الذكي للطلاب (AI Tutor)',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isVip ? const Color(0xFF065F46) : const Color(0xFF7F1D1D),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isVip ? 'VIP 👑' : 'مقفل 🔒',
                            style: TextStyle(
                              color: isVip ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isVip
                          ? 'رصيدك المتاح: $balance سؤال ذكي • شروحات وحلول فورية'
                          : 'القسم مقفل بكود تفعيل • اضغط هنا لتفعيل كود السنتر',
                      style: TextStyle(
                        fontSize: 12,
                        color: isVip ? Colors.white70 : const Color(0xFFFCA5A5),
                        fontWeight: isVip ? FontWeight.normal : FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _buildAiQuickAction(
                label: isVip ? '💬 اسأل سؤالاً' : '🔒 اسأل سؤالاً',
                onTap: () => _navigateToAi(context, AIChatScreen(aiService: _aiService)),
              ),
              const SizedBox(width: 8),
              _buildAiQuickAction(
                label: isVip ? '📖 اشرح لي درس' : '🔒 اشرح لي درس',
                onTap: () => _navigateToAi(context, AILessonExplainerScreen(aiService: _aiService, mode: 'EXPLAIN')),
              ),
              const SizedBox(width: 8),
              _buildAiQuickAction(
                label: isVip ? '🎯 اختبار ذاتي' : '🔒 اختبار ذاتي',
                onTap: () => _navigateToAi(context, AISelfTestScreen(aiService: _aiService)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAiQuickAction({required String label, required VoidCallback onTap}) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.18),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withOpacity(0.25)),
          ),
          child: Text(
            label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ),
      ),
    );
  }

  /// Modern 2-column Grid of Services
  Widget _buildServicesGrid(BuildContext context, AppBranding b) {
    final isVip = _profile?.isVip == true && (_profile?.aiQuestionsBalance ?? 0) > 0;

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.15,
      children: [
        _buildServiceCard(
          context,
          title: isVip ? 'المساعد الذكي (VIP)' : 'المساعد الذكي (مقفل 🔒)',
          subtitle: isVip ? 'شرح، تلخيص، واختبارات' : 'اضغط للتفعيل بكود السنتر',
          icon: isVip ? Icons.psychology_rounded : Icons.lock_outline,
          gradientColors: isVip
              ? [const Color(0xFF7C3AED), const Color(0xFF6D28D9)]
              : [const Color(0xFF334155), const Color(0xFF1E293B)],
          onTap: () {
            _navigateToAi(context, AITutorHomeScreen(aiService: _aiService));
          },
        ),
        _buildServiceCard(
          context,
          title: 'المجموعات والمواد',
          subtitle: 'مجموعاتي في السنتر',
          icon: Icons.groups_rounded,
          gradientColors: [const Color(0xFF0284C7), const Color(0xFF0369A1)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const GroupsScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'الجدول الدراسي',
          subtitle: 'مواعيد الحصص والقاعات',
          icon: Icons.calendar_month_rounded,
          gradientColors: [const Color(0xFFD97706), const Color(0xFFB45309)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const ScheduleScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'الحضور والغياب',
          subtitle: 'سجل حضور المحاضرات',
          icon: Icons.how_to_reg_rounded,
          gradientColors: [const Color(0xFF059669), const Color(0xFF047857)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const AttendanceScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'النتائج والدرجات',
          subtitle: 'تقارير درجات الامتحانات',
          icon: Icons.workspace_premium_rounded,
          gradientColors: [const Color(0xFFEA580C), const Color(0xFFC2410C)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const GradesScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'الامتحانات الإلكترونية',
          subtitle: 'الاختبارات والتقييمات',
          icon: Icons.quiz_rounded,
          gradientColors: [const Color(0xFF2563EB), const Color(0xFF1D4ED8)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const OnlineExamsListScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'المحتوى التعليمي',
          subtitle: 'المذكرات والفيديوهات',
          icon: Icons.menu_book_rounded,
          gradientColors: [const Color(0xFF4F46E5), const Color(0xFF4338CA)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const EducationalContentScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'الواجبات المنزلية',
          subtitle: 'المهام والتكليفات',
          icon: Icons.task_alt_rounded,
          gradientColors: [const Color(0xFF0D9488), const Color(0xFF0F766E)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const HomeworkScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'بطاقة الطالب (QR)',
          subtitle: 'باركود الحضور والبيانات',
          icon: Icons.badge_rounded,
          gradientColors: [const Color(0xFF475569), const Color(0xFF334155)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const ProfileScreen()),
            );
          },
        ),
        _buildServiceCard(
          context,
          title: 'مركز الإشعارات',
          subtitle: 'تنبيهات ورسائل السنتر',
          icon: Icons.notifications_active_rounded,
          gradientColors: [const Color(0xFFE11D48), const Color(0xFFBE123C)],
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const StudentNotificationsScreen()),
            );
          },
        ),
      ],
    );
  }

  Widget _buildServiceCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required List<Color> gradientColors,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: gradientColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: gradientColors.first.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(icon, color: Colors.white, size: 26),
                ),
                const SizedBox(height: 10),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF64748B),
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
