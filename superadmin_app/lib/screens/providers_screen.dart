import 'package:flutter/material.dart';
import 'package:superadmin_app/screens/ai_control_screen.dart';

/// Legacy redirect to the unified AI Control & Master Pool screen.
class ProvidersScreen extends StatelessWidget {
  const ProvidersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AIControlScreen();
  }
}
