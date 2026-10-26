import 'package:flutter/material.dart';

/// Canonical notifications screen.
///
/// There is currently no canonical broadcast/notification backend, so this
/// screen honestly renders an empty state instead of fake records.
/// (P1 §5/§11: never display demo data; fail closed with a clear state.)
class StudentNotificationsScreen extends StatelessWidget {
  const StudentNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الإشعارات والتنبيهات'),
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Text(
            'لا توجد إشعارات حاليًا — لم يتم تفعيل مركز الإشعارات بعد.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
