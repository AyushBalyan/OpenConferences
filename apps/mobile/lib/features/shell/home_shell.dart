import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../theme/esn_theme.dart';
import '../analytics/analytics_screen.dart';
import '../overview/overview_screen.dart';
import '../registrations/registrations_screen.dart';
import '../settings/settings_screen.dart';

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell>
    with WidgetsBindingObserver {
  int _tab = 0;
  static const _tabs = [
    ('Overview', CupertinoIcons.house_fill),
    ('Analytics', CupertinoIcons.chart_bar_alt_fill),
    ('Registrations', CupertinoIcons.person_2_fill),
    ('Settings', CupertinoIcons.gear_alt_fill),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshIfStale(_tab);
  }

  /// Overview and Analytics share one payload; Registrations has its own.
  /// Settings shows nothing from the server.
  void _refreshIfStale(int tab) {
    if (tab == 2) {
      ref.read(registrationListProvider.notifier).refreshIfStale();
    } else if (tab < 2) {
      ref.read(overviewProvider.notifier).refreshIfStale();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Content scrolls underneath the floating tab bar.
      extendBody: true,
      body: IndexedStack(
        index: _tab,
        children: const [
          OverviewScreen(),
          AnalyticsScreen(),
          RegistrationsScreen(),
          SettingsScreen(),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(14, 0, 14, 12),
        child: _GlassTabBar(
          selected: _tab,
          onSelected: (i) {
            setState(() => _tab = i);
            _refreshIfStale(i);
          },
        ),
      ),
    );
  }
}

/// A floating, translucent capsule that blurs what scrolls behind it.
class _GlassTabBar extends StatelessWidget {
  const _GlassTabBar({required this.selected, required this.onSelected});
  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    const radius = BorderRadius.all(Radius.circular(34));
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: dark ? 0.5 : 0.12),
            blurRadius: 32,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            height: 66,
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: context.esn.card.withValues(alpha: dark ? 0.72 : 0.8),
              borderRadius: radius,
              border: Border.all(
                color: (dark ? Colors.white : Colors.black).withValues(
                  alpha: 0.07,
                ),
              ),
            ),
            child: Row(
              children: [
                for (final (index, (label, icon))
                    in _HomeShellState._tabs.indexed)
                  Expanded(
                    child: _TabItem(
                      label: label,
                      icon: icon,
                      selected: index == selected,
                      onTap: () => onSelected(index),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? context.scheme.primary : context.esn.muted;
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          decoration: ShapeDecoration(
            color: selected
                ? context.scheme.primary.withValues(alpha: 0.13)
                : Colors.transparent,
            shape: const StadiumBorder(),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: color),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.labelSmall?.copyWith(
                  color: color,
                  fontSize: 11,
                  letterSpacing: 0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
