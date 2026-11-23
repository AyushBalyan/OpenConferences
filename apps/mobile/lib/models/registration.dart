class Registration {
  const Registration({
    required this.id,
    required this.status,
    required this.audience,
    required this.amountDueMinor,
    required this.currency,
    this.paperTitle,
    this.submissionNumber,
    this.billingName,
    this.billingEmail,
    this.billingCountry,
    this.billingAffiliation,
    this.lockedTiming,
    this.deadlineAt,
    this.earlyBirdExtendedUntil,
    this.registeredAt,
    this.isAdditionalPaper = false,
  });

  final String id;
  final String status;
  final String audience;
  final int amountDueMinor;
  final String currency;
  final String? paperTitle;
  final String? submissionNumber;
  final String? billingName;
  final String? billingEmail;
  final String? billingCountry;
  final String? billingAffiliation;
  final String? lockedTiming;
  final DateTime? deadlineAt;
  final DateTime? earlyBirdExtendedUntil;
  final DateTime? registeredAt;
  final bool isAdditionalPaper;

  bool get owesMoney =>
      status == 'PENDING' || status == 'ADDITIONAL_PAYMENT_REQUIRED';
  bool isOverdue(DateTime now) =>
      owesMoney && deadlineAt != null && deadlineAt!.isBefore(now);
  bool get isEarlyBird => lockedTiming == 'EARLY';

  static String? _text(dynamic v) =>
      v is String && v.trim().isNotEmpty ? v : null;
  static DateTime? _date(dynamic v) =>
      v is String ? DateTime.tryParse(v)?.toLocal() : null;

  factory Registration.fromJson(Map<String, dynamic> j) => Registration(
    id: '${j['id']}',
    status: '${j['status'] ?? 'PENDING'}',
    audience: '${j['audience'] ?? 'REGULAR'}',
    amountDueMinor: j['amountDueMinor'] is num
        ? (j['amountDueMinor'] as num).toInt()
        : 0,
    currency: '${j['currency'] ?? ''}',
    paperTitle: _text(j['paperTitle']),
    submissionNumber: _text(j['submissionNumber']),
    billingName: _text(j['billingName']),
    billingEmail: _text(j['billingEmail']),
    billingCountry: _text(j['billingCountry']),
    billingAffiliation: _text(j['billingAffiliation']),
    lockedTiming: _text(j['lockedTiming']),
    deadlineAt: _date(j['deadlineAt']),
    earlyBirdExtendedUntil: _date(j['earlyBirdExtendedUntil']),
    registeredAt: _date(j['registeredAt']),
    isAdditionalPaper: j['isAdditionalPaper'] == true,
  );
}

class RegistrationSummary {
  const RegistrationSummary({
    required this.total,
    required this.paid,
    required this.awaitingVerification,
    required this.unpaid,
    required this.overdue,
    required this.atRisk,
  });
  final int total, paid, awaitingVerification, unpaid, overdue, atRisk;

  factory RegistrationSummary.fromJson(Map<String, dynamic> j) {
    int n(String k) => j[k] is num ? (j[k] as num).toInt() : 0;
    return RegistrationSummary(
      total: n('total'),
      paid: n('paid'),
      awaitingVerification: n('awaitingVerification'),
      unpaid: n('unpaid'),
      overdue: n('overdue'),
      atRisk: n('atRisk'),
    );
  }
}

class RegistrationPage {
  const RegistrationPage({
    required this.items,
    this.nextCursor,
    this.summary,
    this.earlyBirdEndsAt,
  });
  final List<Registration> items;
  final String? nextCursor;

  /// Present on the first page only.
  final RegistrationSummary? summary;
  final DateTime? earlyBirdEndsAt;

  factory RegistrationPage.fromJson(Map<String, dynamic> j) => RegistrationPage(
    items: (j['data'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => Registration.fromJson(e.cast<String, dynamic>()))
        .toList(),
    nextCursor: j['nextCursor'] as String?,
    summary: j['summary'] is Map
        ? RegistrationSummary.fromJson(
            (j['summary'] as Map).cast<String, dynamic>(),
          )
        : null,
    earlyBirdEndsAt: j['earlyBirdEndsAt'] is String
        ? DateTime.tryParse(j['earlyBirdEndsAt'] as String)?.toLocal()
        : null,
  );
}
