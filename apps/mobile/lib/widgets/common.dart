import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../theme/esn_theme.dart';

String money(int minor, String currency, {bool compact = false}) {
  final value = minor / 100;
  try {
    return compact
        ? NumberFormat.compactSimpleCurrency(name: currency).format(value)
        : NumberFormat.simpleCurrency(
            name: currency,
            decimalDigits: minor % 100 == 0 ? 0 : 2,
          ).format(value);
  } catch (_) {
    return '$currency ${value.toStringAsFixed(0)}';
  }
}

String shortDate(DateTime? date) =>
    date == null ? 'Not set' : DateFormat('d MMM y').format(date);

/// "UNDER_REVIEW" becomes "Under review".
String humanize(String raw) {
  final words = raw.replaceAll(RegExp('[_-]+'), ' ').toLowerCase().trim();
  return words.isEmpty ? raw : words[0].toUpperCase() + words.substring(1);
}

/// The small uppercase section label used across the site.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.label, {super.key, this.color});
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
    label.toUpperCase(),
    style: context.text.labelSmall?.copyWith(color: color),
  );
}

class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
  });
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Eyebrow(title)),
              ?trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    ),
  );
}

class KpiTile extends StatelessWidget {
  const KpiTile({
    super.key,
    required this.label,
    required this.value,
    this.suffix,
    this.color,
  });
  final String label;
  final String value;
  final String? suffix;
  final Color? color;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: context.text.bodySmall,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text.rich(
              TextSpan(
                text: value,
                style: context.text.headlineSmall?.copyWith(color: color),
                children: [
                  if (suffix != null)
                    TextSpan(text: ' $suffix', style: context.text.bodySmall),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.label, this.color, {super.key});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      border: Border.all(color: color),
      borderRadius: BorderRadius.circular(Esn.radius),
    ),
    child: Text(
      label,
      style: context.text.labelMedium?.copyWith(color: color, fontSize: 11),
    ),
  );
}

/// A labelled horizontal bar, used for every "by category" breakdown.
class BarRow extends StatelessWidget {
  const BarRow({
    super.key,
    required this.label,
    required this.value,
    required this.fraction,
    required this.color,
  });
  final String label;
  final String value;
  final double fraction;
  final Color color;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: context.text.bodyMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(value, style: context.text.labelLarge),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: fraction.isFinite ? fraction.clamp(0.0, 1.0) : 0,
            minHeight: 8,
            color: color,
            backgroundColor: context.esn.line.withValues(alpha: 0.5),
          ),
        ),
      ],
    ),
  );
}

class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.error,
    required this.onRetry,
    this.onReconnect,
  });
  final Object error;
  final VoidCallback onRetry;
  final VoidCallback? onReconnect;

  @override
  Widget build(BuildContext context) {
    final api = error is ApiException
        ? error as ApiException
        : const ApiException(ApiFailure.unknown);
    final reconnect = api.needsReconnect && onReconnect != null;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              api.kind == ApiFailure.offline
                  ? Icons.cloud_off_outlined
                  : Icons.error_outline,
              size: 36,
              color: context.scheme.tertiary,
            ),
            const SizedBox(height: 12),
            Text(
              api.message,
              style: context.text.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: reconnect ? onReconnect : onRetry,
              child: Text(reconnect ? 'Connect again' : 'Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            title,
            style: context.text.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: context.text.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}
