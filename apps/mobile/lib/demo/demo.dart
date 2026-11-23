import '../core/api_client.dart';
import '../core/secure_store.dart';
import '../models/analytics.dart';
import '../models/registration.dart';

/// Built with `--dart-define=DEMO=true`, the app shows sample data and never
/// touches the network or the phone's key storage.
const demoMode = bool.fromEnvironment('DEMO');

class DemoStore implements CredentialStore {
  Credentials? _value = const Credentials(
    baseUrl: 'https://demo.invalid/api/v1',
    conferenceId: '3f2a9c1e-5b7d-4e8f-9a1b-2c3d4e5f6a7b',
    key: 'ocbot_v1.demo.demo',
  );

  @override
  Future<Credentials?> read() async => _value;
  @override
  Future<void> write(Credentials credentials) async => _value = credentials;
  @override
  Future<void> clear() async => _value = null;
}

const _topics = [
  'Sparse solvers for hazard maps',
  'Topology priors in structural design',
  'Robust shape optimization under load uncertainty',
  'Surrogate models for crashworthiness',
  'Adjoint methods for transient flows',
  'Multi-fidelity wing design',
  'Lattice infill for additive manufacturing',
  'Reliability-based design of bridge decks',
  'Level-set methods for compliant mechanisms',
  'Bayesian optimization of battery packs',
  'Isogeometric analysis of thin shells',
  'Data-driven turbulence closures',
  'Gradient-free search for truss layouts',
  'Digital twins for wind turbine blades',
  'Uncertainty quantification in composites',
  'Reduced-order models for aeroelasticity',
];
const _people = [
  ('R. Iyer', 'IIT Delhi', 'IN'),
  ('A. Novak', 'TU Wien', 'AT'),
  ('M. Okafor', 'University of Lagos', 'NG'),
  ('S. Tanaka', 'Kyoto University', 'JP'),
  ('L. Moreau', 'École Polytechnique', 'FR'),
  ('P. Sharma', 'IISc Bangalore', 'IN'),
  ('E. Lindqvist', 'KTH', 'SE'),
  ('D. Castillo', 'UNAM', 'MX'),
  ('H. Kim', 'KAIST', 'KR'),
  ('F. Rossi', 'Politecnico di Milano', 'IT'),
  ('N. Banerjee', 'IIT Bombay', 'IN'),
];

class DemoApi implements ApiClient {
  DemoApi() : _now = DateTime.now() {
    _all = [for (var i = 0; i < 64; i++) _registration(i)];
  }

  final DateTime _now;
  late final List<Registration> _all;
  static const _pause = Duration(milliseconds: 350);
  static const _pageSize = 25;

  Registration _registration(int i) {
    final (name, affiliation, country) = _people[(i * 7) % _people.length];
    final student = i % 4 == 1;
    final early = i % 3 != 2;
    final status = switch (i % 10) {
      6 => 'AWAITING_VERIFICATION',
      7 || 8 || 9 => 'PENDING',
      _ => 'PAID',
    };
    final deadline = switch (i % 10) {
      9 => _now.subtract(Duration(days: 3 + i % 5)),
      7 => _now.add(Duration(days: 2 + i % 4)),
      _ => _now.add(Duration(days: 18 + i % 9)),
    };
    final hasBilling = status != 'PENDING' || i % 20 == 7;
    final round = i ~/ _topics.length;
    return Registration(
      id: 'demo-$i',
      status: status,
      audience: student ? 'STUDENT' : 'REGULAR',
      amountDueMinor:
          (student ? (early ? 4000 : 5000) : (early ? 6500 : 8000)) * 100,
      currency: 'INR',
      paperTitle:
          _topics[i % _topics.length] +
          (round == 0 ? '' : ', part ${round + 1}'),
      submissionNumber: 'ADD-${(311 - i * 4).toString().padLeft(3, '0')}',
      billingName: hasBilling ? name : null,
      billingEmail: hasBilling
          ? '${name.split(' ').last.toLowerCase()}@example.org'
          : null,
      billingCountry: hasBilling ? country : null,
      billingAffiliation: hasBilling ? affiliation : null,
      lockedTiming: status == 'PENDING' ? null : (early ? 'EARLY' : 'REGULAR'),
      deadlineAt: deadline,
      registeredAt: status == 'PAID'
          ? _now.subtract(Duration(days: 1 + i, hours: i * 5 % 24))
          : null,
      isAdditionalPaper: i % 13 == 5,
    );
  }

  bool _atRisk(Registration r) =>
      r.owesMoney &&
      !r.isOverdue(_now) &&
      r.deadlineAt != null &&
      r.deadlineAt!.difference(_now).inDays < 7;

  RegistrationSummary get _summary => RegistrationSummary(
    total: _all.length,
    paid: _all.where((r) => r.status == 'PAID').length,
    awaitingVerification: _all
        .where((r) => r.status == 'AWAITING_VERIFICATION')
        .length,
    unpaid: _all.where((r) => r.owesMoney).length,
    overdue: _all.where((r) => r.isOverdue(_now)).length,
    atRisk: _all.where(_atRisk).length,
  );

  @override
  Future<Capabilities> capabilities() async {
    await Future<void>.delayed(_pause);
    return const Capabilities(
      conferenceName: 'ADDOPT 2026',
      scopes: ['analytics:read', 'finance:read', 'registrations:read'],
    );
  }

  @override
  Future<AnalyticsOverview> overview() async {
    await Future<void>.delayed(_pause);
    final summary = _summary;
    final paid = _all.where((r) => r.status == 'PAID').toList();
    int sum(Iterable<Registration> rs) =>
        rs.fold(0, (total, r) => total + r.amountDueMinor);
    // A slow start, a rush before the deadline, then a trickle.
    final byDay = [
      for (var d = 29; d >= 0; d--)
        Count(
          _now.subtract(Duration(days: d)).toIso8601String().substring(0, 10),
          switch (29 - d) {
            < 12 => 2 + (29 - d) % 3,
            < 20 => 4 + (29 - d - 12) * 2,
            20 => 31,
            21 => 38,
            22 => 22,
            _ => 1 + d % 3,
          },
        ),
    ];
    final revenue = RevenueReport(
      currency: 'INR',
      revenueMinor: sum(paid),
      byTiming: [
        Amount('EARLY', sum(paid.where((r) => r.isEarlyBird))),
        Amount('REGULAR', sum(paid.where((r) => !r.isEarlyBird))),
      ],
      byAudience: [
        Amount('REGULAR', sum(paid.where((r) => r.audience == 'REGULAR'))),
        Amount('STUDENT', sum(paid.where((r) => r.audience == 'STUDENT'))),
      ],
    );
    return AnalyticsOverview(
      submissionsTotal: 214,
      submissionsByStatus: const [
        Count('DECISION_MADE', 156),
        Count('UNDER_REVIEW', 46),
        Count('SUBMITTED', 12),
      ],
      submissionsByDay: byDay,
      reviewsAssigned: 642,
      reviewsSubmitted: 571,
      reviewsDraft: 28,
      reviewsNotStarted: 43,
      reviewsOverdue: 9,
      underCoveredPapers: 4,
      decisionsTotal: 156,
      acceptRate: 0.41,
      decisionsByOutcome: const [
        Count('REJECT', 79),
        Count('ACCEPT', 64),
        Count('MINOR_REVISION', 13),
      ],
      registrationsTotal: summary.total,
      registrationsPaid: summary.paid,
      registrationsUnpaid: summary.unpaid,
      registrationsAtRisk: summary.atRisk,
      registrationsOverdue: summary.overdue,
      registrationsByStatus: [
        Count('PAID', summary.paid),
        Count('PENDING', summary.unpaid),
        Count('AWAITING_VERIFICATION', summary.awaitingVerification),
      ],
      unpaidAccepted: 13,
      institutions: const [
        Count('IIT Delhi', 18),
        Count('TU Wien', 14),
        Count('Kyoto University', 11),
        Count('Politecnico di Milano', 9),
        Count('KAIST', 8),
        Count('KTH', 6),
      ],
      revenue: revenue,
      currencyReports: const [],
      computedAt: DateTime.now(),
    );
  }

  @override
  Future<RegistrationPage> registrations(
    RegistrationQuery query, {
    String? cursor,
  }) async {
    await Future<void>.delayed(_pause);
    final needle = query.search.trim().toLowerCase();
    final matches = _all.where((r) {
      final statusOk = switch (query.status) {
        null => true,
        'paid' => r.status == 'PAID',
        'unpaid' => r.owesMoney,
        'overdue' => r.isOverdue(_now),
        'at-risk' => _atRisk(r),
        final status => r.status == status,
      };
      return statusOk &&
          (needle.isEmpty ||
              [
                r.paperTitle,
                r.submissionNumber,
                r.billingName,
                r.billingEmail,
              ].any((field) => (field ?? '').toLowerCase().contains(needle)));
    }).toList();
    final far = DateTime(9999);
    switch (query.sort) {
      case RegistrationSort.newest:
        break;
      case RegistrationSort.registered:
        matches.sort(
          (a, b) => (b.registeredAt ?? DateTime(0)).compareTo(
            a.registeredAt ?? DateTime(0),
          ),
        );
      case RegistrationSort.amount:
        matches.sort((a, b) => b.amountDueMinor.compareTo(a.amountDueMinor));
      case RegistrationSort.deadline:
        matches.sort(
          (a, b) => (a.deadlineAt ?? far).compareTo(b.deadlineAt ?? far),
        );
    }
    final start = int.tryParse(cursor ?? '') ?? 0;
    final end = (start + _pageSize).clamp(0, matches.length);
    return RegistrationPage(
      items: matches.sublist(start.clamp(0, matches.length), end),
      nextCursor: end < matches.length ? '$end' : null,
      summary: start == 0 ? _summary : null,
      earlyBirdEndsAt: _now.subtract(const Duration(days: 12)),
    );
  }
}
