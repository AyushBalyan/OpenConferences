import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers.dart';
import 'features/setup/setup_screen.dart';
import 'features/shell/home_shell.dart';
import 'theme/esn_theme.dart';

void main() => runApp(const ProviderScope(child: ConferenceOpsApp()));

class ConferenceOpsApp extends ConsumerWidget {
  const ConferenceOpsApp({super.key, this.useGoogleFonts = true});
  final bool useGoogleFonts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final credentials = ref.watch(credentialsProvider);
    return MaterialApp(
      title: 'Conference Ops',
      debugShowCheckedModeBanner: false,
      theme: esnTheme(Brightness.light, useGoogleFonts: useGoogleFonts),
      darkTheme: esnTheme(Brightness.dark, useGoogleFonts: useGoogleFonts),
      home: credentials.when(
        loading: () =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (_, _) => const SetupScreen(),
        data: (value) =>
            value == null ? const SetupScreen() : const HomeShell(),
      ),
    );
  }
}
