import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'services/parent_auth_service.dart';
import 'services/parent_data_service.dart';
import 'services/branding_service.dart';
import 'models/app_branding.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const ParentApp());
}

class ParentApp extends StatefulWidget {
  const ParentApp({super.key});

  @override
  State<ParentApp> createState() => _ParentAppState();
}

class _ParentAppState extends State<ParentApp> {
  final ParentAuthService _authService = ParentAuthService();
  final ParentDataService _dataService = ParentDataService();
  final ParentBrandingService _brandingService = ParentBrandingService();

  AppBranding _currentBranding = AppBranding.platformDefault();

  @override
  void initState() {
    super.initState();
    _authService.addListener(_onAuthStatusChanged);
  }

  void _onAuthStatusChanged() async {
    if (_authService.status == ParentAuthStatus.authenticated) {
      final branding = await _brandingService.fetchAuthenticatedBranding();
      if (mounted) {
        setState(() {
          _currentBranding = branding;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          _currentBranding = AppBranding.platformDefault();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${_currentBranding.centerName} — تطبيق ولي الأمر',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('ar', 'EG')],
      locale: const Locale('ar', 'EG'),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _currentBranding.primaryColor),
        scaffoldBackgroundColor: _currentBranding.backgroundColor,
        useMaterial3: true,
      ),
      home: _authService.status == ParentAuthStatus.authenticated
          ? HomeScreen(authService: _authService, dataService: _dataService, branding: _currentBranding)
          : LoginScreen(authService: _authService, branding: _currentBranding),
    );
  }
}
