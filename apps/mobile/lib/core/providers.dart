import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/analytics.dart';
import '../models/registration.dart';
import 'api_client.dart';
import 'secure_store.dart';

final credentialStoreProvider = Provider<CredentialStore>(
  (ref) => const SecureCredentialStore(),
);

class CredentialsNotifier extends AsyncNotifier<Credentials?> {
  @override
  Future<Credentials?> build() => ref.read(credentialStoreProvider).read();

  Future<void> save(Credentials credentials) async {
    await ref.read(credentialStoreProvider).write(credentials);
    state = AsyncData(credentials);
  }

  Future<void> disconnect() async {
    await ref.read(credentialStoreProvider).clear();
    state = const AsyncData(null);
  }
}

final credentialsProvider =
    AsyncNotifierProvider<CredentialsNotifier, Credentials?>(
      CredentialsNotifier.new,
    );

/// Builds a client for a set of credentials; replaced in tests.
final apiFactoryProvider = Provider<ApiClient Function(Credentials)>(
  (ref) =>
      (credentials) => ApiClient(credentials),
);

final apiProvider = Provider<ApiClient>((ref) {
  final credentials = ref.watch(credentialsProvider).value;
  if (credentials == null) throw const ApiException(ApiFailure.unauthorized);
  return ref.watch(apiFactoryProvider)(credentials);
});

final capabilitiesProvider = FutureProvider<Capabilities>(
  (ref) => ref.watch(apiProvider).capabilities(),
);

final overviewProvider = FutureProvider<AnalyticsOverview>(
  (ref) => ref.watch(apiProvider).overview(),
);

class RegistrationListState {
  const RegistrationListState({
    this.query = const RegistrationQuery(),
    this.items = const [],
    this.summary,
    this.earlyBirdEndsAt,
    this.nextCursor,
    this.loading = true,
    this.loadingMore = false,
    this.error,
  });

  final RegistrationQuery query;
  final List<Registration> items;
  final RegistrationSummary? summary;
  final DateTime? earlyBirdEndsAt;
  final String? nextCursor;
  final bool loading;
  final bool loadingMore;
  final ApiException? error;

  RegistrationListState copyWith({
    RegistrationQuery? query,
    List<Registration>? items,
    RegistrationSummary? summary,
    DateTime? earlyBirdEndsAt,
    String? Function()? nextCursor,
    bool? loading,
    bool? loadingMore,
    ApiException? Function()? error,
  }) => RegistrationListState(
    query: query ?? this.query,
    items: items ?? this.items,
    summary: summary ?? this.summary,
    earlyBirdEndsAt: earlyBirdEndsAt ?? this.earlyBirdEndsAt,
    nextCursor: nextCursor != null ? nextCursor() : this.nextCursor,
    loading: loading ?? this.loading,
    loadingMore: loadingMore ?? this.loadingMore,
    error: error != null ? error() : this.error,
  );
}

class RegistrationListNotifier extends Notifier<RegistrationListState> {
  // Guards against a slow, older request overwriting a newer one.
  int _request = 0;

  @override
  RegistrationListState build() {
    ref.watch(apiProvider);
    Future.microtask(refresh);
    return const RegistrationListState();
  }

  Future<void> refresh() => _load(state.query);

  Future<void> setQuery(RegistrationQuery query) => _load(query);

  Future<void> _load(RegistrationQuery query) async {
    final request = ++_request;
    state = state.copyWith(query: query, loading: true, error: () => null);
    try {
      final page = await ref.read(apiProvider).registrations(query);
      if (request != _request) return;
      state = state.copyWith(
        items: page.items,
        summary: page.summary,
        earlyBirdEndsAt: page.earlyBirdEndsAt,
        nextCursor: () => page.nextCursor,
        loading: false,
      );
    } on ApiException catch (e) {
      if (request != _request) return;
      state = state.copyWith(loading: false, error: () => e);
    }
  }

  Future<void> loadMore() async {
    final cursor = state.nextCursor;
    if (cursor == null || state.loading || state.loadingMore) return;
    final request = _request;
    state = state.copyWith(loadingMore: true);
    try {
      final page = await ref
          .read(apiProvider)
          .registrations(state.query, cursor: cursor);
      if (request != _request) return;
      state = state.copyWith(
        items: [...state.items, ...page.items],
        nextCursor: () => page.nextCursor,
        loadingMore: false,
      );
    } on ApiException catch (e) {
      if (request != _request) return;
      state = state.copyWith(loadingMore: false, error: () => e);
    }
  }
}

final registrationListProvider =
    NotifierProvider<RegistrationListNotifier, RegistrationListState>(
      RegistrationListNotifier.new,
    );
