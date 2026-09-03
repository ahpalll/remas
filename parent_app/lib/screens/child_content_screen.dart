import 'package:flutter/material.dart';
import '../services/parent_data_service.dart';

class ChildContentScreen extends StatefulWidget {
  final ParentDataService dataService;
  final String childId;
  const ChildContentScreen({super.key, required this.dataService, required this.childId});

  @override
  State<ChildContentScreen> createState() => _ChildContentScreenState();
}

class _ChildContentScreenState extends State<ChildContentScreen> {
  Map<String, dynamic>? _info;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadContentInfo();
  }

  Future<void> _loadContentInfo() async {
    final res = await widget.dataService.fetchChildContentAccess(widget.childId);
    if (mounted) {
      setState(() {
        _info = res;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حالة المحتوى والاشتراكات')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Card(
                elevation: 3,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.video_library, color: Colors.indigo, size: 28),
                          SizedBox(width: 12),
                          Text('إتاحة المحتوى التعليمي', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Text(
                          _info?['contentAvailabilityNotice'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text('الباقات المفعّلة للطالب:', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ListTile(
                        leading: const Icon(Icons.verified, color: Colors.green),
                        title: const Text('الباقة السنوية للرياضيات البحتة'),
                        subtitle: const Text('الحالة: مفعّلة (نشطة)'),
                        trailing: Text('نشط', style: TextStyle(color: Colors.green.shade700, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
