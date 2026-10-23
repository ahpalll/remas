import 'package:flutter/material.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

/// REAL usage screen: aggregates the authoritative per-institution aiUsage
/// docs. Platform telemetry without a data source is shown as unavailable —
/// never invented.
class UsageScreen extends StatefulWidget {
  const UsageScreen({super.key});

  @override
  State<UsageScreen> createState() => _UsageScreenState();
}

class _UsageScreenState extends State<UsageScreen> {
  bool _loading = true;
  String? _error;
  int _institutionsChecked = 0;
  int _totalUsed = 0;
  int _totalLimit = 0;
  int _exhausted = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final insts = await SuperAdminService.getInstitutions();
      int used = 0, limit = 0, exhausted = 0;
      for (final inst in insts) {
        try {
          final usage = await SuperAdminService.getAiUsage(institutionId: inst.institutionId);
          for (final u in usage) {
            used += u.used;
            limit += u.limit;
            if (u.isExhausted) exhausted++;
          }
        } catch (_) {}
      }
      if (mounted) {
        setState(() {
          _institutionsChecked = insts.length;
          _totalUsed = used;
          _totalLimit = limit;
          _exhausted = exhausted;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
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
            const Text('📈 استهلاك الذكاء الاصطناعي (REAL — من Firestore)',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (_loading)
              const Expanded(child: Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8))))
            else if (_error != null)
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('تعذر التحميل: $_error',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFFF87171))),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _load, child: const Text('إعادة المحاولة')),
                    ],
                  ),
                ),
              )
            else
              Expanded(
                child: ListView(
                  children: [
                    _tile('طلبات توليد الأسئلة المستخدمة (REAL)',
                        '$_totalUsed / $_totalLimit', 'عبر $_institutionsChecked مؤسسة | مستنفد: $_exhausted'),
                    _tile('قراءات Firestore / يوم', 'غير متاح — لم يتم ربط مصدر البيانات بعد', 'STATIC_UI — لا تُعرض أرقام مخترعة'),
                    _tile('كتابات Firestore / يوم', 'غير متاح — لم يتم ربط مصدر البيانات بعد', 'STATIC_UI — لا تُعرض أرقام مخترعة'),
                    _tile('وسائط Cloudflare R2', 'غير متاح — لم يتم ربط مصدر البيانات بعد', 'STATIC_UI — لا تُعرض أرقام مخترعة'),
                    _tile('طلبات Cloudflare Worker / يوم', 'غير متاح — لم يتم ربط مصدر البيانات بعد', 'STATIC_UI — لا تُعرض أرقام مخترعة'),
                    _tile('إشعارات FCM / يوم', 'غير متاح — لم يتم ربط مصدر البيانات بعد', 'STATIC_UI — لا تُعرض أرقام مخترعة'),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _tile(String name, String value, String status) {
    return Card(
      color: const Color(0xFF1E293B),
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        subtitle: Text(value,
            style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 15, fontWeight: FontWeight.bold)),
        trailing: Text(status, style: const TextStyle(color: Colors.white, fontSize: 11)),
      ),
    );
  }
}
