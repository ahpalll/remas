import 'dart:convert';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';

/// Typed error from the canonical trusted access layer.
/// [code] is the Worker's canonical error code (e.g. STUDENT_NOT_LINKED,
/// INSTITUTION_SELECTION_REQUIRED, UNLINKED_CHILD, FORBIDDEN_*).
/// Never a silent fallback: callers render Loading/Empty/Unauthorized states.
class MobileWorkerException implements Exception {
  final String code;
  final String message;
  final int httpStatus;
  const MobileWorkerException(this.code, this.message, this.httpStatus);
  @override
  String toString() => '$code: $message';
}

/// Canonical trusted-access client (P2). Same transport pattern as the
/// existing AI Tutor service (dart:io, no new dependencies).
/// Every read goes through `remas-media-worker` with the caller's Firebase
/// ID token (per-request Bearer auth). The Worker re-verifies JWT ->
/// identity -> membership/scope server-side and returns minimal DTOs.
/// No Firestore direct reads, no fallbacks, no demo data.
class MobileWorkerClient {
  static const String baseUrl =
      'https://remas-media-worker.inthemoon2012.workers.dev';

  Future<String> _idToken() async {
    User? user;
    try {
      user = FirebaseAuth.instance.currentUser;
    } catch (_) {
      user = null;
    }
    if (user == null) {
      throw const MobileWorkerException(
        'UNAUTHENTICATED',
        'يجب تسجيل الدخول أولًا',
        401,
      );
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw const MobileWorkerException(
        'UNAUTHENTICATED',
        'تعذر الحصول على رمز الدخول — أعد تسجيل الدخول.',
        401,
      );
    }
    return token;
  }

  static String? _msg(Map<String, dynamic> data) =>
      data['error']?.toString() ?? data['message']?.toString();

  static String _codeOf(String raw) {
    final head = raw.split(':').first.trim();
    return head.isEmpty ? 'UNKNOWN_ERROR' : head;
  }

  /// GET [path] with optional [query]; returns the decoded `SUCCESS` body.
  /// Throws [MobileWorkerException] carrying the Worker's canonical code.
  Future<Map<String, dynamic>> get(
    String path, [
    Map<String, String> query = const {},
  ]) async {
    final token = await _idToken();
    final client = HttpClient();
    try {
      var uri = Uri.parse('$baseUrl$path');
      if (query.isNotEmpty) {
        uri = uri.replace(queryParameters: query);
      }
      final req = await client.getUrl(uri);
      req.headers.set('Authorization', 'Bearer $token');
      final res = await req.close().timeout(const Duration(seconds: 30));
      final body = await res.transform(utf8.decoder).join();
      Map<String, dynamic> data;
      try {
        data = jsonDecode(body) as Map<String, dynamic>;
      } catch (_) {
        throw MobileWorkerException(
          'PROTOCOL_ERROR',
          'استجابة غير صالحة من خادم البيانات (HTTP ${res.statusCode}).',
          res.statusCode,
        );
      }
      if (res.statusCode != 200 || data['status'] != 'SUCCESS') {
        final raw = _msg(data) ?? 'تعذر تحميل البيانات.';
        throw MobileWorkerException(_codeOf(raw), raw, res.statusCode);
      }
      return data;
    } on MobileWorkerException {
      rethrow;
    } catch (e) {
      throw MobileWorkerException(
        'NETWORK_ERROR',
        'تعذر الوصول لخادم البيانات الموثوق — تحقق من الاتصال. ($e)',
        0,
      );
    } finally {
      client.close();
    }
  }

  /// POST [path] with JSON [body]; returns the decoded `SUCCESS` body.
  /// Throws [MobileWorkerException] carrying the Worker's canonical code.
  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final token = await _idToken();
    final client = HttpClient();
    try {
      final uri = Uri.parse('$baseUrl$path');
      final req = await client.postUrl(uri);
      req.headers.set('Authorization', 'Bearer $token');
      req.headers.set('Content-Type', 'application/json');
      req.write(jsonEncode(body));
      final res = await req.close().timeout(const Duration(seconds: 45));
      final resBody = await res.transform(utf8.decoder).join();
      Map<String, dynamic> data;
      try {
        data = jsonDecode(resBody) as Map<String, dynamic>;
      } catch (_) {
        throw MobileWorkerException(
          'PROTOCOL_ERROR',
          'استجابة غير صالحة من خادم البيانات (HTTP ${res.statusCode}).',
          res.statusCode,
        );
      }
      if (res.statusCode != 200 || data['status'] != 'SUCCESS') {
        final raw = _msg(data) ?? 'فشلت معالجة الطلب.';
        throw MobileWorkerException(_codeOf(raw), raw, res.statusCode);
      }
      return data;
    } on MobileWorkerException {
      rethrow;
    } catch (e) {
      throw MobileWorkerException(
        'NETWORK_ERROR',
        'تعذر الوصول لخادم الذكاء الاصطناعي — تحقق من الاتصال. ($e)',
        0,
      );
    } finally {
      client.close();
    }
  }
}
