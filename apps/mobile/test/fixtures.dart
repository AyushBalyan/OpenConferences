import 'package:conference_ops/core/api_client.dart';
import 'package:conference_ops/core/secure_store.dart';
import 'package:conference_ops/models/analytics.dart';
import 'package:conference_ops/models/registration.dart';

Map<String, dynamic> overviewJson({bool withRevenue = true}) => {
  'conferenceId': '3f2a9c1e-5b7d-4e8f-9a1b-2c3d4e5f6a7b',
  'submissions': {
    'total': 214,
    'excluded': {'draft': 3, 'withdrawn': 2},
    'byStatus': [
      {'status': 'UNDER_REVIEW', 'count': 120},
      {'status': 'DECISION_MADE', 'count': 94},
    ],
    'byDay': [
      {'date': '2026-09-01', 'count': 4},
      {'date': '2026-09-02', 'count': 9},
      {'date': '2026-09-03', 'count': 31},
    ],
  },
  'reviews': {
    'assigned': 400,
    'completed': 363,
    'notStarted': 25,
    'draft': 12,
    'submitted': 363,
    'overdue': 9,
    'underCoveredPapers': 4,
    'reviewerLoad': <dynamic>[],
  },
  'decisions': {
    'total': 94,
    'acceptRate': 0.41,
    'byOutcome': [
      {'outcome': 'ACCEPT', 'count': 39},
      {'outcome': 'REJECT', 'count': 55},
    ],
  },
  'registrations': {
    'total': 121,
    'paid': 86,
    'unpaid': 24,
    'atRisk': 11,
    'overdue': 5,
    'byStatus': [
      {'status': 'PAID', 'count': 86},
      {'status': 'PENDING', 'count': 24},
    ],
  },
  if (withRevenue) ...{
    'revenueMinor': 64000000,
    'revenueByTiming': [
      {'name': 'EARLY', 'amountMinor': 46000000},
      {'name': 'REGULAR', 'amountMinor': 18000000},
    ],
    'revenueByAudience': [
      {'name': 'REGULAR', 'amountMinor': 52000000},
      {'name': 'STUDENT', 'amountMinor': 12000000},
    ],
  },
  'excludedCurrencyPayments': 0,
  'unpaidAccepted': 18,
  'authors': <dynamic>[],
  'institutions': [
    {'name': 'IIT Delhi', 'count': 12},
    {'name': 'TU Wien', 'count': 7},
  ],
  'currency': 'INR',
  'computedAt': '2026-11-23T09:30:00.000Z',
};

Map<String, dynamic> _registration(
  String id,
  String number,
  String title,
  String status, {
  String? name,
  String timing = 'REGULAR',
  String audience = 'REGULAR',
  String deadline = '2030-01-01T00:00:00.000Z',
}) => {
  'id': id,
  'paperId': id,
  'submissionNumber': number,
  'paperTitle': title,
  'status': status,
  'audience': audience,
  'lockedTiming': timing,
  'amountDueMinor': 800000,
  'currency': 'INR',
  'billingName': name ?? '',
  'billingEmail': name == null ? null : 'payer@example.test',
  'billingAddress': null,
  'billingTaxId': null,
  'deadlineAt': deadline,
  'registeredAt': status == 'PAID' ? '2026-10-02T10:00:00.000Z' : null,
};

Map<String, dynamic> registrationsJson() => {
  'data': [
    _registration(
      'a1',
      'ADD-142',
      'Sparse solvers for hazard maps',
      'PAID',
      name: 'R. Iyer',
      timing: 'EARLY',
    ),
    _registration(
      'a2',
      'ADD-097',
      'Topology priors in design',
      'AWAITING_VERIFICATION',
      audience: 'STUDENT',
    ),
    _registration(
      'a3',
      'ADD-061',
      'Robust shape optimization',
      'PENDING',
      name: 'A. Novak',
      deadline: '2020-01-01T00:00:00.000Z',
    ),
  ],
  'nextCursor': '9d0c1b2a-0000-4000-8000-000000000001',
  'summary': {
    'total': 121,
    'paid': 86,
    'awaitingVerification': 6,
    'unpaid': 24,
    'overdue': 5,
    'atRisk': 11,
  },
  'earlyBirdEndsAt': '2026-10-15T00:00:00.000Z',
};

const testCredentials = Credentials(
  baseUrl: 'https://api.example.test/api/v1',
  conferenceId: '3f2a9c1e-5b7d-4e8f-9a1b-2c3d4e5f6a7b',
  key: 'ocbot_v1.test.secret',
);

class MemoryStore implements CredentialStore {
  MemoryStore([this.value]);
  Credentials? value;

  @override
  Future<Credentials?> read() async => value;
  @override
  Future<void> write(Credentials credentials) async => value = credentials;
  @override
  Future<void> clear() async => value = null;
}

/// Answers from fixtures and records what the screens asked for.
class FakeApi implements ApiClient {
  FakeApi({this.failWith, this.withRevenue = true});
  ApiException? failWith;
  final bool withRevenue;
  final queries = <(RegistrationQuery, String?)>[];

  @override
  Future<Capabilities> capabilities() async {
    if (failWith != null) throw failWith!;
    return const Capabilities(
      conferenceName: 'ADDOPT 2026',
      scopes: ['analytics:read', 'finance:read', 'registrations:read'],
    );
  }

  @override
  Future<AnalyticsOverview> overview() async {
    if (failWith != null) throw failWith!;
    return AnalyticsOverview.fromJson(overviewJson(withRevenue: withRevenue));
  }

  @override
  Future<RegistrationPage> registrations(
    RegistrationQuery query, {
    String? cursor,
  }) async {
    if (failWith != null) throw failWith!;
    queries.add((query, cursor));
    final page = RegistrationPage.fromJson(registrationsJson());
    if (cursor != null) return const RegistrationPage(items: []);
    if (query.status == 'paid') {
      return RegistrationPage(
        items: page.items.where((r) => r.status == 'PAID').toList(),
        summary: page.summary,
      );
    }
    return page;
  }
}
