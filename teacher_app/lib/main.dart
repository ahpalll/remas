import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'services/teacher_services.dart';
import 'services/branding_service.dart';
import 'models/app_branding.dart';
import 'screens/teacher_screens.dart';

void main() {
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
        branding: _currentBranding,
        onLoginSuccess: _onLoginSuccess,
      ),
    );
  }
}

class TeacherLoginScreen extends StatefulWidget {
  final TeacherAuthService authService;
  final TeacherDataService dataService;
  final TeacherBrandingService brandingService;
  final AppBranding branding;
  final Function(AppBranding) onLoginSuccess;

  const TeacherLoginScreen({
    super.key,
    required this.authService,
    required this.dataService,
    required this.brandingService,
    required this.branding,
    required this.onLoginSuccess,
  });

  @override
  State<TeacherLoginScreen> createState() => _TeacherLoginScreenState();
}

class _TeacherLoginScreenState extends State<TeacherLoginScreen> {
  final _emailController = TextEditingController(text: 'teacher@remas.edu');
  final _passwordController = TextEditingController(text: 'Password123!');
  String? _errorMessage;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final b = widget.branding;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (b.logoUrl != null && b.logoUrl!.isNotEmpty)
                  Image.network(b.logoUrl!, height: 80, errorBuilder: (_, __, ___) => Icon(Icons.school, size: 72, color: b.primaryColor))
                else
                  Icon(Icons.school, size: 72, color: b.primaryColor),
                const SizedBox(height: 16),
                Text(
                  b.centerName,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: b.primaryColor),
                ),
                Text(
                  b.welcomeMessage,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 32),
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade300),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Colors.red),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'البريد الإلكتروني للمعلم',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.email),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'كلمة المرور',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.lock),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    backgroundColor: b.primaryColor,
                    foregroundColor: Colors.white,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('تسجيل الدخول كمعلم', style: TextStyle(fontSize: 16)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await widget.authService.loginWithTeacherCredentials(
      email: _emailController.text,
      password: _passwordController.text,
    );

    if (res['success'] == true) {
      final updatedBranding = await widget.brandingService.fetchAuthenticatedBranding();
      widget.onLoginSuccess(updatedBranding);

      setState(() {
        _isLoading = false;
      });

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => TeacherDashboardScreen(
              authService: widget.authService,
              dataService: widget.dataService,
            ),
          ),
        );
      }
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = res['message'];
      });
    }
  }
}
