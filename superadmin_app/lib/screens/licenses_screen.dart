import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

class LicensesScreen extends StatefulWidget {
  const LicensesScreen({super.key});

  @override
  State<LicensesScreen> createState() => _LicensesScreenState();
}

class _LicensesScreenState extends State<LicensesScreen> {
  List<LicenseRecord> _licenses = [];
  Map<String, String> _institutionNames = {};
  bool _loading = true;
  String? _error;
  String _filter = 'ALL'; // ALL | ACTIVE | EXPIRED | OTHER

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final results = await Future.wait([
        SuperAdminService.getLicenses().timeout(const Duration(seconds: 20)),
        SuperAdminService.getInstitutions().timeout(const Duration(seconds: 20)),
      ]);
      if (!mounted) return;
      final lics = results[0] as List<LicenseRecord>;
      final insts = results[1] as List<InstitutionRecord>;
      setState(() {
        _licenses = lics;
        _institutionNames = {for (final i in insts) i.institutionId: i.name};
      });
    } catch (e) {
      // Institutions may fail while licenses succeed: keep licenses and
      // mark names unavailable instead of hiding everything.
      try {
        final lics = await SuperAdminService.getLicenses()
            .timeout(const Duration(seconds: 20));
        if (!mounted) return;
        setState(() {
          _licenses = lics;
          _institutionNames = {};
          _error = null;
        });
      } catch (e2) {
        if (!mounted) return;
        setState(
            () => _error = e2.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  bool _isOrphan(LicenseRecord l) =>
      _institutionNames.isNotEmpty && !_institutionNames.containsKey(l.institutionId);

  List<LicenseRecord> get _filtered {
    final now = DateTime.now();
    switch (_filter) {
      case 'ACTIVE':
        return _licenses
            .where((l) => LicenseStatusView.classify(l, now) == LicenseStatusView.active)
            .toList();
      case 'EXPIRED':
        return _licenses
            .where((l) => LicenseStatusView.classify(l, now) == LicenseStatusView.expired)
            .toList();
      case 'ORPHAN':
        return _licenses.where(_isOrphan).toList();
      case 'OTHER':
        return _licenses
            .where((l) => LicenseStatusView.classify(l, now) == LicenseStatusView.other)
            .toList();
      default:
        return _licenses;
    }
  }

  Future<void> _handleActivate(String licId) async {
    try {
      await SuperAdminService.activateLicense(licenseId: licId);
      _snack('تم تفعيل الترخيص بنجاح');
      _loadData();
    } catch (e) {
      _snack(e.toString());
    }
  }

  /// Reason-first suspend/revoke: the reason is mandatory (service-enforced),
  /// shown back from the record, and written to the audit trail with the
  /// operator identity. Impact is stated before confirmation; bound-device
  /// bindings are untouched (revocation does not cascade-delete data).
  Future<void> _askReasonAndApply({
    required String title,
    required String impact,
    required String confirmLabel,
    required Future<Map<String, dynamic>> Function(String reason) apply,
    required String doneMsg,
  }) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text(title,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(impact, style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 12)),
            const SizedBox(height: 10),
            TextField(
              controller: ctrl,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'السبب * (3 أحرف على الأقل — يُحفظ مع الإجراء)',
                labelStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('تراجع', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: Text(confirmLabel, style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (reason == null || reason.isEmpty || !mounted) return;
    try {
      final res = await apply(reason);
      final warn = res['auditWarning']?.toString();
      _snack('$doneMsg${warn != null ? ' تنبيه: $warn' : ''}');
      _loadData();
    } catch (e) {
      _snack(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _handleSuspend(String licId) async {
    await _askReasonAndApply(
      title: 'تعليق الترخيص مؤقتًا؟',
      impact: 'الأثر: يتوقف تفعيل الأجهزة الجديدة والتحقق الدوري، ويبقى الترخيص والربط الحالي قابلين للاستئناف — لا يُحذف شيء.',
      confirmLabel: 'تأكيد التعليق',
      apply: (reason) => SuperAdminService.suspendLicense(licenseId: licId, reason: reason),
      doneMsg: 'تم تعليق الترخيص بنجاح',
    );
  }

  Future<void> _handleRevoke(String licId) async {
    await _askReasonAndApply(
      title: 'إلغاء الترخيص نهائيًا؟',
      impact: 'الأثر: يُلغى الترخيص نهائيًا ولا يقبل تفعيلًا جديدًا. بيانات الطلاب والمعلمين والحضور والمالية لا تُمس.',
      confirmLabel: 'تأكيد الإلغاء',
      apply: (reason) => SuperAdminService.revokeLicense(licenseId: licId, reason: reason),
      doneMsg: 'تم إلغاء الترخيص بنجاح',
    );
  }

  Future<void> _handleExtend(String licId) async {
    try {
      await SuperAdminService.renewLicense(licenseId: licId, extensionDays: 30);
      _snack('تم تمديد الترخيص بـ 30 يوم بنجاح');
      _loadData();
    } catch (e) {
      _snack(e.toString());
    }
  }

  /// Explicit delete with a confirmation sheet naming the exact license.
  /// Bound licenses are refused by the service (unbind first) — the dialog
  /// states that constraint up front. No silent delete, no fake success:
  /// the list refreshes from the source only after a verified delete.
  Future<void> _confirmDelete(LicenseRecord lic) async {
    final instLabel = _institutionNames[lic.institutionId] ?? lic.institutionId;
    final bound = lic.deviceBindingId.trim().isNotEmpty ||
        lic.deviceBindingStatus == 'BOUND';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('حذف الترخيص نهائيًا؟',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              SelectableText('الكود: ${lic.licenseCode}',
                  style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 13)),
              Text('الحالة: ${lic.status}', style: const TextStyle(color: Colors.white, fontSize: 13)),
              Text('المؤسسة: $instLabel',
                  style: const TextStyle(color: Colors.white, fontSize: 13)),
              Text(
                lic.deviceBindingId.trim().isEmpty
                    ? 'الجهاز المرتبط: لا يوجد'
                    : 'الجهاز المرتبط: ${lic.deviceBindingId} (${lic.deviceBindingStatus})',
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
              const SizedBox(height: 8),
              if (bound)
                const Text(
                  '⛔ هذا الترخيص مرتبط بجهاز — الحذف مرفوض حتى تفك الارتباط من شاشة الأجهزة.',
                  style: TextStyle(color: Color(0xFFF87171), fontSize: 12, fontWeight: FontWeight.bold),
                )
              else
                const Text(
                  'سيُحذف هذا الترخيص فقط. لا يمكن التراجع.',
                  style: TextStyle(color: Color(0xFFFBBF24), fontSize: 12),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('تراجع', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: bound ? null : () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('حذف نهائي', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      final res = await SuperAdminService.deleteLicense(
        licenseId: lic.licenseId,
        expectedCode: lic.licenseCode,
      );
      _snack("تم حذف الترخيص ${res['licenseCode']} بنجاح — حُدّثت القائمة من المصدر.");
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
            const Text('🔑 إدارة التراخيص والخطط', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                for (final f in const ['ALL', 'ACTIVE', 'EXPIRED', 'ORPHAN', 'OTHER'])
                  ChoiceChip(
                    label: Text(
                      f == 'ALL'
                          ? 'الكل'
                          : (f == 'ACTIVE'
                              ? 'نشط'
                              : (f == 'EXPIRED'
                                  ? 'منتهٍ'
                                  : (f == 'ORPHAN' ? 'يتيمة' : 'أخرى'))),
                      style: const TextStyle(fontSize: 11),
                    ),
                    selected: _filter == f,
                    onSelected: (_) => setState(() => _filter = f),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                  : _error != null && _licenses.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('تعذر تحميل التراخيص: $_error',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
                              const SizedBox(height: 12),
                              ElevatedButton(onPressed: _loadData, child: const Text('إعادة المحاولة')),
                            ],
                          ),
                        )
                      : _licenses.isEmpty
                          ? const Center(child: Text('لا توجد تراخيص مسجلة حالياً', style: TextStyle(color: Color(0xFF94A3B8))))
                          : _filtered.isEmpty
                              ? const Center(child: Text('لا توجد تراخيص ضمن هذا التصنيف', style: TextStyle(color: Color(0xFF94A3B8))))
                              : RefreshIndicator(
                                  onRefresh: _loadData,
                                  child: ListView.builder(
                                    itemCount: _filtered.length,
                                    itemBuilder: (context, index) {
                                      final lic = _filtered[index];
                                      final view = LicenseStatusView.classify(lic, DateTime.now());
                                      final instName = _institutionNames[lic.institutionId];
                                      final orphan = _isOrphan(lic);
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
                                                    child: SelectableText(lic.licenseCode,
                                                        style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13)),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                    decoration: BoxDecoration(
                                                      color: lic.status == 'ACTIVE'
                                                          ? const Color(0xFF166534)
                                                          : (lic.status == 'SUSPENDED' ? const Color(0xFF854D0E) : const Color(0xFF991B1B)),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(lic.status, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 8),
                                              SelectableText(
                                                instName == null
                                                    ? 'المؤسسة: ${lic.institutionId}'
                                                    : 'المؤسسة: $instName (${lic.institutionId})',
                                                style: const TextStyle(color: Colors.white, fontSize: 12),
                                              ),
                                              if (orphan)
                                                const Text('⚠️ ترخيص يتيم: مرتبط بمؤسسة غير موجودة في النطاق المسموح — راجعه (تعليق/إلغاء/حذف بعد فك الارتباط) ولا يؤثر على مؤسسات أخرى.',
                                                    style: TextStyle(color: Color(0xFFFBBF24), fontSize: 11)),
                                              if (lic.statusReason.isNotEmpty)
                                                SelectableText('سبب الإجراء: ${lic.statusReason}',
                                                    style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11)),
                                              if (view == LicenseStatusView.expired)
                                                const Text('⚠️ منتهٍ (الحالة أو تاريخ الانتهاء) — يحتاج تجديدًا.',
                                                    style: TextStyle(color: Color(0xFFF87171), fontSize: 11, fontWeight: FontWeight.bold)),
                                              Text('الباقة: ${lic.plan}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                              Text('حالة الجهاز: ${lic.deviceBindingStatus}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                              Text('تاريخ الانتهاء: ${lic.expiresAt.isEmpty ? "غير محدد" : lic.expiresAt.split('T').first}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                    const SizedBox(height: 12),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      alignment: WrapAlignment.end,
                                      children: [
                                        if (lic.status != 'ACTIVE')
                                          ElevatedButton(
                                            onPressed: () => _handleActivate(lic.licenseId),
                                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF166534)),
                                            child: const Text('تفعيل', style: TextStyle(color: Colors.white, fontSize: 11)),
                                          ),
                                        if (lic.status == 'ACTIVE')
                                          OutlinedButton(
                                            onPressed: () => _handleSuspend(lic.licenseId),
                                            style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFBBF24))),
                                            child: const Text('تعليق', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 11)),
                                          ),
                                        OutlinedButton(
                                          onPressed: () => _handleExtend(lic.licenseId),
                                          style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF38BDF8))),
                                          child: const Text('تمديد 30 يوم', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11)),
                                        ),
                                        ElevatedButton(
                                          onPressed: () => _handleRevoke(lic.licenseId),
                                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                                          child: const Text('إلغاء الترخيص', style: TextStyle(color: Colors.white, fontSize: 11)),
                                        ),
                                        OutlinedButton.icon(
                                          onPressed: () => _confirmDelete(lic),
                                          icon: const Icon(Icons.delete_forever_rounded, size: 14),
                                          style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFDC2626))),
                                          label: const Text('حذف', style: TextStyle(color: Color(0xFFF87171), fontSize: 11)),
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
