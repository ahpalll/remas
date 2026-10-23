import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/screens/onboarding_wizard_screen.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

class InstitutionsScreen extends StatefulWidget {
  const InstitutionsScreen({super.key});

  @override
  State<InstitutionsScreen> createState() => _InstitutionsScreenState();
}

class _InstitutionsScreenState extends State<InstitutionsScreen> {
  List<InstitutionRecord> _institutions = [];
  Map<String, Map<String, int>> _peopleCounts = {};
  bool _loading = true;
  bool _countsLoading = false;
  String? _error;
  String _query = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final list = await SuperAdminService.getInstitutions()
          .timeout(const Duration(seconds: 20));
      if (!mounted) return;
      setState(() {
        _institutions = list;
        _peopleCounts = {};
      });
      _loadCounts(list.map((i) => i.institutionId).toList());
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Real per-institution counts (fail-isolated; absent = unavailable).
  Future<void> _loadCounts(List<String> ids) async {
    if (ids.isEmpty || !mounted) return;
    setState(() => _countsLoading = true);
    try {
      final counts =
          await SuperAdminService.getPeopleCountsByInstitution(institutionIds: ids);
      if (!mounted) return;
      setState(() => _peopleCounts = counts);
    } catch (_) {
      // Whole-batch failure: leave map empty → "غير متاح" per card.
    } finally {
      if (mounted) setState(() => _countsLoading = false);
    }
  }

  List<InstitutionRecord> get _filtered {
    final q = _query.trim();
    if (q.isEmpty) return _institutions;
    return _institutions.where((i) {
      return i.name.contains(q) ||
          i.institutionId.contains(q) ||
          i.ownerEmail.contains(q);
    }).toList();
  }

  void _openOnboardingWizard() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const OnboardingWizardScreen()),
    );
    if (result == true) {
      _loadData();
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  /// Direct suspend/archive/reactivate management (no delete required).
  ///
  /// Shows live dependent counts + the exact impact of each target state,
  /// requires a written reason for SUSPENDED/ARCHIVED (service-enforced),
  /// and refreshes from the source. No student/teacher/attendance/finance
  /// data is ever touched — only the status flag changes.
  Future<void> _openStatusFlow(InstitutionRecord inst) async {
    Map<String, int>? dependents;
    try {
      dependents = await SuperAdminService.getInstitutionDependents(
          institutionId: inst.institutionId);
    } catch (_) {
      dependents = null;
    }
    if (!mounted) return;
    final depLine = dependents == null
        ? 'تعذّر قراءة الارتباطات — سيُطبق الإجراء على الحالة فقط.'
        : InstitutionDeletePolicy.dependentKeys
            .map((k) {
              final v = dependents![k] ?? -1;
              final name = InstitutionDeletePolicy.arabicNames[k] ?? k;
              return '$name: ${v < 0 ? '؟' : '$v'}';
            })
            .join('، ');
    String target = inst.status == 'SUSPENDED' || inst.status == 'ARCHIVED'
        ? 'ACTIVE'
        : 'SUSPENDED';
    final reasonCtrl = TextEditingController();
    final action = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: Text('إدارة حالة «${inst.name}»',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('الحالة الحالية: ${inst.status}',
                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                const SizedBox(height: 6),
                Text('الارتباطات: $depLine',
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                const SizedBox(height: 8),
                const Text('الحالة المستهدفة:',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                DropdownButton<String>(
                  value: target,
                  dropdownColor: const Color(0xFF1E293B),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  items: const [
                    DropdownMenuItem(value: 'ACTIVE', child: Text('نشطة ACTIVE')),
                    DropdownMenuItem(value: 'SUSPENDED', child: Text('موقوفة SUSPENDED')),
                    DropdownMenuItem(value: 'ARCHIVED', child: Text('مؤرشفة ARCHIVED')),
                  ],
                  onChanged: (v) => setDlg(() => target = v ?? target),
                ),
                const SizedBox(height: 4),
                Text(
                  target == 'ACTIVE'
                      ? 'الأثر: تعود المؤسسة للعمل الطبيعي (الدخول والمزامنة) — البيانات لم تُمس.'
                      : target == 'SUSPENDED'
                          ? 'الأثر: يتوقف دخول السنتر ومزامنته مؤقتًا، وتبقى كل البيانات (الطلاب/المعلمون/الحضور/المالية) محفوظة لاستئناف لاحق.'
                          : 'الأثر: تُخفى المؤسسة من القوائم التشغيلية، وتبقى كل البيانات محفوظة — الأرشفة ليست حذفًا.',
                  style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 12),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: reasonCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(
                    labelText: 'السبب * (إلزامي للإيقاف/الأرشفة — يُحفظ في سجل التدقيق)',
                    labelStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(null),
              child: const Text('تراجع', style: TextStyle(color: Color(0xFF94A3B8))),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop('$target|||${reasonCtrl.text.trim()}'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
              child: const Text('تطبيق الحالة', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
    reasonCtrl.dispose();
    if (action == null || !mounted) return;
    final sep = action.indexOf('|||');
    final to = action.substring(0, sep);
    final reason = action.substring(sep + 3);
    try {
      final res = await SuperAdminService.setInstitutionStatus(
        institutionId: inst.institutionId,
        status: to,
        reason: reason,
      );
      final warn = res['auditWarning']?.toString();
      _snack("تم تحديث الحالة إلى ${res['newStatus']}.${warn != null ? ' تنبيه: $warn' : ''}");
      _loadData();
    } catch (e) {
      _snack(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Safe institution removal flow (no trial deletes, no silent partials).
  ///
  /// 1. Reads live dependent counts (students/teachers/users/licenses/
  ///    devices/invitations/AI) — all inside the SuperAdmin scope.
  /// 2. Zero dependents → explicit confirm naming the institution → verified
  ///    single-document delete (subcollections cannot exist at that point).
  /// 3. Blockers → reason + suspend/archive alternative (data preserved).
  /// 4. Any failure throws visibly; success refreshes from the source.
  Future<void> _openDeleteFlow(InstitutionRecord inst) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AlertDialog(
        backgroundColor: Color(0xFF1E293B),
        content: Row(
          children: [
            CircularProgressIndicator(color: Color(0xFF38BDF8)),
            SizedBox(width: 16),
            Expanded(
              child: Text('جاري فحص ارتباطات المؤسسة…',
                  style: TextStyle(color: Colors.white, fontSize: 13)),
            ),
          ],
        ),
      ),
    );
    Map<String, int>? dependents;
    String? checkError;
    try {
      dependents = await SuperAdminService.getInstitutionDependents(
          institutionId: inst.institutionId);
    } catch (e) {
      checkError = e.toString().replaceAll('Exception: ', '');
    }
    if (!mounted) return;
    Navigator.of(context).pop(); // close the progress dialog
    if (dependents == null) {
      _snack('تعذّر فحص الارتباطات: $checkError — لم يُحذف شيء.');
      return;
    }
    final decision = InstitutionDeletePolicy.decide(dependents);
    final rows = InstitutionDeletePolicy.dependentKeys
        .map((k) {
          final v = dependents![k] ?? -1;
          final name = InstitutionDeletePolicy.arabicNames[k] ?? k;
          final value = v < 0 ? 'تعذّر الفحص' : '$v';
          return '$name: $value';
        })
        .join('\n');
    final action = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text(
          decision.allowed ? 'حذف نهائي للمؤسسة؟' : 'الحذف النهائي محظور — بدائل آمنة',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('المؤسسة: ${inst.name}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              SelectableText('المعرف: ${inst.institutionId}',
                  style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
              const SizedBox(height: 8),
              Text(rows, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
              const SizedBox(height: 8),
              Text(
                decision.reason,
                style: TextStyle(
                  color: decision.allowed ? const Color(0xFFFBBF24) : const Color(0xFFF87171),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('تراجع', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          if (!decision.allowed) ...[
            OutlinedButton(
              onPressed: () => Navigator.of(ctx).pop('SUSPEND'),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFBBF24))),
              child: const Text('تعطيل (SUSPEND)', style: TextStyle(color: Color(0xFFFBBF24))),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop('ARCHIVE'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF475569)),
              child: const Text('أرشفة (ARCHIVE)', style: TextStyle(color: Colors.white)),
            ),
          ] else
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop('DELETE'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
              child: Text('حذف نهائي لـ «${inst.name}»',
                  style: const TextStyle(color: Colors.white)),
            ),
        ],
      ),
    );
    if (action == null || !mounted) return;
    try {
      if (action == 'DELETE') {
        final res = await SuperAdminService.deleteInstitution(
          institutionId: inst.institutionId,
          expectedName: inst.name,
        );
        _snack("تم حذف المؤسسة ${res['institutionName']} نهائيًا — حُدّثت القائمة من المصدر.");
      } else {
        final res = await SuperAdminService.setInstitutionStatus(
          institutionId: inst.institutionId,
          status: action == 'SUSPEND' ? 'SUSPENDED' : 'ARCHIVED',
        );
        _snack("تم ${action == 'SUSPEND' ? 'تعطيل' : 'أرشفة'} المؤسسة (الحالة: ${res['newStatus']}) — البيانات محفوظة.");
      }
      _loadData();
    } catch (e) {
      _snack(e.toString().replaceAll('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('🏛️ إدارة المؤسسات',
                      style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _openOnboardingWizard,
                  icon: const Icon(Icons.add_business, size: 18),
                  label: const Text('مركز جديد'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'بحث بالاسم أو المعرف أو بريد المالك…',
                hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF64748B)),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear_rounded, color: Color(0xFF64748B), size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                      ),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
            const SizedBox(height: 12),

            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                  : _error != null
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('تعذر تحميل المؤسسات: $_error',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
                              const SizedBox(height: 12),
                              ElevatedButton(onPressed: _loadData, child: const Text('إعادة المحاولة')),
                            ],
                          ),
                        )
                      : _institutions.isEmpty
                          ? const Center(child: Text('لا توجد مؤسسات مسجلة حالياً', style: TextStyle(color: Color(0xFF94A3B8))))
                          : _filtered.isEmpty
                              ? const Center(child: Text('لا توجد نتائج مطابقة للبحث', style: TextStyle(color: Color(0xFF94A3B8))))
                              : RefreshIndicator(
                                  onRefresh: _loadData,
                                  child: ListView.builder(
                                    itemCount: _filtered.length,
                                    itemBuilder: (context, index) {
                                      final inst = _filtered[index];
                                      final counts = _peopleCounts[inst.institutionId];
                                      final countsLabel = counts == null
                                          ? (_countsLoading ? 'جاري عدّ الطلاب/المعلمين…' : 'الطلاب/المعلمون: غير متاح')
                                          : '${counts['students']} طالب / ${counts['teachers']} معلم (REAL)';
                                      return Card(
                                        color: const Color(0xFF1E293B),
                                        margin: const EdgeInsets.only(bottom: 12),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        child: Padding(
                                          padding: const EdgeInsets.all(16),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(inst.name,
                                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                                        maxLines: 2,
                                                        overflow: TextOverflow.ellipsis),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                    decoration: BoxDecoration(
                                                      color: inst.status == 'ACTIVE' ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(inst.status, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 8),
                                              SelectableText('معرف المؤسسة: ${inst.institutionId}', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                                              Text('نوع المؤسسة: ${inst.type}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                              Text('الهاتف: ${inst.phone.isEmpty ? 'غير محدد' : inst.phone}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                              Text('المالك: ${inst.ownerEmail.isEmpty ? "بانتظار التفعيل (PENDING_OWNER)" : inst.ownerEmail}',
                                                  style: TextStyle(color: inst.ownerEmail.isEmpty ? const Color(0xFFFBBF24) : const Color(0xFF94A3B8), fontSize: 12),
                                                  maxLines: 2,
                                                  overflow: TextOverflow.ellipsis),
                                              const SizedBox(height: 8),
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Chip(
                                                      label: Text(countsLabel,
                                                          maxLines: 2,
                                                          overflow: TextOverflow.ellipsis),
                                                      backgroundColor: const Color(0xFF334155),
                                                      labelStyle: const TextStyle(color: Colors.white, fontSize: 11),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  OutlinedButton.icon(
                                                    onPressed: () => _openStatusFlow(inst),
                                                    icon: const Icon(Icons.tune_rounded,
                                                        size: 14, color: Color(0xFF38BDF8)),
                                                    style: OutlinedButton.styleFrom(
                                                      side: const BorderSide(color: Color(0xFF0284C7)),
                                                      padding: const EdgeInsets.symmetric(
                                                          horizontal: 8, vertical: 4),
                                                      minimumSize: const Size(0, 32),
                                                    ),
                                                    label: const Text('الحالة',
                                                        style: TextStyle(
                                                            color: Color(0xFF38BDF8), fontSize: 11)),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  OutlinedButton.icon(
                                                    onPressed: () => _openDeleteFlow(inst),
                                                    icon: const Icon(Icons.delete_forever_rounded,
                                                        size: 14, color: Color(0xFFF87171)),
                                                    style: OutlinedButton.styleFrom(
                                                      side: const BorderSide(color: Color(0xFFDC2626)),
                                                      padding: const EdgeInsets.symmetric(
                                                          horizontal: 8, vertical: 4),
                                                      minimumSize: const Size(0, 32),
                                                    ),
                                                    label: const Text('حذف',
                                                        style: TextStyle(
                                                            color: Color(0xFFF87171), fontSize: 11)),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
            ),
          ],
        ),
      ),
    );
  }
}
