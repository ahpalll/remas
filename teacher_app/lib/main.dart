import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'services/teacher_services.dart';
import 'services/branding_service.dart';
import 'models/app_branding.dart';
import 'screens/teacher_screens.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint('Firebase initialization warning: $e');
  }
  runApp(const TeacherApp());
}

class TeacherApp extends StatefulWidget {
  const TeacherApp({super.key});

  @override
  State<TeacherApp> createState() => _TeacherAppState();
}

class _TeacherAppState extends State<TeacherApp> {
  final TeacherAuthService authService = TeacherAuthService();
  final TeacherBrandingService brandingService = TeacherBrandingService();
  late final TeacherDataService dataService;

  AppBranding _currentBranding = AppBranding.platformDefault();

  @override
  void initState() {
    super.initState();
    dataService = TeacherDataService(authService: authService);
  }

  void _onLoginSuccess(AppBranding branding) {
    setState(() {
      _currentBranding = branding;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${_currentBranding.centerName} — تطبيق المعلم',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: _currentBranding.primaryColor,
        fontFamily: 'Roboto',
      ),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ar', 'EG'),
        Locale('en', 'US'),
      ],
      locale: const Locale('ar', 'EG'),
      home: TeacherLoginScreen(
        authService: authService,
        dataService: dataService,
        brandingService: brandingService,
        onLoginSuccess: _onLoginSuccess,
      ),
    );
  }
}
