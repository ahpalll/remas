import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:crypto/crypto.dart' as crypto;

/// REMAS Student App Update Service
///
/// Checks Firestore `appReleases` collection for approved updates.
/// For Android: shows dialog, downloads APK, verifies SHA-256 hash,
/// then directs user to Android's official package installer.
///
/// Security: RSA signature is NOT verifiable client-side without a Dart
/// crypto library; we rely on HTTPS + SHA-256 hash verification + Firestore
/// security rules as the trust anchor. The server signs releases; Firestore
/// rules ensure only SuperAdmin can write `appReleases`.
class StudentUpdateService {
  static const String _collection = 'appReleases';
  static const String _channel = 'stable';

  /// Compare semantic versions. Returns 1 if a > b, -1 if a < b, 0 if equal.
  static int compareVersions(String a, String b) {
    final pa = a.replaceFirst('v', '').split('-')[0].split('.').map(int.parse).toList();
    final pb = b.replaceFirst('v', '').split('-')[0].split('.').map(int.parse).toList();
    final len = pa.length > pb.length ? pa.length : pb.length;
    for (var i = 0; i < len; i++) {
      final na = pa[i];
      final nb = pb[i];
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  /// Check for available updates.
  /// Equality-only query (no orderBy → no composite index needed);
  /// client-side semver sort avoids lexicographic version ordering bugs.
  static Future<UpdateInfo?> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;

      final snapshot = await FirebaseFirestore.instance
          .collection(_collection)
          .where('channel', isEqualTo: _channel)
          .where('status', isEqualTo: 'APPROVED')
          .where('published', isEqualTo: true)
          .where('platform', isEqualTo: 'android-arm')
          .limit(25)
          .get();

      if (snapshot.docs.isEmpty) return null;

      final releases = snapshot.docs
          .map((d) => MapEntry(d.id, d.data()))
          .where((e) =>
              (e.value['version'] ?? '').toString().isNotEmpty &&
              compareVersions(e.value['version'].toString(), currentVersion) > 0)
          .toList()
        ..sort((a, b) => compareVersions(
            b.value['version'].toString(), a.value['version'].toString()));

      if (releases.isEmpty) return null;

      final best = releases.first;
      final data = best.value;
      return UpdateInfo(
        version: data['version'].toString(),
        releaseNotes: (data['releaseNotes'] ?? '').toString(),
        downloadUrl: (data['downloadUrl'] ?? '').toString(),
        sha256Hash: (data['sha256Hash'] ?? '').toString(),
        size: (data['size'] ?? 0).toInt(),
        mandatory: data['mandatory'] == true,
        currentVersion: currentVersion,
        releaseId: best.key,
      );
    } catch (e) {
      // Fail-closed: connection failure is NOT evidence of an update
      debugPrint('[StudentUpdateService] checkForUpdate error: $e');
      return null;
    }
  }

  /// Compute SHA-256 hash of file bytes
  static String sha256Hash(File file) {
    final bytes = file.readAsBytesSync();
    final digest = crypto.sha256.convert(bytes);
    return digest.toString();
  }

  /// Verify downloaded APK integrity
  static bool verifyUpdate(File apkFile, String expectedHash) {
    try {
      final actualHash = sha256Hash(apkFile);
      return actualHash.toLowerCase() == expectedHash.toLowerCase();
    } catch (_) {
      return false;
    }
  }

  /// Download APK from trusted URL with progress callback
  static Future<File?> downloadUpdate(
    UpdateInfo info,
    void Function(int downloaded, int total, int percent)? onProgress,
  ) async {
    final client = HttpClient();
    try {
      final dir = Directory.systemTemp;
      final apkPath = '${dir.path}/remas-update-${info.version}.apk';
      final apkFile = File(apkPath);

      // Skip re-download if already verified
      if (apkFile.existsSync() && verifyUpdate(apkFile, info.sha256Hash)) {
        return apkFile;
      }

      final uri = Uri.parse(info.downloadUrl);
      final request = await client.getUrl(uri);
      final response = await request.close();

      if (response.statusCode != 200) {
        client.close();
        return null;
      }

      final totalBytes = response.contentLength;
      final sink = apkFile.openWrite();
      var downloadedBytes = 0;

      await for (final chunk in response) {
        downloadedBytes += chunk.length;
        sink.add(chunk);
        if (onProgress != null && totalBytes > 0) {
          final percent = ((downloadedBytes / totalBytes) * 100).round();
          onProgress(downloadedBytes, totalBytes, percent);
        }
      }
      await sink.close();
      client.close();

      // Verify after download
      if (!verifyUpdate(apkFile, info.sha256Hash)) {
        apkFile.deleteSync();
        return null;
      }

      return apkFile;
    } catch (e) {
      client.close();
      debugPrint('[StudentUpdateService] downloadUpdate error: $e');
      return null;
    }
  }
}

/// Update information from Firestore
class UpdateInfo {
  final String version;
  final String releaseNotes;
  final String downloadUrl;
  final String sha256Hash;
  final int size;
  final bool mandatory;
  final String currentVersion;
  final String releaseId;

  UpdateInfo({
    required this.version,
    required this.releaseNotes,
    required this.downloadUrl,
    required this.sha256Hash,
    required this.size,
    required this.mandatory,
    required this.currentVersion,
    required this.releaseId,
  });
}
