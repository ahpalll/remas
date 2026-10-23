import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  List<DeviceBindingRecord> _devices = [];
  bool _loading = true;
  String? _error;
  String _filter = 'ALL'; // ALL | PENDING | BOUND | OTHER

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _loadData() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final list = await SuperAdminService.getDeviceBindings()
          .timeout(const Duration(seconds: 20));
      if (!mounted) return;
      setState(() => _devices = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleUnbind(String bindingId) async {
    try {
      await SuperAdminService.unbindDevice(bindingId: bindingId, reason: 'فك الارتباط بطلب السوبر أدمن');
      _snack('تم فك ارتباط الجهاز بنجاح');
      _loadData();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _handleApprove(String bindingId) async {
    try {
      await SuperAdminService.approveDeviceBinding(bindingId: bindingId);
      _snack('تم اعتماد ربط الجهاز (BOUND)');
      _loadData();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _showHotpatchModal() async {
    showDialog(
      context: context,
      builder: (ctx) {
        return FutureBuilder<Map<String, dynamic>?>(
          future: SuperAdminService.getLatestHotpatch(),
          builder: (context, snapshot) {
            final patch = snapshot.data;
            final isLoading = snapshot.connectionState == ConnectionState.waiting;
            final isActive = patch?['active'] == true;
            final patchVer = patch?['patchVersion'] ?? 'لا يوجد تحديث منشور';
            final desc = patch?['description'] ?? 'لا يوجد وصف';
            final pubDate = patch?['publishedAt'] ?? '';

            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(Icons.rocket_launch_rounded, color: Color(0xFF38BDF8), size: 24),
                  SizedBox(width: 8),
                  Text('إدارة التحديثات الفورية (OTA)', style: TextStyle(color: Colors.white, fontSize: 16)),
                ],
              ),
              content: SizedBox(
                width: 480,
                child: isLoading
                    ? const SizedBox(
                        height: 120,
                        child: Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8))),
                      )
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: isActive ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      'النسخة المنشورة: $patchVer',
                                      style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                    const Spacer(),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isActive ? const Color(0x3310B981) : const Color(0x33EF4444),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        isActive ? 'نشط ومفعّل 🟢' : 'معطّل 🔴',
                                        style: TextStyle(
                                          color: isActive ? const Color(0xFF34D399) : const Color(0xFFF87171),
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'الوصف: $desc',
                                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                                ),
                                if (pubDate.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    'تاريخ النشر: ${pubDate.substring(0, 10)}',
                                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () {
                              Navigator.of(ctx).pop();
                              _showPublishHotpatchDialog();
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0284C7),
                              foregroundColor: Colors.white,
                              minimumSize: const Size.fromHeight(44),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: const Icon(Icons.send_rounded, size: 18),
                            label: const Text('🚀 نشر تحديث فوري جديد لجميع الأجهزة أونلاين',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            '💡 كيف يعمل التحديث الفوري للأجهزة؟\n'
                            '• عند نشر التحديث، تستقبله كافة برامج السنتر المفتوحة فوراً عبر الإنترنت.\n'
                            '• حجم التحديث أقل من 1 ميجابايت ولا يحتاج لتحميل ملف التثبيت الكامل.\n'
                            '• يُطبق التحديث في ثوانٍ معدودة وبكل أمان.',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, height: 1.5),
                          ),
                        ],
                      ),
              ),
              actions: [
                if (patch != null)
                  TextButton.icon(
                    onPressed: () async {
                      try {
                        await SuperAdminService.toggleHotpatchActive(!isActive);
                        if (!ctx.mounted) return;
                        Navigator.of(ctx).pop();
                        _snack(isActive ? 'تم تعطيل استلام التحديث الفوري' : 'تم تفعيل التحديث الفوري للأجهزة بنجاح');
                      } catch (e) {
                        _snack(e.toString());
                      }
                    },
                    icon: Icon(isActive ? Icons.pause_circle_rounded : Icons.play_circle_rounded, size: 16),
                    label: Text(isActive ? 'تعطيل التحديث' : 'تفعيل التحديث'),
                  ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF334155)),
                  child: const Text('إغلاق', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showPublishHotpatchDialog() {
    final verCtrl = TextEditingController(text: '1.0.0-hp.52.5.0');
    final descCtrl = TextEditingController(
      text: 'تحديث فوري شامل: حل مشكلة انقطاع النت وتجميد الشاشة، تصحيح رسائل تسجيل الدخول الصريحة، وتفعيل محرك الذكاء الاصطناعي السريع Groq.',
    );
    bool isPublishing = false;

    showDialog(
      context: context,
      builder: (pCtx) {
        return StatefulBuilder(
          builder: (context, setPState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(Icons.rocket_launch_rounded, color: Color(0xFF38BDF8), size: 24),
                  SizedBox(width: 8),
                  Text('إطلاق تحديث فوري للأجهزة', style: TextStyle(color: Colors.white, fontSize: 16)),
                ],
              ),
              content: SizedBox(
                width: 460,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('رقم إصدار التحديث الفوري:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: verCtrl,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text('وصف التحديث والملاحظات للأجهزة:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: descCtrl,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0x2210B981),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF10B981)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle_rounded, color: Color(0xFF34D399), size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'سيصل هذا التحديث لجميع أجهزة المراكز المتصلة بالإنترنت فوراً وبأمان تام.',
                              style: TextStyle(color: Color(0xFF34D399), fontSize: 11),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isPublishing ? null : () => Navigator.of(pCtx).pop(),
                  child: const Text('إلغاء', style: TextStyle(color: Color(0xFF94A3B8))),
                ),
                ElevatedButton(
                  onPressed: isPublishing
                      ? null
                      : () async {
                          final ver = verCtrl.text.trim();
                          final desc = descCtrl.text.trim();
                          if (ver.isEmpty || desc.isEmpty) {
                            _snack('يرجى كتابة رقم الإصدار والوصف');
                            return;
                          }
                          setPState(() => isPublishing = true);
                          try {
                            await SuperAdminService.publishHotpatchToFleet(
                              patchVersion: ver,
                              description: desc,
                            );
                            if (!pCtx.mounted) return;
                            Navigator.of(pCtx).pop();
                            _snack('🚀 تم نشر التحديث الفوري بنجاح! ستستقبله الأجهزة الآن.');
                          } catch (err) {
                            setPState(() => isPublishing = false);
                            _snack('فشل النشر: $err');
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  ),
                  child: isPublishing
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('⚡ نشر الآن لجميع الأجهزة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  List<DeviceBindingRecord> get _filtered {
    switch (_filter) {
      case 'PENDING':
        return _devices.where((d) => d.status == 'PENDING').toList();
      case 'BOUND':
        return _devices.where((d) => d.status == 'BOUND').toList();
      case 'OTHER':
        return _devices.where((d) => d.status != 'PENDING' && d.status != 'BOUND').toList();
      default:
        return _devices;
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
                const Text('💻 إدارة أجهزة المراكز', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _showHotpatchModal,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.rocket_launch_rounded, size: 16),
                  label: const Text('نشر تحديث فوري (OTA)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                for (final f in const ['ALL', 'PENDING', 'BOUND', 'OTHER'])
                  ChoiceChip(
                    label: Text(
                      f == 'ALL' ? 'الكل' : (f == 'PENDING' ? 'معلّق' : (f == 'BOUND' ? 'مرتبط' : 'أخرى')),
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
                  : _error != null && _devices.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('تعذر تحميل الأجهزة: $_error',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
                              const SizedBox(height: 12),
                              ElevatedButton(onPressed: _loadData, child: const Text('إعادة المحاولة')),
                            ],
                          ),
                        )
                      : _devices.isEmpty
                          ? const Center(child: Text('لا توجد أجهزة مرتبطة حالياً في Firestore', style: TextStyle(color: Color(0xFF94A3B8))))
                          : _filtered.isEmpty
                              ? const Center(child: Text('لا توجد أجهزة ضمن هذا التصنيف', style: TextStyle(color: Color(0xFF94A3B8))))
                              : RefreshIndicator(
                                  onRefresh: _loadData,
                                  child: ListView.builder(
                                    itemCount: _filtered.length,
                                    itemBuilder: (context, index) {
                                      final dev = _filtered[index];
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
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(dev.deviceName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: dev.status == 'BOUND'
                                                ? const Color(0xFF166534)
                                                : (dev.status == 'PENDING'
                                                    ? const Color(0xFF854D0E)
                                                    : const Color(0xFF991B1B)),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(dev.status, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    SelectableText('المؤسسة: ${dev.institutionId}', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                                    SelectableText('بصمة الجهاز (Fingerprint): ${dev.deviceFingerprintHash}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                    Text('نظام التشغيل: ${dev.osVersion}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                    Text('تاريخ الربط: ${dev.boundAt}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                    const SizedBox(height: 12),
                                    if (dev.status == 'PENDING')
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: ElevatedButton.icon(
                                          onPressed: () => _handleApprove(dev.bindingId),
                                          icon: const Icon(Icons.check_circle, size: 16),
                                          label: const Text('اعتماد الربط (BOUND)'),
                                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
                                        ),
                                      ),
                                    if (dev.status == 'BOUND')
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: ElevatedButton.icon(
                                          onPressed: () => _handleUnbind(dev.bindingId),
                                          icon: const Icon(Icons.link_off, size: 16),
                                          label: const Text('فك ارتباط الجهاز'),
                                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                                        ),
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
