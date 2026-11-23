import 'package:dio/dio.dart';

import '../models/analytics.dart';
import '../models/registration.dart';
import 'secure_store.dart';

enum ApiFailure {
  unauthorized,
  forbidden,
  notFound,
  rateLimited,
  offline,
  unavailable,
  unknown,
}

class ApiException implements Exception {
  const ApiException(this.kind);
  final ApiFailure kind;

  /// The key no longer works, so the only way forward is to connect again.
  bool get needsReconnect =>
      kind == ApiFailure.unauthorized || kind == ApiFailure.notFound;

  String get message => switch (kind) {
    ApiFailure.unauthorized =>
      "This key isn't valid any more. It may have expired or been revoked.",
    ApiFailure.forbidden => "This key doesn't have permission for that.",
    ApiFailure.notFound =>
      "That conference wasn't found for this key. Check the conference ID.",
    ApiFailure.rateLimited => 'Too many requests. Wait a minute and try again.',
    ApiFailure.offline =>
      "Couldn't reach the server. Check your connection and the API address.",
    ApiFailure.unavailable =>
      "The server can't answer right now. Try again shortly.",
    ApiFailure.unknown => 'Something went wrong. Try again.',
  };

  @override
  String toString() => message;
}

class RegistrationQuery {
  const RegistrationQuery({
    this.status,
    this.search = '',
    this.sort = RegistrationSort.newest,
  });
  final String? status;
  final String search;
  final RegistrationSort sort;

  RegistrationQuery copyWith({
    String? Function()? status,
    String? search,
    RegistrationSort? sort,
  }) => RegistrationQuery(
    status: status != null ? status() : this.status,
    search: search ?? this.search,
    sort: sort ?? this.sort,
  );
}

enum RegistrationSort {
  newest('Newest first', 'opened', 'desc'),
  registered('Recently paid', 'registered', 'desc'),
  amount('Highest amount', 'amount', 'desc'),
  deadline('Deadline soonest', 'deadline', 'asc');

  const RegistrationSort(this.label, this.field, this.direction);
  final String label, field, direction;
}

/// Accepts "https://host", "https://host/api" or "https://host/api/v1".
String normalizeBaseUrl(String input) {
  var url = input.trim();
  while (url.endsWith('/')) {
    url = url.substring(0, url.length - 1);
  }
  if (!url.contains('://')) url = 'https://$url';
  if (url.endsWith('/api/v1')) return url;
  if (url.endsWith('/api')) return '$url/v1';
  return '$url/api/v1';
}

class ApiClient {
  ApiClient(Credentials credentials, {Dio? dio})
    : _dio = dio ?? Dio(),
      _root = '/integrations/v1/conferences/${credentials.conferenceId}' {
    _dio.options
      ..baseUrl = normalizeBaseUrl(credentials.baseUrl)
      ..connectTimeout = const Duration(seconds: 10)
      ..receiveTimeout = const Duration(seconds: 25)
      ..headers['Authorization'] = 'Bearer ${credentials.key}'
      ..headers['Accept'] = 'application/json';
  }

  final Dio _dio;
  final String _root;

  Future<Map<String, dynamic>> _get(
    String path, [
    Map<String, dynamic>? query,
  ]) async {
    try {
      final response = await _dio.get<dynamic>(
        '$_root$path',
        queryParameters: query,
      );
      final body = response.data;
      if (body is Map) return body.cast<String, dynamic>();
      throw const ApiException(ApiFailure.unknown);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      throw ApiException(switch (status) {
        401 => ApiFailure.unauthorized,
        403 => ApiFailure.forbidden,
        404 => ApiFailure.notFound,
        429 => ApiFailure.rateLimited,
        503 => ApiFailure.unavailable,
        null => ApiFailure.offline,
        _ => ApiFailure.unknown,
      });
    }
  }

  Future<Capabilities> capabilities() async =>
      Capabilities.fromJson(await _get('/capabilities'));

  Future<AnalyticsOverview> overview() async =>
      AnalyticsOverview.fromJson(await _get('/analytics/overview'));

  Future<RegistrationPage> registrations(
    RegistrationQuery query, {
    String? cursor,
  }) async => RegistrationPage.fromJson(
    await _get('/registrations', {
      'limit': 25,
      'sort': query.sort.field,
      'direction': query.sort.direction,
      if (query.status != null) 'status': query.status,
      if (query.search.trim().isNotEmpty) 'search': query.search.trim(),
      'cursor': ?cursor,
    }),
  );
}
