import 'package:flutter/material.dart';

class AppBranding {
  final String institutionId;
  final String centerName;
  final Color primaryColor;
  final Color secondaryColor;
  final Color accentColor;
  final Color backgroundColor;
  final String? logoUrl;
  final String? watermarkUrl;
  final String loginTitle;
  final String loginSubtitle;
  final String welcomeMessage;
  final bool isPlatformDefault;

  const AppBranding({
    required this.institutionId,
    required this.centerName,
    required this.primaryColor,
    required this.secondaryColor,
    required this.accentColor,
    required this.backgroundColor,
    this.logoUrl,
    this.watermarkUrl,
    required this.loginTitle,
    required this.loginSubtitle,
    required this.welcomeMessage,
    this.isPlatformDefault = false,
  });

  factory AppBranding.platformDefault() {
    return const AppBranding(
      institutionId: 'platform',
      centerName: 'رِماس للتقنية التعليمية',
      primaryColor: Color(0xFF0F172A),
      secondaryColor: Color(0xFF0284C7),
      accentColor: Color(0xFFD97706),
      backgroundColor: Color(0xFFFFFFFF),
      logoUrl: null,
      watermarkUrl: null,
      loginTitle: 'مرحباً بكم في منصة رِماس EDU',
      loginSubtitle: 'تطبيق الطالب - المنظومة التعليمية الذكية',
      welcomeMessage: 'إدارة أذكى.. تعليم أفضل',
      isPlatformDefault: true,
    );
  }

  factory AppBranding.fromJson(Map<String, dynamic> json, {String instId = 'platform'}) {
    final brandingMap = (json['branding'] is Map) 
        ? Map<String, dynamic>.from(json['branding']) 
        : json;

    Color parseColor(dynamic hex, Color fallback) {
      if (hex is! String) return fallback;
      final str = hex.replaceAll('#', '').trim();
      if (str.length == 6) {
        final val = int.tryParse('FF$str', radix: 16);
        if (val != null) return Color(val);
      }
      return fallback;
    }

    return AppBranding(
      institutionId: instId,
      centerName: (brandingMap['centerName'] as String?)?.trim() ?? json['name'] as String? ?? 'رِماس للتقنية التعليمية',
      primaryColor: parseColor(brandingMap['primaryColor'], const Color(0xFF0F172A)),
      secondaryColor: parseColor(brandingMap['secondaryColor'], const Color(0xFF0284C7)),
      accentColor: parseColor(brandingMap['accentColor'], const Color(0xFFD97706)),
      backgroundColor: parseColor(brandingMap['backgroundColor'], const Color(0xFFFFFFFF)),
      logoUrl: brandingMap['logoUrl'] as String?,
      watermarkUrl: brandingMap['watermarkUrl'] as String?,
      loginTitle: (brandingMap['loginTitle'] as String?)?.trim() ?? 'مرحباً بكم',
      loginSubtitle: (brandingMap['loginSubtitle'] as String?)?.trim() ?? 'تطبيق الطالب',
      welcomeMessage: (brandingMap['welcomeMessage'] as String?)?.trim() ?? 'إدارة أذكى.. تعليم أفضل',
      isPlatformDefault: false,
    );
  }
}
