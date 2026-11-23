import 'package:conference_ops/core/api_client.dart';
import 'package:conference_ops/core/providers.dart';
import 'package:conference_ops/features/analytics/analytics_screen.dart';
import 'package:conference_ops/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart';

Future<void> pumpApp(
  WidgetTester tester, {
  required MemoryStore store,
  required FakeApi api,
  DateTime Function()? clock,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.625;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        credentialStoreProvider.overrideWithValue(store),
        apiFactoryProvider.overrideWithValue((_) => api),
        if (clock != null) clockProvider.overrideWithValue(clock),
      ],
      child: const ConferenceOpsApp(useGoogleFonts: false),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('first run shows setup, validates input and connects', (
    tester,
  ) async {
    final store = MemoryStore();
    await pumpApp(tester, store: store, api: FakeApi());
    expect(find.text('Connect'), findsOneWidget);

    await tester.tap(find.text('Connect'));
    await tester.pump();
    expect(find.text('Enter the API address'), findsOneWidget);
    expect(find.text('Keys start with ocbot_v1.'), findsOneWidget);

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'api.example.test',
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      testCredentials.conferenceId,
    );
    await tester.enterText(
      find.byType(TextFormField).at(2),
      testCredentials.key,
    );
    await tester.tap(find.text('Connect'));
    await tester.pumpAndSettle();

    expect(store.value?.baseUrl, 'https://api.example.test/api/v1');
    expect(find.text('ADDOPT 2026'), findsOneWidget);
    expect(find.text('Needs attention'.toUpperCase()), findsOneWidget);
  });

  testWidgets('a rejected key stays on setup with a plain message', (
    tester,
  ) async {
    final store = MemoryStore();
    await pumpApp(
      tester,
      store: store,
      api: FakeApi(failWith: const ApiException(ApiFailure.unauthorized)),
    );
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'api.example.test',
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      testCredentials.conferenceId,
    );
    await tester.enterText(
      find.byType(TextFormField).at(2),
      testCredentials.key,
    );
    await tester.tap(find.text('Connect'));
    await tester.pumpAndSettle();
    expect(find.textContaining("isn't valid any more"), findsOneWidget);
    expect(store.value, isNull);
  });

  testWidgets('overview shows the headline numbers and what needs attention', (
    tester,
  ) async {
    await pumpApp(tester, store: MemoryStore(testCredentials), api: FakeApi());
    expect(find.text('214'), findsOneWidget);
    expect(find.text('37 of 400', findRichText: true), findsOneWidget);
    expect(find.text('86 of 121', findRichText: true), findsOneWidget);
    expect(find.text('Revenue'), findsOneWidget);
    expect(find.text('Accepted papers not yet paid'), findsOneWidget);
    expect(find.text('18'), findsOneWidget);
  });

  testWidgets(
    'without the revenue permission the overview shows accept rate instead',
    (tester) async {
      await pumpApp(
        tester,
        store: MemoryStore(testCredentials),
        api: FakeApi(withRevenue: false),
      );
      expect(find.text('Revenue'), findsNothing);
      expect(find.text('Accept rate'), findsOneWidget);
      expect(find.text('41%'), findsOneWidget);
    },
  );

  testWidgets('analytics tab renders its sections', (tester) async {
    await pumpApp(tester, store: MemoryStore(testCredentials), api: FakeApi());
    await tester.tap(find.text('Analytics').last);
    await tester.pumpAndSettle();
    expect(find.text('SUBMISSIONS BY DAY'), findsOneWidget);
    expect(find.text('REVIEW PROGRESS'), findsOneWidget);
    expect(find.text('Under review'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('TOP INSTITUTIONS'),
      300,
      scrollable: find
          .descendant(
            of: find.byType(AnalyticsScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.text('IIT Delhi'), findsOneWidget);
    expect(find.text('REVENUE'), findsOneWidget);
  });

  testWidgets(
    'registrations: list, filter by chip, search and open the detail sheet',
    (tester) async {
      final api = FakeApi();
      await pumpApp(tester, store: MemoryStore(testCredentials), api: api);
      await tester.tap(find.text('Registrations').last);
      await tester.pumpAndSettle();

      expect(find.text('Sparse solvers for hazard maps'), findsOneWidget);
      expect(
        find.text('Overdue'),
        findsOneWidget,
        reason: 'unpaid and past its deadline',
      );
      expect(find.text('Awaiting check'), findsWidgets);
      expect(find.text('All 121'), findsOneWidget);

      await tester.tap(find.text('Paid 86'));
      await tester.pumpAndSettle();
      expect(api.queries.last.$1.status, 'paid');
      expect(find.text('Robust shape optimization'), findsNothing);
      expect(find.text('Sparse solvers for hazard maps'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'iyer');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(api.queries.last.$1.search, 'iyer');
      expect(
        api.queries.last.$1.status,
        'paid',
        reason: 'search keeps the active filter',
      );

      await tester.tap(find.text('Sparse solvers for hazard maps'));
      await tester.pumpAndSettle();
      expect(find.text('BILLING'), findsOneWidget);
      expect(find.text('payer@example.test'), findsOneWidget);
      expect(find.text('Early'), findsOneWidget);
    },
  );

  Future<void> leaveAndReturn(WidgetTester tester) async {
    for (final state in const [
      AppLifecycleState.inactive,
      AppLifecycleState.hidden,
      AppLifecycleState.paused,
      AppLifecycleState.hidden,
      AppLifecycleState.inactive,
      AppLifecycleState.resumed,
    ]) {
      tester.binding.handleAppLifecycleStateChanged(state);
    }
    await tester.pumpAndSettle();
  }

  testWidgets('returning to the app reloads the open tab only when stale', (
    tester,
  ) async {
    var now = DateTime(2026, 11, 23, 9);
    final api = FakeApi();
    await pumpApp(
      tester,
      store: MemoryStore(testCredentials),
      api: api,
      clock: () => now,
    );
    expect(api.overviewCalls, 1);
    expect(api.queries, hasLength(1));

    now = now.add(const Duration(seconds: 30));
    await leaveAndReturn(tester);
    expect(api.overviewCalls, 1, reason: 'still fresh');

    now = now.add(const Duration(minutes: 2));
    await leaveAndReturn(tester);
    expect(api.overviewCalls, 2);
    expect(api.queries, hasLength(1), reason: 'registrations tab is not open');
    expect(find.text('214'), findsOneWidget);
  });

  testWidgets('switching tabs reloads stale data', (tester) async {
    var now = DateTime(2026, 11, 23, 9);
    final api = FakeApi();
    await pumpApp(
      tester,
      store: MemoryStore(testCredentials),
      api: api,
      clock: () => now,
    );

    await tester.tap(find.text('Registrations').last);
    await tester.pumpAndSettle();
    expect(api.queries, hasLength(1), reason: 'still fresh');

    now = now.add(const Duration(minutes: 2));
    await tester.tap(find.text('Analytics').last);
    await tester.pumpAndSettle();
    expect(api.overviewCalls, 2);

    await tester.tap(find.text('Registrations').last);
    await tester.pumpAndSettle();
    expect(api.queries, hasLength(2));
    expect(find.text('Sparse solvers for hazard maps'), findsOneWidget);
  });

  testWidgets('a revoked key leads back to setup', (tester) async {
    final store = MemoryStore(testCredentials);
    await pumpApp(
      tester,
      store: store,
      api: FakeApi(failWith: const ApiException(ApiFailure.unauthorized)),
    );
    expect(find.textContaining("isn't valid any more"), findsOneWidget);
    await tester.tap(find.text('Connect again'));
    await tester.pumpAndSettle();
    expect(store.value, isNull);
    expect(find.text('Connect'), findsOneWidget);
  });

  testWidgets('offline shows a retry state and recovers', (tester) async {
    final api = FakeApi(failWith: const ApiException(ApiFailure.offline));
    await pumpApp(tester, store: MemoryStore(testCredentials), api: api);
    expect(find.textContaining("Couldn't reach the server"), findsOneWidget);
    api.failWith = null;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('214'), findsOneWidget);
  });
}
