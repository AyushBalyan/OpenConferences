import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/providers.dart';
import '../../core/settings.dart';
import '../../models/analytics.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';
import '../shell/tab_header.dart';

/// Shared by the Overview and Analytics tabs: header, loading, error and
/// pull to refresh.
class OverviewLoader extends ConsumerWidget {
  const OverviewLoader({super.key, required this.title, required this.builder});
  final String title;
  final List<Widget> Function(BuildContext context, AnalyticsOverview data)
  builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(overviewProvider);
    final insets = MediaQuery.paddingOf(context);
    Future<void> refresh() async {
      ref.invalidate(overviewProvider);
      try {
        await ref.read(overviewProvider.future);
      } catch (_) {
        // The stale numbers stay on screen with a notice above them.
      }
    }

    final data = overview.value;
    if (data == null) {
      return Padding(
        padding: EdgeInsets.fromLTRB(16, insets.top, 16, insets.bottom),
        child: Column(
          children: [
            TabHeader(title: title),
            Expanded(
              child: overview.hasError
                  ? ErrorState(
                      error: overview.error!,
                      onRetry: () => ref.invalidate(overviewProvider),
                      onReconnect: () =>
                          ref.read(credentialsProvider.notifier).disconnect(),
                    )
                  : const LoadingState(),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: refresh,
      edgeOffset: insets.top,
      child: ListView(
        padding: EdgeInsets.fromLTRB(16, insets.top, 16, insets.bottom + 24),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        children: [
          TabHeader(title: title),
          if (overview.hasError)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
              child: Text(
                "Couldn't refresh. Showing the last numbers loaded.",
                style: context.text.bodySmall?.copyWith(
                  color: context.scheme.tertiary,
                ),
              ),
            ),
          ...builder(context, data),
        ],
      ),
    );
  }
}

class OverviewScreen extends StatelessWidget {
  const OverviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return OverviewLoader(
      title: 'Overview',
      builder: (context, data) {
        final scheme = context.scheme;
        final revenue = data.revenue;
        final attention = <(String, int, IconData, Color)>[
          (
            'Overdue reviews',
            data.reviewsOverdue,
            CupertinoIcons.clock_fill,
            scheme.tertiary,
          ),
          (
            'Papers needing more reviewers',
            data.underCoveredPapers,
            CupertinoIcons.person_crop_circle_badge_exclam,
            scheme.tertiary,
          ),
          (
            'Accepted papers not yet paid',
            data.unpaidAccepted,
            CupertinoIcons.creditcard_fill,
            scheme.tertiary,
          ),
          (
            'Registrations past the deadline',
            data.registrationsOverdue,
            CupertinoIcons.flag_fill,
            scheme.tertiary,
          ),
          (
            'Registrations due within 7 days',
            data.registrationsAtRisk,
            CupertinoIcons.timer,
            scheme.secondary,
          ),
        ].where((row) => row.$2 > 0).toList();

        return [
          _Hero(data: data),
          const SizedBox(height: 12),
          GridView(
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              mainAxisExtent: 136,
            ),
            children: [
              KpiTile(
                label: 'Submissions',
                value: '${data.submissionsTotal}',
                icon: CupertinoIcons.doc_text_fill,
              ),
              KpiTile(
                label: 'Reviews pending',
                value: '${data.reviewsPending}',
                suffix: 'of ${data.reviewsAssigned}',
                icon: CupertinoIcons.pencil_circle_fill,
                color: scheme.secondary,
              ),
              KpiTile(
                label: 'Registrations paid',
                value: '${data.registrationsPaid}',
                suffix: 'of ${data.registrationsTotal}',
                icon: CupertinoIcons.ticket_fill,
              ),
              if (revenue != null)
                KpiTile(
                  label: 'Accept rate',
                  value: data.decisionsTotal == 0
                      ? 'None yet'
                      : '${(data.acceptRate * 100).round()}%',
                  icon: CupertinoIcons.checkmark_seal_fill,
                  color: scheme.tertiary,
                )
              else
                KpiTile(
                  label: 'Decisions made',
                  value: '${data.decisionsTotal}',
                  icon: CupertinoIcons.checkmark_seal_fill,
                  color: scheme.tertiary,
                ),
            ],
          ),
          const SectionHeader('Needs attention'),
          Panel(
            padding: EdgeInsets.zero,
            child: attention.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(18),
                    child: Row(
                      children: [
                        IconBadge(
                          CupertinoIcons.checkmark_circle_fill,
                          scheme.primary,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Nothing needs attention right now.',
                            style: context.text.bodyMedium,
                          ),
                        ),
                      ],
                    ),
                  )
                : Column(
                    children: [
                      for (final (index, row) in attention.indexed) ...[
                        if (index > 0) const Divider(indent: 62),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          child: Row(
                            children: [
                              IconBadge(row.$3, row.$4),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  row.$1,
                                  style: context.text.bodyMedium,
                                ),
                              ),
                              const SizedBox(width: 8),
                              StatusChip('${row.$2}', row.$4),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
          const SizedBox(height: 18),
          if (data.computedAt != null)
            Center(
              child: Text(
                'Updated ${DateFormat('d MMM, HH:mm').format(data.computedAt!.toLocal())}',
                style: context.text.bodySmall,
              ),
            ),
        ];
      },
    );
  }
}

/// The headline card: money in (or the accept rate) beside a paid-share ring.
class _Hero extends ConsumerWidget {
  const _Hero({required this.data});
  final AnalyticsOverview data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revenue = data.revenue;
    final paidShare = data.registrationsTotal == 0
        ? 0.0
        : data.registrationsPaid / data.registrationsTotal;
    final soft = Colors.white.withValues(alpha: 0.72);
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 22, 20, 22),
      decoration: ShapeDecoration(
        shape: squircle(30),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B7566), Esn.cover],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  revenue != null ? 'Revenue' : 'Accept rate',
                  style: context.text.labelLarge?.copyWith(color: soft),
                ),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    revenue != null
                        ? ref
                              .watch(moneyProvider)
                              .format(
                                revenue.revenueMinor,
                                revenue.currency,
                                compact: true,
                              )
                        : data.decisionsTotal == 0
                        ? 'None yet'
                        : '${(data.acceptRate * 100).round()}%',
                    style: context.text.displaySmall?.copyWith(
                      color: Colors.white,
                      fontSize: 40,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${data.registrationsPaid} of ${data.registrationsTotal} registrations paid',
                  style: context.text.bodySmall?.copyWith(color: soft),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          ProgressRing(
            fraction: paidShare,
            color: Colors.white,
            track: Colors.white.withValues(alpha: 0.2),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${(paidShare * 100).round()}%',
                  style: context.text.titleMedium?.copyWith(
                    color: Colors.white,
                    fontSize: 18,
                  ),
                ),
                Text(
                  'paid',
                  style: context.text.bodySmall?.copyWith(
                    color: soft,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
