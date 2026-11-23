import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Credentials {
  const Credentials({
    required this.baseUrl,
    required this.conferenceId,
    required this.key,
  });
  final String baseUrl;
  final String conferenceId;
  final String key;
}

/// Where the connection details live. The key is kept in the Android Keystore-backed store.
abstract class CredentialStore {
  Future<Credentials?> read();
  Future<void> write(Credentials credentials);
  Future<void> clear();
}

class SecureCredentialStore implements CredentialStore {
  const SecureCredentialStore();
  static const _storage = FlutterSecureStorage();
  static const _url = 'api_base_url',
      _conference = 'conference_id',
      _key = 'bot_key';

  @override
  Future<Credentials?> read() async {
    final url = await _storage.read(key: _url);
    final conference = await _storage.read(key: _conference);
    final key = await _storage.read(key: _key);
    if (url == null || conference == null || key == null) return null;
    return Credentials(baseUrl: url, conferenceId: conference, key: key);
  }

  @override
  Future<void> write(Credentials c) async {
    await _storage.write(key: _url, value: c.baseUrl);
    await _storage.write(key: _conference, value: c.conferenceId);
    await _storage.write(key: _key, value: c.key);
  }

  @override
  Future<void> clear() => _storage.deleteAll();
}
