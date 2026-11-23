import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/settings.dart';
import '../../models/analytics.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';
import '../overview/overview_screen.dart';

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyProvider);
    return OverviewLoader(
      title: 'Analytics',
      builder: (context, data) {
        Widget note(String text) => Text(text, style: context.text.bodySmall);
        Widget figure(String text) => Text(
          text,
          style: context.text.labelLarge?.copyWith(
            color: context.scheme.primary,
          ),
        );

        final sections = <Widget>[
          if (data.submissionsByDay.length > 1)
            SectionCard(
              title: 'Submissions by day',
              trailing: note('${data.submissionsTotal} total'),
              child: _SubmissionsChart(days: data.submissionsByDay),
            ),
          if (data.submissionsByStatus.isNotEmpty)
            SectionCard(
              title: 'Submissions by status',
              child: _Bars(
                counts: data.submissionsByStatus,
                color: context.scheme.primary,
              ),
            ),
          SectionCard(
            title: 'Review progress',
            trailing: note('${data.reviewsAssigned} assigned'),
            child: _ReviewProgress(data: data),
          ),
          SectionCard(
            title: 'Decisions',
            trailing: data.decisionsTotal == 0
                ? null
                : figure('${(data.acceptRate * 100).round()}% accepted'),
            child: data.decisionsByOutcome.isEmpty
                ? note('No decisions recorded yet.')
                : _Bars(
                    counts: data.decisionsByOutcome,
                    color: context.scheme.secondary,
                  ),
          ),
          if (data.registrationsByStatus.isNotEmpty)
            SectionCard(
              title: 'Registrations by status',
              trailing: note('${data.registrationsTotal} total'),
              child: _Bars(
                counts: data.registrationsByStatus,
                color: context.scheme.primary,
              ),
            ),
          for (final report in data.revenueReports)
            SectionCard(
              title: data.revenueReports.length > 1
                  ? 'Revenue in ${report.currency}'
                  : 'Revenue',
              trailing: figure(
                money.format(report.revenueMinor, report.currency),
              ),
              child: _Revenue(report: report),
            ),
          if (data.institutions.isNotEmpty)
            SectionCard(
              title: 'Top institutions',
              child: _Bars(
                counts: data.institutions.take(6).toList(),
                color: context.scheme.secondary,
                humanizeLabels: false,
              ),
            ),
        ];
        return [
          for (final (index, section) in sections.indexed) ...[
            if (index > 0) const SizedBox(height: 12),
            section,
          ],
        ];
      },
    );
  }
}

class _Bars extends StatelessWidget {
  const _Bars({
    required this.counts,
    required this.color,
    this.humanizeLabels = true,
  });
  final List<Count> counts;
  final Color color;
  final bool humanizeLabels;

  @override
  Widget build(BuildContext context) {
    final max = counts.fold<int>(0, (m, c) => math.max(m, c.count));
    return Column(
      children: [
        for (final c in counts)
          BarRow(
            label: humanizeLabels ? humanize(c.name) : c.name,
            value: '${c.count}',
            fraction: max == 0 ? 0 : c.count / max,
            color: color,
          ),
      ],
    );
  }
}

class _ReviewProgress extends StatelessWidget {
  const _ReviewProgress({required this.data});
  final AnalyticsOverview data;

  @override
  Widget build(BuildContext context) {
    final parts = [
      ('Submitted', data.reviewsSubmitted, context.scheme.primary),
      ('In draft', data.reviewsDraft, context.scheme.secondary),
      ('Not started', data.reviewsNotStarted, context.esn.muted),
    ];
    final total = parts.fold<int>(0, (sum, p) => sum + p.$2);
    if (total == 0) {
      return Text('No reviews assigned yet.', style: context.text.bodySmall);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${(data.reviewsSubmitted / total * 100).round()}%',
              style: context.text.headlineSmall,
            ),
            const SizedBox(width: 6),
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('complete', style: context.text.bodySmall),
            ),
            const Spacer(),
            if (data.reviewsOverdue > 0)
              StatusChip(
                '${data.reviewsOverdue} overdue',
                context.scheme.tertiary,
              ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 12,
          child: Row(
            spacing: 3,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final p in parts)
                if (p.$2 > 0)
                  Expanded(
                    flex: p.$2,
                    child: DecoratedBox(
                      decoration: ShapeDecoration(
                        color: p.$3,
                        shape: const StadiumBorder(),
                      ),
                    ),
                  ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 16,
          runSpacing: 6,
          children: [
            for (final p in parts)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: p.$3,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text('${p.$1} ${p.$2}', style: context.text.bodySmall),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

class _Revenue extends ConsumerWidget {
  const _Revenue({required this.report});
  final RevenueReport report;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyProvider);
    Widget group(String title, List<Amount> amounts, Color color) {
      final max = amounts.fold<int>(
        0,
        (m, a) => math.max(m, a.amountMinor.abs()),
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Eyebrow(title),
          const SizedBox(height: 2),
          for (final a in amounts)
            BarRow(
              label: humanize(a.name),
              value: money.format(a.amountMinor, report.currency),
              fraction: max == 0 ? 0 : a.amountMinor.abs() / max,
              color: color,
            ),
        ],
      );
    }

    if (report.byTiming.isEmpty && report.byAudience.isEmpty) {
      return Text('No payments received yet.', style: context.text.bodySmall);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (report.byTiming.isNotEmpty)
          group('By fee timing', report.byTiming, context.scheme.tertiary),
        if (report.byTiming.isNotEmpty && report.byAudience.isNotEmpty)
          const SizedBox(height: 14),
        if (report.byAudience.isNotEmpty)
          group('By audience', report.byAudience, context.scheme.primary),
      ],
    );
  }
}

class _SubmissionsChart extends StatelessWidget {
  const _SubmissionsChart({required this.days});
  final List<Count> days;

  @override
  Widget build(BuildContext context) {
    final color = context.scheme.primary;
    final maxY = days.fold<int>(0, (m, d) => math.max(m, d.count)).toDouble();
    String label(int index) {
      final date = DateTime.tryParse(days[index].name);
      return date == null ? days[index].name : DateFormat('d MMM').format(date);
    }

    return Column(
      children: [
        SizedBox(
          height: 150,
          child: LineChart(
            LineChartData(
              minY: 0,
              maxY: math.max(1, maxY * 1.15),
              gridData: FlGridData(
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) =>
                    FlLine(color: context.esn.line, strokeWidth: 0.7),
              ),
              borderData: FlBorderData(show: false),
              titlesData: const FlTitlesData(show: false),
              lineTouchData: LineTouchData(
                getTouchedSpotIndicator: (_, indexes) => [
                  for (final _ in indexes)
                    TouchedSpotIndicatorData(
                      FlLine(color: color.withValues(alpha: 0.3)),
                      FlDotData(
                        getDotPainter: (_, _, _, _) => FlDotCirclePainter(
                          radius: 5,
                          color: color,
                          strokeWidth: 3,
                          strokeColor: context.esn.card,
                        ),
                      ),
                    ),
                ],
                touchTooltipData: LineTouchTooltipData(
                  getTooltipColor: (_) => context.scheme.onSurface,
                  tooltipBorderRadius: BorderRadius.circular(12),
                  tooltipPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  getTooltipItems: (spots) => [
                    for (final s in spots)
                      LineTooltipItem(
                        '${label(s.x.toInt())}  ${s.y.toInt()}',
                        context.text.labelMedium!.copyWith(
                          color: context.esn.card,
                        ),
                      ),
                  ],
                ),
              ),
              lineBarsData: [
                LineChartBarData(
                  spots: [
                    for (final (i, d) in days.indexed)
                      FlSpot(i.toDouble(), d.count.toDouble()),
                  ],
                  color: color,
                  barWidth: 3,
                  isCurved: true,
                  preventCurveOverShooting: true,
                  isStrokeCapRound: true,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(
                    show: true,
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        color.withValues(alpha: 0.28),
                        color.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label(0), style: context.text.bodySmall),
            Text(label(days.length - 1), style: context.text.bodySmall),
          ],
        ),
      ],
    );
  }
}
