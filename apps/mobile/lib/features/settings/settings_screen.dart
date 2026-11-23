import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/settings.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';
import '../shell/tab_header.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    final rates = ref.watch(ratesProvider);
    final insets = MediaQuery.paddingOf(context);

    Widget label(String text) => Padding(
      padding: const EdgeInsets.fromLTRB(16, 22, 16, 8),
      child: Eyebrow(text),
    );
    Widget note(String text) => Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Text(text, style: context.text.bodySmall),
    );
    Widget segment(String text) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Text(text, style: context.text.labelMedium),
    );

    final String ratesNote;
    if (settings.currency == null) {
      ratesNote = 'Amounts are shown exactly as they were recorded.';
    } else if (rates.isLoading) {
      ratesNote = 'Loading exchange rates.';
    } else if (rates.value == null) {
      ratesNote =
          "Couldn't load exchange rates, so amounts are shown as recorded. They load the next time the app opens online.";
    } else {
      ratesNote =
          'Converted amounts are estimates, marked ≈, using European Central Bank reference rates '
          'from frankfurter.dev, loaded ${DateFormat('d MMM').format(rates.value!.fetchedAt)}.';
    }

    return ListView(
      padding: EdgeInsets.fromLTRB(16, insets.top, 16, insets.bottom + 24),
      physics: const BouncingScrollPhysics(),
      children: [
        const TabHeader(title: 'Settings'),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: const Eyebrow('Appearance'),
        ),
        SizedBox(
          width: double.infinity,
          child: CupertinoSlidingSegmentedControl<ThemeMode>(
            groupValue: settings.themeMode,
            backgroundColor: context.esn.fill,
            thumbColor: context.esn.card,
            padding: const EdgeInsets.all(3),
            onValueChanged: (mode) {
              if (mode != null) notifier.setThemeMode(mode);
            },
            children: {
              ThemeMode.system: segment('System'),
              ThemeMode.light: segment('Light'),
              ThemeMode.dark: segment('Dark'),
            },
          ),
        ),
        note('System follows the phone’s light or dark setting.'),
        label('Currency'),
        Panel(
          radius: Esn.tileRadius,
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _CurrencyRow(
                name: 'Conference currency',
                code: 'As recorded',
                selected: settings.currency == null,
                onTap: () => notifier.setCurrency(null),
              ),
              for (final (code, name) in displayCurrencies) ...[
                const Divider(indent: 16),
                _CurrencyRow(
                  name: name,
                  code: code,
                  selected: settings.currency == code,
                  onTap: () => notifier.setCurrency(code),
                ),
              ],
            ],
          ),
        ),
        note(ratesNote),
      ],
    );
  }
}

class _CurrencyRow extends StatelessWidget {
  const _CurrencyRow({
    required this.name,
    required this.code,
    required this.selected,
    required this.onTap,
  });
  final String name;
  final String code;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Expanded(child: Text(name, style: context.text.bodyMedium)),
            Text(
              code,
              style: context.text.bodyMedium?.copyWith(
                color: context.esn.muted,
              ),
            ),
            SizedBox(
              width: 30,
              child: selected
                  ? Align(
                      alignment: Alignment.centerRight,
                      child: Icon(
                        CupertinoIcons.checkmark_alt,
                        size: 20,
                        color: context.scheme.primary,
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
    ),
  );
}
