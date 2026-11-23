import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../widgets/common.dart';
import 'providers.dart';

/// Small key-value storage that survives a restart.
abstract class SettingsStore {
  String? read(String key);
  Future<void> write(String key, String? value);
}

/// Used in tests, and as the fallback before real storage is attached.
class MemorySettingsStore implements SettingsStore {
  final values = <String, String>{};

  @override
  String? read(String key) => values[key];
  @override
  Future<void> write(String key, String? value) async =>
      value == null ? values.remove(key) : values[key] = value;
}

class PrefsSettingsStore implements SettingsStore {
  const PrefsSettingsStore(this._prefs);
  final SharedPreferences _prefs;

  @override
  String? read(String key) => _prefs.getString(key);
  @override
  Future<void> write(String key, String? value) =>
      value == null ? _prefs.remove(key) : _prefs.setString(key, value);
}

/// Replaced in `main` with the phone's storage.
final settingsStoreProvider = Provider<SettingsStore>(
  (ref) => MemorySettingsStore(),
);

/// Currencies amounts can be shown in. All are covered by the rate source.
const displayCurrencies = [
  ('USD', 'US dollar'),
  ('EUR', 'Euro'),
  ('GBP', 'British pound'),
  ('INR', 'Indian rupee'),
  ('JPY', 'Japanese yen'),
  ('AUD', 'Australian dollar'),
  ('CAD', 'Canadian dollar'),
  ('SGD', 'Singapore dollar'),
  ('CHF', 'Swiss franc'),
  ('CNY', 'Chinese yuan'),
];

class AppSettings {
  const AppSettings({this.themeMode = ThemeMode.system, this.currency});
  final ThemeMode themeMode;

  /// Null shows every amount in the currency it was recorded in.
  final String? currency;
}

class SettingsNotifier extends Notifier<AppSettings> {
  static const _theme = 'theme_mode', _currency = 'display_currency';

  @override
  AppSettings build() {
    final store = ref.watch(settingsStoreProvider);
    final currency = store.read(_currency);
    return AppSettings(
      themeMode: ThemeMode.values.firstWhere(
        (mode) => mode.name == store.read(_theme),
        orElse: () => ThemeMode.system,
      ),
      currency: displayCurrencies.any((c) => c.$1 == currency)
          ? currency
          : null,
    );
  }

  Future<void> setThemeMode(ThemeMode mode) {
    state = AppSettings(themeMode: mode, currency: state.currency);
    return ref.read(settingsStoreProvider).write(_theme, mode.name);
  }

  Future<void> setCurrency(String? currency) {
    state = AppSettings(themeMode: state.themeMode, currency: currency);
    return ref.read(settingsStoreProvider).write(_currency, currency);
  }
}

final settingsProvider = NotifierProvider<SettingsNotifier, AppSettings>(
  SettingsNotifier.new,
);

/// Exchange rates, as units of each currency per one US dollar.
class Rates {
  const Rates(this.perUsd, this.fetchedAt);
  final Map<String, double> perUsd;
  final DateTime fetchedAt;

  double? convert(num amount, String from, String to) {
    final a = perUsd[from], b = perUsd[to];
    return a == null || b == null || a == 0 ? null : amount / a * b;
  }

  String encode() =>
      jsonEncode({'at': fetchedAt.toIso8601String(), 'rates': perUsd});

  static Rates? decode(String? raw) {
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return Rates({
        for (final entry in (json['rates'] as Map).entries)
          '${entry.key}': (entry.value as num).toDouble(),
      }, DateTime.parse(json['at'] as String));
    } catch (_) {
      return null;
    }
  }
}

/// Daily European Central Bank reference rates. Sends nothing but the request.
Future<Map<String, double>> fetchReferenceRates() async {
  final response = await Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
    ),
  ).get<Map<String, dynamic>>('https://api.frankfurter.dev/v1/latest?base=USD');
  final rates = response.data?['rates'] as Map?;
  if (rates == null) throw const FormatException('No rates in the response');
  return {
    'USD': 1,
    for (final entry in rates.entries)
      '${entry.key}': (entry.value as num).toDouble(),
  };
}

/// Replaced in tests.
final ratesFetcherProvider = Provider<Future<Map<String, double>> Function()>(
  (ref) => fetchReferenceRates,
);

/// Null until a display currency is chosen and rates have loaded. Rates are
/// kept on the phone and refetched once they are half a day old.
class RatesNotifier extends AsyncNotifier<Rates?> {
  static const _key = 'fx_rates';
  static const _maxAge = Duration(hours: 12);

  @override
  Future<Rates?> build() async {
    final store = ref.watch(settingsStoreProvider);
    final wanted = ref.watch(
      settingsProvider.select((settings) => settings.currency != null),
    );
    final saved = Rates.decode(store.read(_key));
    final now = ref.read(clockProvider)();
    if (!wanted ||
        (saved != null && now.difference(saved.fetchedAt) < _maxAge)) {
      return saved;
    }
    try {
      final fresh = Rates(await ref.read(ratesFetcherProvider)(), now);
      await store.write(_key, fresh.encode());
      return fresh;
    } catch (_) {
      // Older rates are better than none; with none, amounts stay as recorded.
      return saved;
    }
  }
}

final ratesProvider = AsyncNotifierProvider<RatesNotifier, Rates?>(
  RatesNotifier.new,
);

/// Formats amounts in the chosen display currency when rates allow it.
class MoneyFormatter {
  const MoneyFormatter(this.display, this.rates);
  final String? display;
  final Rates? rates;

  String format(int minor, String currency, {bool compact = false}) {
    final to = display;
    final converted = to == null || to == currency
        ? null
        : rates?.convert(minor, currency, to);
    if (converted == null) return money(minor, currency, compact: compact);
    // Converted figures are estimates, so they are rounded to whole units.
    final whole = (converted / 100).round() * 100;
    return '≈ ${money(whole, to!, compact: compact)}';
  }
}

final moneyProvider = Provider<MoneyFormatter>(
  (ref) => MoneyFormatter(
    ref.watch(settingsProvider).currency,
    ref.watch(ratesProvider).value,
  ),
);
