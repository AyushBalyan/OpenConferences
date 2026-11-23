import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';
import '../analytics/analytics_screen.dart';
import '../overview/overview_screen.dart';
import '../registrations/registrations_screen.dart';

Future<void> confirmDisconnect(BuildContext context, WidgetRef ref) async {
  final yes = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Disconnect this phone?'),
      content: const Text(
        'The key is removed from this phone. It keeps working elsewhere until you revoke it in the dashboard.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Disconnect'),
        ),
      ],
    ),
  );
  if (yes == true) await ref.read(credentialsProvider.notifier).disconnect();
}

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell>
    with WidgetsBindingObserver {
  int _tab = 0;
  static const _titles = ['Overview', 'Analytics', 'Registrations'];

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
  void _refreshIfStale(int tab) {
    if (tab == 2) {
      ref.read(registrationListProvider.notifier).refreshIfStale();
    } else {
      ref.read(overviewProvider.notifier).refreshIfStale();
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = ref.watch(capabilitiesProvider).value?.conferenceName;
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Eyebrow(
              _tab == 0 ? 'Conference ops' : (name ?? 'Conference ops'),
              color: Esn.eyebrowOnDark,
            ),
            const SizedBox(height: 2),
            Text(
              _tab == 0 ? (name ?? 'Overview') : _titles[_tab],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Disconnect',
            icon: const Icon(Icons.logout),
            onPressed: () => confirmDisconnect(context, ref),
          ),
        ],
      ),
      body: IndexedStack(
        index: _tab,
        children: const [
          OverviewScreen(),
          AnalyticsScreen(),
          RegistrationsScreen(),
        ],
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: context.esn.line)),
        ),
        child: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) {
            setState(() => _tab = i);
            _refreshIfStale(i);
          },
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              label: 'Overview',
            ),
            NavigationDestination(
              icon: Icon(Icons.bar_chart_outlined),
              label: 'Analytics',
            ),
            NavigationDestination(
              icon: Icon(Icons.groups_outlined),
              label: 'Registrations',
            ),
          ],
        ),
      ),
    );
  }
}
