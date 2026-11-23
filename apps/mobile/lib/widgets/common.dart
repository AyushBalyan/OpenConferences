import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
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

/// The ConfKit mark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 40});
  final double size;

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/logo.png',
    width: size,
    height: size,
    semanticLabel: 'ConfKit',
  );
}

/// The small uppercase label above a grouped list.
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

/// A rounded surface. Every card in the app is one of these.
class Panel extends StatelessWidget {
  const Panel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.radius = Esn.cardRadius,
    this.color,
    this.onTap,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Padding(padding: padding, child: child);
    return Material(
      color: color ?? context.esn.card,
      shape: squircle(radius),
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? content : InkWell(onTap: onTap, child: content),
    );
  }
}

/// A bold title above a block of content.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key});
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 26, 4, 12),
    child: Text(title, style: context.text.titleLarge),
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
  Widget build(BuildContext context) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(title, style: context.text.titleMedium)),
            ?trailing,
          ],
        ),
        const SizedBox(height: 16),
        child,
      ],
    ),
  );
}

/// A glyph on a tinted rounded square.
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, this.color, {super.key, this.size = 34});
  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: ShapeDecoration(
      color: color.withValues(alpha: 0.14),
      shape: squircle(size * 0.3),
    ),
    child: Icon(icon, size: size * 0.53, color: color),
  );
}

class KpiTile extends StatelessWidget {
  const KpiTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.suffix,
    this.color,
  });
  final String label;
  final String value;
  final IconData icon;
  final String? suffix;
  final Color? color;

  @override
  Widget build(BuildContext context) => Panel(
    radius: Esn.tileRadius,
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        IconBadge(icon, color ?? context.scheme.primary),
        const Spacer(),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text.rich(
            TextSpan(
              text: value,
              style: context.text.headlineSmall,
              children: [
                if (suffix != null)
                  TextSpan(
                    text: ' $suffix',
                    style: context.text.bodySmall?.copyWith(
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0,
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: context.text.bodySmall,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    ),
  );
}

/// A tinted capsule.
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, this.color, {super.key});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: ShapeDecoration(
      color: color.withValues(alpha: 0.14),
      shape: const StadiumBorder(),
    ),
    child: Text(
      label,
      style: context.text.labelMedium?.copyWith(color: color, fontSize: 12),
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
    padding: const EdgeInsets.symmetric(vertical: 7),
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
        const SizedBox(height: 7),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: fraction.isFinite ? fraction.clamp(0.0, 1.0) : 0,
            minHeight: 8,
            color: color,
            backgroundColor: context.esn.fill,
            borderRadius: BorderRadius.circular(99),
          ),
        ),
      ],
    ),
  );
}

/// A round progress ring with something in the middle.
class ProgressRing extends StatelessWidget {
  const ProgressRing({
    super.key,
    required this.fraction,
    required this.color,
    required this.track,
    this.size = 84,
    this.stroke = 9,
    this.child,
  });
  final double fraction;
  final Color color;
  final Color track;
  final double size;
  final double stroke;
  final Widget? child;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size,
    child: CustomPaint(
      painter: _RingPainter(
        fraction.isFinite ? fraction.clamp(0.0, 1.0) : 0,
        color,
        track,
        stroke,
      ),
      child: Center(child: child),
    ),
  );
}

class _RingPainter extends CustomPainter {
  const _RingPainter(this.fraction, this.color, this.track, this.stroke);
  final double fraction;
  final Color color;
  final Color track;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, math.pi * 2, false, paint..color = track);
    if (fraction > 0) {
      canvas.drawArc(
        rect,
        -math.pi / 2,
        math.pi * 2 * fraction,
        false,
        paint..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.color != color || old.track != track;
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key});

  @override
  Widget build(BuildContext context) =>
      const Center(child: CupertinoActivityIndicator(radius: 13));
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
        padding: const EdgeInsets.all(36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconBadge(
              api.kind == ApiFailure.offline
                  ? CupertinoIcons.wifi_slash
                  : CupertinoIcons.exclamationmark_triangle_fill,
              context.scheme.tertiary,
              size: 64,
            ),
            const SizedBox(height: 18),
            Text(
              api.message,
              style: context.text.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            FilledButton.tonal(
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, 46),
                padding: const EdgeInsets.symmetric(horizontal: 24),
                shape: const StadiumBorder(),
                backgroundColor: context.scheme.primary.withValues(alpha: 0.14),
                foregroundColor: context.scheme.primary,
                textStyle: context.text.labelLarge,
              ),
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
      padding: const EdgeInsets.all(36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconBadge(CupertinoIcons.tray, context.esn.muted, size: 64),
          const SizedBox(height: 18),
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
