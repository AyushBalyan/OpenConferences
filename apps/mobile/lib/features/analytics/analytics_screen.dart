import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/analytics.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';
import '../overview/overview_screen.dart';

class AnalyticsScreen extends StatelessWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return OverviewLoader(
      builder: (context, data) {
        final sections = <Widget>[
          if (data.submissionsByDay.length > 1)
            SectionCard(
              title: 'Submissions by day',
              trailing: Text(
                '${data.submissionsTotal} total',
                style: context.text.bodySmall,
              ),
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
            trailing: Text(
              '${data.reviewsAssigned} assigned',
              style: context.text.bodySmall,
            ),
            child: _ReviewProgress(data: data),
          ),
          SectionCard(
            title: 'Decisions',
            trailing: data.decisionsTotal == 0
                ? null
                : Text(
                    '${(data.acceptRate * 100).round()}% accepted',
                    style: context.text.labelLarge?.copyWith(
                      color: context.scheme.primary,
                    ),
                  ),
            child: data.decisionsByOutcome.isEmpty
                ? Text(
                    'No decisions recorded yet.',
                    style: context.text.bodySmall,
                  )
                : _Bars(
                    counts: data.decisionsByOutcome,
                    color: context.scheme.secondary,
                  ),
          ),
          if (data.registrationsByStatus.isNotEmpty)
            SectionCard(
              title: 'Registrations by status',
              trailing: Text(
                '${data.registrationsTotal} total',
                style: context.text.bodySmall,
              ),
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
              trailing: Text(
                money(report.revenueMinor, report.currency),
                style: context.text.labelLarge?.copyWith(
                  color: context.scheme.primary,
                ),
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
            if (index > 0) const SizedBox(height: 10),
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
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: SizedBox(
            height: 12,
            child: Row(
              children: [
                for (final p in parts)
                  if (p.$2 > 0)
                    Expanded(
                      flex: p.$2,
                      child: ColoredBox(color: p.$3),
                    ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 14,
          runSpacing: 6,
          children: [
            for (final p in parts)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 9, height: 9, color: p.$3),
                  const SizedBox(width: 5),
                  Text('${p.$1} ${p.$2}', style: context.text.bodySmall),
                ],
              ),
          ],
        ),
        if (data.reviewsOverdue > 0) ...[
          const SizedBox(height: 10),
          Text(
            '${data.reviewsOverdue} overdue',
            style: context.text.labelLarge?.copyWith(
              color: context.scheme.tertiary,
            ),
          ),
        ],
      ],
    );
  }
}

class _Revenue extends StatelessWidget {
  const _Revenue({required this.report});
  final RevenueReport report;

  @override
  Widget build(BuildContext context) {
    Widget group(String title, List<Amount> amounts, Color color) {
      final max = amounts.fold<int>(
        0,
        (m, a) => math.max(m, a.amountMinor.abs()),
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: context.text.bodySmall),
          for (final a in amounts)
            BarRow(
              label: humanize(a.name),
              value: money(a.amountMinor, report.currency),
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
          const SizedBox(height: 10),
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
          height: 130,
          child: LineChart(
            LineChartData(
              minY: 0,
              maxY: math.max(1, maxY * 1.15),
              gridData: FlGridData(
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) => FlLine(
                  color: context.esn.line,
                  strokeWidth: 1,
                  dashArray: [3, 4],
                ),
              ),
              borderData: FlBorderData(
                show: true,
                border: Border(bottom: BorderSide(color: context.esn.line)),
              ),
              titlesData: const FlTitlesData(show: false),
              lineTouchData: LineTouchData(
                touchTooltipData: LineTouchTooltipData(
                  getTooltipColor: (_) => Esn.forestDark,
                  getTooltipItems: (spots) => [
                    for (final s in spots)
                      LineTooltipItem(
                        '${label(s.x.toInt())}: ${s.y.toInt()}',
                        const TextStyle(color: Colors.white, fontSize: 12),
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
                  barWidth: 2,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(
                    show: true,
                    color: color.withValues(alpha: 0.10),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
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
