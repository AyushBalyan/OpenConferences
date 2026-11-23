import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:shared_preferences/shared_preferences.dart';

import 'core/providers.dart';
import 'core/settings.dart';
import 'demo/demo.dart';
import 'features/setup/setup_screen.dart';
import 'features/shell/home_shell.dart';
import 'theme/esn_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final demo = demoMode ? DemoApi() : null;
  runApp(
    ProviderScope(
      overrides: [
        settingsStoreProvider.overrideWithValue(PrefsSettingsStore(prefs)),
        if (demo != null) ...[
          credentialStoreProvider.overrideWithValue(DemoStore()),
          apiFactoryProvider.overrideWithValue((_) => demo),
        ],
      ],
      child: const ConferenceOpsApp(),
    ),
  );
}

class ConferenceOpsApp extends ConsumerWidget {
  const ConferenceOpsApp({super.key, this.useGoogleFonts = true});
  final bool useGoogleFonts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final credentials = ref.watch(credentialsProvider);
    return MaterialApp(
      title: 'ConfKit',
      debugShowCheckedModeBanner: false,
      theme: esnTheme(Brightness.light, useGoogleFonts: useGoogleFonts),
      darkTheme: esnTheme(Brightness.dark, useGoogleFonts: useGoogleFonts),
      themeMode: ref.watch(settingsProvider.select((s) => s.themeMode)),
      // The app draws edge to edge, so the system bars take the page color.
      builder: (context, child) {
        final dark = Theme.of(context).brightness == Brightness.dark;
        final icons = dark ? Brightness.light : Brightness.dark;
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: icons,
            statusBarBrightness: dark ? Brightness.dark : Brightness.light,
            systemNavigationBarColor: Theme.of(context).scaffoldBackgroundColor,
            systemNavigationBarIconBrightness: icons,
          ),
          child: child!,
        );
      },
      home: credentials.when(
        loading: () => const Scaffold(
          body: Center(child: CupertinoActivityIndicator(radius: 13)),
        ),
        error: (_, _) => const SetupScreen(),
        data: (value) =>
            value == null ? const SetupScreen() : const HomeShell(),
      ),
    );
  }
}
