import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/providers.dart';
import '../../models/analytics.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';

/// Shared by the Overview and Analytics tabs: loading, error and pull to refresh.
class OverviewLoader extends ConsumerWidget {
  const OverviewLoader({super.key, required this.builder});
  final List<Widget> Function(BuildContext context, AnalyticsOverview data)
  builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(overviewProvider);
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
      return overview.hasError
          ? ErrorState(
              error: overview.error!,
              onRetry: () => ref.invalidate(overviewProvider),
              onReconnect: () =>
                  ref.read(credentialsProvider.notifier).disconnect(),
            )
          : const Center(child: CircularProgressIndicator());
    }
    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.all(12),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (overview.hasError)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
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

class OverviewScreen extends ConsumerWidget {
  const OverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OverviewLoader(
      builder: (context, data) {
        final revenue = data.revenue;
        final attention = <(String, int, bool)>[
          ('Overdue reviews', data.reviewsOverdue, true),
          ('Papers needing more reviewers', data.underCoveredPapers, true),
          ('Accepted papers not yet paid', data.unpaidAccepted, true),
          ('Registrations past the deadline', data.registrationsOverdue, true),
          ('Registrations due within 7 days', data.registrationsAtRisk, false),
        ].where((row) => row.$2 > 0).toList();

        return [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.9,
            children: [
              KpiTile(label: 'Submissions', value: '${data.submissionsTotal}'),
              KpiTile(
                label: 'Reviews pending',
                value: '${data.reviewsPending}',
                suffix: 'of ${data.reviewsAssigned}',
              ),
              KpiTile(
                label: 'Registrations paid',
                value: '${data.registrationsPaid}',
                suffix: 'of ${data.registrationsTotal}',
              ),
              if (revenue != null)
                KpiTile(
                  label: 'Revenue',
                  value: money(
                    revenue.revenueMinor,
                    revenue.currency,
                    compact: true,
                  ),
                  color: context.scheme.primary,
                )
              else
                KpiTile(
                  label: 'Accept rate',
                  value: data.decisionsTotal == 0
                      ? 'None yet'
                      : '${(data.acceptRate * 100).round()}%',
                ),
            ],
          ),
          const SizedBox(height: 16),
          const Padding(
            padding: EdgeInsets.only(left: 2, bottom: 8),
            child: Eyebrow('Needs attention'),
          ),
          Card(
            child: attention.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(
                          Icons.check_circle_outline,
                          color: context.scheme.primary,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Nothing needs attention right now.',
                          style: context.text.bodyMedium,
                        ),
                      ],
                    ),
                  )
                : Column(
                    children: [
                      for (final (index, row) in attention.indexed) ...[
                        if (index > 0) const Divider(),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 13,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  row.$1,
                                  style: context.text.bodyMedium,
                                ),
                              ),
                              Text(
                                '${row.$2}',
                                style: context.text.titleMedium?.copyWith(
                                  color: row.$3
                                      ? context.scheme.tertiary
                                      : context.scheme.secondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
          const SizedBox(height: 14),
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
