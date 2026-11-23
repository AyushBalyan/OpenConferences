import 'package:conference_ops/core/api_client.dart';
import 'package:conference_ops/models/analytics.dart';
import 'package:conference_ops/models/registration.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart';

void main() {
  test('parses the analytics overview, with revenue', () {
    final o = AnalyticsOverview.fromJson(overviewJson());
    expect(o.submissionsTotal, 214);
    expect(o.reviewsPending, 37);
    expect(o.registrationsPaid, 86);
    expect(o.acceptRate, closeTo(0.41, 1e-9));
    expect(o.revenue!.revenueMinor, 64000000);
    expect(o.revenue!.byTiming.first.name, 'EARLY');
    expect(o.revenueReports, hasLength(1));
    expect(o.submissionsByDay, hasLength(3));
  });

  test('revenue is absent when the key has no finance permission', () {
    final o = AnalyticsOverview.fromJson(overviewJson(withRevenue: false));
    expect(o.revenue, isNull);
    expect(o.revenueReports, isEmpty);
  });

  test('tolerates missing sections instead of throwing', () {
    final o = AnalyticsOverview.fromJson({'conferenceId': 'x'});
    expect(o.submissionsTotal, 0);
    expect(o.institutions, isEmpty);
  });

  test('parses a registration page and its first-page summary', () {
    final page = RegistrationPage.fromJson(registrationsJson());
    expect(page.items, hasLength(3));
    expect(page.summary!.total, 121);
    expect(page.nextCursor, isNotNull);
    final first = page.items.first;
    expect(first.paperTitle, 'Sparse solvers for hazard maps');
    expect(first.isEarlyBird, isTrue);
    expect(first.billingName, 'R. Iyer');
    final overdue = page.items[2];
    expect(overdue.isOverdue(DateTime.now()), isTrue);
    expect(
      page.items[1].billingName,
      isNull,
      reason: 'blank strings become null',
    );
  });

  test('normalizes the API address', () {
    expect(
      normalizeBaseUrl('api.example.org'),
      'https://api.example.org/api/v1',
    );
    expect(
      normalizeBaseUrl('https://api.example.org/'),
      'https://api.example.org/api/v1',
    );
    expect(
      normalizeBaseUrl('https://api.example.org/api'),
      'https://api.example.org/api/v1',
    );
    expect(
      normalizeBaseUrl('http://10.0.2.2:3001/api/v1/'),
      'http://10.0.2.2:3001/api/v1',
    );
  });
}
