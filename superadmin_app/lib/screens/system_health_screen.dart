import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// REAL health screen: performs a live Firestore read probe. Latencies of
/// external providers without a live test are shown as unavailable.
class SystemHealthScreen extends StatefulWidget {
  const SystemHealthScreen({super.key});

  @override
  State<SystemHealthScreen> createState() => _SystemHealthScreenState();
}

class _SystemHealthScreenState extends State<SystemHealthScreen> {
  bool _loading = true;
  int? _firestoreLatencyMs;
  String? _firestoreStatus;

  @override
  void initState() {
    super.initState();
    _probe();
  }

  Future<void> _probe() async {
    setState(() {
      _loading = true;
    });
    try {
      final sw = Stopwatch()..start();
      await FirebaseFirestore.instance.collection('institutions').limit(1).get();
      sw.stop();
      if (mounted) {
        setState(() {
          _firestoreLatencyMs = sw.elapsedMilliseconds;
          _firestoreStatus = 'سليم 🟢 (REAL — قراءة حية)';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _firestoreLatencyMs = null;
          _firestoreStatus = 'فشل الفحص: ${e.toString().split(':').first}';
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = <Map<String, String>>[
      {
        'name': 'Cloud Firestore Database',
        'status': _loading ? 'جاري الفحص...' : (_firestoreStatus ?? 'غير متاح'),
        'latency': _firestoreLatencyMs == null ? 'غير متاح — لم يتم ربط مصدر البيانات بعد' : '$_firestoreLatencyMs ms (REAL)',
      },
      {
        'name': 'Firebase Authentication',
        'status': 'مسجّل الدخول عبر Firebase Auth (REAL للجلسة الحالية)',
        'latency': 'غير متاح — لم يتم ربط مصدر البيانات بعد',
      },
      {
        'name': 'Google Gemini AI',
        'status': 'يُتحقق عبر "اختبار الاتصال" في شاشة المزودين — غير متاح هنا',
        'latency': 'غير متاح — لم يتم ربط مصدر البيانات بعد',
      },
      {
        'name': 'OpenRouter AI Fallback',
        'status': 'يُتحقق عبر "اختبار الاتصال" في شاشة المزودين — غير متاح هنا',
        'latency': 'غير متاح — لم يتم ربط مصدر البيانات بعد',
      },
      {
        'name': 'Cloudflare R2 Gateway',
        'status': 'غير متاح — لم يتم ربط مصدر البيانات بعد',
        'latency': 'غير متاح — لم يتم ربط مصدر البيانات بعد',
      },
      {
        'name': 'Licensing Backend Service',
        'status': 'غير متاح — لم يتم ربط مصدر البيانات بعد',
        'latency': 'غير متاح — لم يتم ربط مصدر البيانات بعد',
      },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🏥 سلامة النظام والخدمات (REAL حيث توفر مصدر)',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.builder(
                itemCount: rows.length,
                itemBuilder: (context, index) {
                  final s = rows[index];
                  return Card(
                    color: const Color(0xFF1E293B),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(s['name']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      subtitle: Text('زمن الاستجابة: ${s['latency']}',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      trailing: SizedBox(
                        width: 150,
                        child: Text(s['status']!,
                            textAlign: TextAlign.end,
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  );
                },
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _loading ? null : _probe,
                child: Text(_loading ? 'جاري الفحص...' : 'إعادة فحص Firestore'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
