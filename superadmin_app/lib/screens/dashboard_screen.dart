import 'package:flutter/material.dart';
import 'package:superadmin_app/services/superadmin_service.dart';
import 'package:superadmin_app/screens/login_screen.dart';
import 'package:superadmin_app/screens/institutions_screen.dart';
import 'package:superadmin_app/screens/licenses_screen.dart';
import 'package:superadmin_app/screens/devices_screen.dart';
import 'package:superadmin_app/screens/ai_control_screen.dart';
import 'package:superadmin_app/screens/usage_screen.dart';
import 'package:superadmin_app/screens/system_health_screen.dart';
import 'package:superadmin_app/screens/audit_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;

  final List<Widget> _pages = [
    const DashboardHomeView(),
    const InstitutionsScreen(),
    const LicensesScreen(),
    const DevicesScreen(),
    const AIControlScreen(),
    const UsageScreen(),
    const SystemHealthScreen(),
    const AuditScreen(),
  ];

  void _handleLogout() {
    SuperAdminService.logout();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('👑 REMAS EDU SuperAdmin', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFF87171)),
            onPressed: _handleLogout,
            tooltip: 'تسجيل الخروج',
          ),
        ],
      ),
      body: _pages[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: const Color(0xFF38BDF8),
        unselectedItemColor: const Color(0xFF64748B),
        selectedFontSize: 11,
        unselectedFontSize: 10,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_rounded), label: 'الرئيسية'),
          BottomNavigationBarItem(icon: Icon(Icons.business_rounded), label: 'المؤسسات'),
          BottomNavigationBarItem(icon: Icon(Icons.key_rounded), label: 'التراخيص'),
          BottomNavigationBarItem(icon: Icon(Icons.devices_rounded), label: 'الأجهزة'),
          BottomNavigationBarItem(icon: Icon(Icons.smart_toy_rounded), label: 'الذكاء'),
          BottomNavigationBarItem(icon: Icon(Icons.analytics_rounded), label: 'الاستهلاك'),
          BottomNavigationBarItem(icon: Icon(Icons.health_and_safety_rounded), label: 'السلامة'),
          BottomNavigationBarItem(icon: Icon(Icons.history_rounded), label: 'السجل'),
        ],
      ),
    );
  }
}

class DashboardHomeView extends StatelessWidget {
  const DashboardHomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF0284C7)),
            ),
            child: Row(
              children: [
                const Icon(Icons.verified_user_rounded, color: Color(0xFF38BDF8), size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        SuperAdminService.currentUser?.email ?? 'SuperAdmin Operator',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const Text(
                        'جلسة موثقة بكاميرات الأمان السحابية (Cloud Authenticated SuperAdmin)',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text('📊 مؤشرات التشغيل الرئيسية', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: [
              _buildKpiCard('إجمالي المؤسسات', '12', '11 نشطة | 1 معلقة', Icons.business_rounded, const Color(0xFF38BDF8)),
              _buildKpiCard('التراخيص المفعّلة', '11', '1 معلقة | 1 ملغاة', Icons.key_rounded, const Color(0xFF4ADE80)),
              _buildKpiCard('الأجهزة المرتبطة', '11', '1 غير مرتبط', Icons.devices_rounded, const Color(0xFFFBBF24)),
              _buildKpiCard('إجمالي الطلاب', '1,450', '85 معلم | 1,200 ولي أمر', Icons.people_rounded, const Color(0xFFA78BFA)),
            ],
          ),
          const SizedBox(height: 20),

          const Text('⚠️ تنبيهات النظام الحية', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF451A03),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFD97706)),
            ),
            child: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Color(0xFFFBBF24)),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'تنبيه: محاولة ربط ترخيص على جهاز آخر لمؤسسة مركز القاهرة (DEVICE_LIMIT_EXCEEDED)',
                    style: TextStyle(color: Color(0xFFFEF3C7), fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard(String title, String value, String subtitle, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.bold)),
              Icon(icon, color: color, size: 20),
            ],
          ),
          Text(value, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.bold)),
          Text(subtitle, style: const TextStyle(color: Color(0xFF64748B), fontSize: 10)),
        ],
      ),
    );
  }
}
