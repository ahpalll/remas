import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
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

class DashboardHomeView extends StatefulWidget {
  const DashboardHomeView({super.key});

  @override
  State<DashboardHomeView> createState() => _DashboardHomeViewState();
}

/// Per-section load state: one failing source must not hide the others.
class _SectionState<T> {
  final bool loading;
  final T? data;
  final String? error;

  const _SectionState.loading()
      : loading = true,
        data = null,
        error = null;

  const _SectionState.ok(this.data)
      : loading = false,
        error = null;

  const _SectionState.failed(this.error)
      : loading = false,
        data = null;
}

class _DashboardHomeViewState extends State<DashboardHomeView> {
  _SectionState<List<InstitutionRecord>> _insts = const _SectionState.loading();
  _SectionState<List<LicenseRecord>> _lics = const _SectionState.loading();
  _SectionState<List<DeviceBindingRecord>> _devs = const _SectionState.loading();
  _SectionState<PeopleSummary> _people = const _SectionState.loading();
  int? _firestoreLatencyMs;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool _isSessionError(String e) =>
      e.contains('SESSION_EXPIRED') ||
      e.contains('UNAUTHENTICATED') ||
      e.contains('UNAUTHORIZED_CALLER_ROLE');

  Future<void> _load() async {
    setState(() {
      _insts = const _SectionState.loading();
      _lics = const _SectionState.loading();
      _devs = const _SectionState.loading();
      _people = const _SectionState.loading();
    });
    final sw = Stopwatch()..start();
    // Institutions first: people counts are scoped to this list.
    List<InstitutionRecord> instList = [];
    try {
      instList = await SuperAdminService.getInstitutions()
          .timeout(const Duration(seconds: 20));
      if (!mounted) return;
      setState(() => _insts = _SectionState.ok(instList));
      sw.stop();
      _firestoreLatencyMs = sw.elapsedMilliseconds;
    } catch (e) {
      if (!mounted) return;
      setState(() => _insts = _SectionState.failed(e.toString()));
    }
    // Licenses / devices / people load independently (fail-isolated).
    SuperAdminService.getLicenses()
        .timeout(const Duration(seconds: 20))
        .then((v) {
      if (mounted) setState(() => _lics = _SectionState.ok(v));
    }).catchError((Object e) {
      if (mounted) setState(() => _lics = _SectionState.failed(e.toString()));
    });
    SuperAdminService.getDeviceBindings()
        .timeout(const Duration(seconds: 20))
        .then((v) {
      if (mounted) setState(() => _devs = _SectionState.ok(v));
    }).catchError((Object e) {
      if (mounted) setState(() => _devs = _SectionState.failed(e.toString()));
    });
    if (instList.isNotEmpty) {
      SuperAdminService.getPeopleSummary(
              institutionIds: instList.map((i) => i.institutionId).toList())
          .then((v) {
        if (mounted) setState(() => _people = _SectionState.ok(v));
      }).catchError((Object e) {
        if (mounted) setState(() => _people = _SectionState.failed(e.toString()));
      });
    } else if (_insts.error == null) {
      // Zero institutions: zero people (honest scope, not missing data).
      if (mounted) {
        setState(() => _people = _SectionState.ok(PeopleSummary.emptyScope()));
      }
    } else {
      if (mounted) {
        setState(() => _people = _SectionState.failed(_insts.error));
      }
    }
  }

  void _goToLogin() {
    SuperAdminService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final licList = _lics.data;
    int licActive = 0, licExpired = 0, licOther = 0;
    if (licList != null) {
      for (final l in licList) {
        switch (LicenseStatusView.classify(l, now)) {
          case LicenseStatusView.active:
            licActive++;
            break;
          case LicenseStatusView.expired:
            licExpired++;
            break;
          default:
            licOther++;
        }
      }
    }
    final devList = _devs.data;
    int devBound = 0, devPending = 0, devOther = 0;
    if (devList != null) {
      for (final d in devList) {
        if (d.status == 'BOUND') {
          devBound++;
        } else if (d.status == 'PENDING') {
          devPending++;
        } else {
          devOther++;
        }
      }
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
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
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const Text(
                          'جلسة SuperAdmin موثقة عبر Firebase Auth (تحقق من الـ Custom Claims)',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (_firestoreLatencyMs != null)
                          Text(
                            'زمن قراءة Firestore المقاس: $_firestoreLatencyMs ms (REAL)',
                            style: const TextStyle(color: Color(0xFF4ADE80), fontSize: 11),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text('📊 مؤشرات التشغيل الرئيسية (REAL — من Firestore)',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.02,
              children: [
                _buildKpiCard(
                  title: 'إجمالي المؤسسات',
                  icon: Icons.business_rounded,
                  color: const Color(0xFF38BDF8),
                  section: _insts,
                  valueText: (v) => '${v.length}',
                  subtitle: 'من Firestore: institutions',
                  onRetry: _load,
                  onLogin: _goToLogin,
                ),
                _buildKpiCard(
                  title: 'التراخيص: نشط / منتهٍ / أخرى',
                  icon: Icons.key_rounded,
                  color: const Color(0xFF4ADE80),
                  section: _lics,
                  valueText: (_) => '$licActive / $licExpired / $licOther',
                  subtitle: 'من Firestore: licenses',
                  onRetry: _load,
                  onLogin: _goToLogin,
                ),
                _buildKpiCard(
                  title: 'الأجهزة: مرتبط / معلّق / أخرى',
                  icon: Icons.devices_rounded,
                  color: const Color(0xFFFBBF24),
                  section: _devs,
                  valueText: (_) => '$devBound / $devPending / $devOther',
                  subtitle: 'من Firestore: deviceBindings',
                  onRetry: _load,
                  onLogin: _goToLogin,
                ),
                _buildKpiCard(
                  title: 'الطلاب / المعلمون',
                  icon: Icons.people_rounded,
                  color: const Color(0xFFA78BFA),
                  section: _people,
                  valueText: (v) {
                    if (!v.available) return 'غير متاح';
                    return '${v.totalStudents} / ${v.totalTeachers}';
                  },
                  subtitleBuilder: (v) {
                    if (!v.available) return _shortReason(v.reason);
                    if (v.institutionsTotal == 0) return 'لا توجد مؤسسات في النطاق';
                    if (v.isPartial) {
                      return 'عُدّت ${v.institutionsCounted} من ${v.institutionsTotal} مؤسسة — ${v.failedInstitutionIds.length} تعذّر قراءتها';
                    }
                    return 'عدّ حقيقي عبر ${v.institutionsCounted} مؤسسة';
                  },
                  onRetry: _load,
                  onLogin: _goToLogin,
                ),
              ],
            ),
            const SizedBox(height: 20),

            const Text('⚠️ تنبيهات النظام (REAL — مشتقة من المصادر المقروءة)',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildAlertsCard(
              licExpired: _lics.data == null ? null : licExpired,
              devPending: _devs.data == null ? null : devPending,
              licError: _lics.error,
              devError: _devs.error,
            ),
          ],
        ),
      ),
    );
  }

  String _shortReason(String reason) {
    final clean = reason.replaceAll('Exception: ', '');
    return clean.length > 140 ? '${clean.substring(0, 140)}…' : clean;
  }

  Widget _buildAlertsCard({
    required int? licExpired,
    required int? devPending,
    required String? licError,
    required String? devError,
  }) {
    final lines = <String>[];
    if (licExpired != null && licExpired > 0) {
      lines.add('⚠️ $licExpired ترخيصًا منتهيًا يحتاج تجديدًا أو مراجعة.');
    }
    if (devPending != null && devPending > 0) {
      lines.add('⏳ $devPending طلب ربط جهاز معلّق (PENDING) بانتظار الاعتماد.');
    }
    if (licExpired == null && licError != null) {
      lines.add('تعذّر تقييم التراخيص: ${_shortReason(licError)}');
    }
    if (devPending == null && devError != null) {
      lines.add('تعذّر تقييم الأجهزة: ${_shortReason(devError)}');
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: lines.isEmpty
          ? const Text(
              'لا توجد تنبيهات مستحقة الآن حسب المصادر المقروءة (لا تنبيهات مخترعة).',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final line in lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(line,
                        style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 12)),
                  ),
              ],
            ),
    );
  }

  Widget _buildKpiCard<T>({
    required String title,
    required IconData icon,
    required Color color,
    required _SectionState<T> section,
    required String Function(T value) valueText,
    String? subtitle,
    String Function(T value)? subtitleBuilder,
    required Future<void> Function() onRetry,
    required void Function() onLogin,
  }) {
    String? body;
    String? sub;
    bool failed = false;
    bool session = false;
    if (section.data != null) {
      body = valueText(section.data as T);
      sub = subtitleBuilder != null ? subtitleBuilder(section.data as T) : subtitle;
    } else if (section.error != null) {
      failed = true;
      session = _isSessionError(section.error!);
      body = session ? 'انتهت الجلسة' : 'تعذّر التحميل';
      sub = _shortReason(section.error!);
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: failed ? const Color(0xFF991B1B) : const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 11,
                        fontWeight: FontWeight.bold),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: 4),
              Icon(icon, color: color, size: 20),
            ],
          ),
          if (section.loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(
                    color: Color(0xFF38BDF8), strokeWidth: 2),
              ),
            )
          else ...[
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Text(body ?? '—',
                  style: TextStyle(
                      color: failed ? const Color(0xFFF87171) : color,
                      fontSize: 22,
                      fontWeight: FontWeight.bold)),
            ),
            Text(sub ?? '',
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 10),
                maxLines: 3,
                overflow: TextOverflow.ellipsis),
            if (failed)
              TextButton(
                style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 28),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                onPressed: session ? onLogin : onRetry,
                child: Text(session ? 'تسجيل الدخول مجددًا' : 'إعادة المحاولة',
                    style: const TextStyle(
                        color: Color(0xFF38BDF8), fontSize: 11)),
              ),
          ],
        ],
      ),
    );
  }
}
