int _int(dynamic v) => v is num ? v.toInt() : 0;
List<Map<String, dynamic>> _list(dynamic v) => v is List
    ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
    : const [];
Map<String, dynamic> _map(dynamic v) =>
    v is Map ? v.cast<String, dynamic>() : const {};

class Count {
  const Count(this.name, this.count);
  final String name;
  final int count;
}

class Amount {
  const Amount(this.name, this.amountMinor);
  final String name;
  final int amountMinor;
}

List<Count> _counts(dynamic v, String key) =>
    _list(v).map((e) => Count('${e[key] ?? ''}', _int(e['count']))).toList();
List<Amount> _amounts(dynamic v) => _list(
  v,
).map((e) => Amount('${e['name'] ?? ''}', _int(e['amountMinor']))).toList();

class RevenueReport {
  const RevenueReport({
    required this.currency,
    required this.revenueMinor,
    required this.byTiming,
    required this.byAudience,
  });
  final String currency;
  final int revenueMinor;
  final List<Amount> byTiming;
  final List<Amount> byAudience;

  factory RevenueReport.fromJson(Map<String, dynamic> j) => RevenueReport(
    currency: '${j['currency'] ?? ''}',
    revenueMinor: _int(j['revenueMinor']),
    byTiming: _amounts(j['revenueByTiming']),
    byAudience: _amounts(j['revenueByAudience']),
  );
}

class AnalyticsOverview {
  const AnalyticsOverview({
    required this.submissionsTotal,
    required this.submissionsByStatus,
    required this.submissionsByDay,
    required this.reviewsAssigned,
    required this.reviewsSubmitted,
    required this.reviewsDraft,
    required this.reviewsNotStarted,
    required this.reviewsOverdue,
    required this.underCoveredPapers,
    required this.decisionsTotal,
    required this.acceptRate,
    required this.decisionsByOutcome,
    required this.registrationsTotal,
    required this.registrationsPaid,
    required this.registrationsUnpaid,
    required this.registrationsAtRisk,
    required this.registrationsOverdue,
    required this.registrationsByStatus,
    required this.unpaidAccepted,
    required this.institutions,
    required this.revenue,
    required this.currencyReports,
    required this.computedAt,
  });

  final int submissionsTotal;
  final List<Count> submissionsByStatus;
  final List<Count> submissionsByDay;
  final int reviewsAssigned;
  final int reviewsSubmitted;
  final int reviewsDraft;
  final int reviewsNotStarted;
  final int reviewsOverdue;
  final int underCoveredPapers;
  final int decisionsTotal;
  final double acceptRate;
  final List<Count> decisionsByOutcome;
  final int registrationsTotal;
  final int registrationsPaid;
  final int registrationsUnpaid;
  final int registrationsAtRisk;
  final int registrationsOverdue;
  final List<Count> registrationsByStatus;
  final int unpaidAccepted;
  final List<Count> institutions;

  /// Null when the key lacks `finance:read`.
  final RevenueReport? revenue;
  final List<RevenueReport> currencyReports;
  final DateTime? computedAt;

  int get reviewsPending => reviewsDraft + reviewsNotStarted;

  /// One report per currency when the conference takes more than one.
  List<RevenueReport> get revenueReports =>
      currencyReports.isNotEmpty ? currencyReports : [?revenue];

  factory AnalyticsOverview.fromJson(Map<String, dynamic> j) {
    final s = _map(j['submissions']), r = _map(j['reviews']);
    final d = _map(j['decisions']), g = _map(j['registrations']);
    return AnalyticsOverview(
      submissionsTotal: _int(s['total']),
      submissionsByStatus: _counts(s['byStatus'], 'status'),
      submissionsByDay: _counts(s['byDay'], 'date'),
      reviewsAssigned: _int(r['assigned']),
      reviewsSubmitted: _int(r['submitted']),
      reviewsDraft: _int(r['draft']),
      reviewsNotStarted: _int(r['notStarted']),
      reviewsOverdue: _int(r['overdue']),
      underCoveredPapers: _int(r['underCoveredPapers']),
      decisionsTotal: _int(d['total']),
      acceptRate: d['acceptRate'] is num
          ? (d['acceptRate'] as num).toDouble()
          : 0,
      decisionsByOutcome: _counts(d['byOutcome'], 'outcome'),
      registrationsTotal: _int(g['total']),
      registrationsPaid: _int(g['paid']),
      registrationsUnpaid: _int(g['unpaid']),
      registrationsAtRisk: _int(g['atRisk']),
      registrationsOverdue: _int(g['overdue']),
      registrationsByStatus: _counts(g['byStatus'], 'status'),
      unpaidAccepted: _int(j['unpaidAccepted']),
      institutions: _counts(j['institutions'], 'name'),
      revenue: j['revenueMinor'] is num ? RevenueReport.fromJson(j) : null,
      currencyReports: _list(
        j['currencyReports'],
      ).map(RevenueReport.fromJson).toList(),
      computedAt: DateTime.tryParse('${j['computedAt'] ?? ''}'),
    );
  }
}

class Capabilities {
  const Capabilities({
    required this.conferenceName,
    required this.scopes,
    this.expiresAt,
  });
  final String conferenceName;
  final List<String> scopes;
  final DateTime? expiresAt;

  bool has(String scope) => scopes.contains(scope);

  factory Capabilities.fromJson(Map<String, dynamic> j) => Capabilities(
    conferenceName: '${_map(j['conference'])['name'] ?? 'Conference'}',
    scopes: j['scopes'] is List
        ? (j['scopes'] as List).map((e) => '$e').toList()
        : const [],
    expiresAt: DateTime.tryParse('${j['expiresAt'] ?? ''}'),
  );
}
