import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../../core/settings.dart';
import '../../models/registration.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';
import '../shell/tab_header.dart';

/// Label and color for a registration, kept inside the site palette.
(String, Color) registrationBadge(BuildContext context, Registration r) {
  final scheme = context.scheme;
  if (r.isOverdue(DateTime.now())) return ('Overdue', scheme.tertiary);
  return switch (r.status) {
    'PAID' => ('Paid', scheme.primary),
    'AWAITING_VERIFICATION' => ('Awaiting check', scheme.secondary),
    'PENDING' => ('Unpaid', scheme.secondary),
    'ADDITIONAL_PAYMENT_REQUIRED' => ('Top-up due', scheme.tertiary),
    'DISCARDED_NONPAYMENT' => ('Discarded', context.esn.muted),
    _ => (humanize(r.status), context.esn.muted),
  };
}

class RegistrationsScreen extends ConsumerStatefulWidget {
  const RegistrationsScreen({super.key});

  @override
  ConsumerState<RegistrationsScreen> createState() =>
      _RegistrationsScreenState();
}

class _RegistrationsScreenState extends ConsumerState<RegistrationsScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) {
        ref.read(registrationListProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onSearch(String text) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      final notifier = ref.read(registrationListProvider.notifier);
      notifier.setQuery(
        ref.read(registrationListProvider).query.copyWith(search: text),
      );
    });
    setState(() {});
  }

  void _open(Registration registration, DateTime? earlyBirdEndsAt) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => RegistrationDetailSheet(
        registration: registration,
        conferenceEarlyBirdEndsAt: earlyBirdEndsAt,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(registrationListProvider);
    final notifier = ref.read(registrationListProvider.notifier);
    final insets = MediaQuery.paddingOf(context);
    final summary = state.summary;
    final filters = <(String, String?, int?)>[
      ('All', null, summary?.total),
      ('Paid', 'paid', summary?.paid),
      ('Unpaid', 'unpaid', summary?.unpaid),
      ('Overdue', 'overdue', summary?.overdue),
      ('Due soon', 'at-risk', summary?.atRisk),
      (
        'Awaiting check',
        'AWAITING_VERIFICATION',
        summary?.awaitingVerification,
      ),
    ];
    const physics = AlwaysScrollableScrollPhysics(
      parent: BouncingScrollPhysics(),
    );

    Widget body;
    if (state.loading && state.items.isEmpty) {
      body = const LoadingState();
    } else if (state.error != null && state.items.isEmpty) {
      body = ErrorState(
        error: state.error!,
        onRetry: notifier.refresh,
        onReconnect: () => ref.read(credentialsProvider.notifier).disconnect(),
      );
    } else if (state.items.isEmpty) {
      body = ListView(
        physics: physics,
        children: const [
          SizedBox(height: 60),
          EmptyState(
            title: 'No registrations match',
            body: 'Try another filter or clear the search.',
          ),
        ],
      );
    } else {
      body = ListView.separated(
        controller: _scroll,
        physics: physics,
        padding: EdgeInsets.fromLTRB(16, 6, 16, insets.bottom + 24),
        itemCount: state.items.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == state.items.length) {
            if (state.loadingMore) {
              return const Padding(
                padding: EdgeInsets.all(14),
                child: LoadingState(),
              );
            }
            return Padding(
              padding: const EdgeInsets.all(8),
              child: Center(
                child: Text(
                  state.nextCursor == null
                      ? 'Showing all ${state.items.length}'
                      : 'Showing ${state.items.length}',
                  style: context.text.bodySmall,
                ),
              ),
            );
          }
          final registration = state.items[index];
          return _RegistrationTile(
            registration: registration,
            onTap: () => _open(registration, state.earlyBirdEndsAt),
          );
        },
      );
    }

    return Padding(
      padding: EdgeInsets.only(top: insets.top),
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: TabHeader(title: 'Registrations'),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    onChanged: _onSearch,
                    textInputAction: TextInputAction.search,
                    style: context.text.bodyLarge?.copyWith(fontSize: 16),
                    decoration: InputDecoration(
                      hintText: 'Paper, name or email',
                      prefixIcon: Icon(
                        CupertinoIcons.search,
                        size: 19,
                        color: context.esn.muted,
                      ),
                      prefixIconConstraints: const BoxConstraints(
                        minWidth: 42,
                        minHeight: 44,
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Clear search',
                              icon: Icon(
                                CupertinoIcons.xmark_circle_fill,
                                size: 18,
                                color: context.esn.muted,
                              ),
                              onPressed: () {
                                _search.clear();
                                _onSearch('');
                              },
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                PopupMenuButton<RegistrationSort>(
                  tooltip: 'Sort',
                  initialValue: state.query.sort,
                  position: PopupMenuPosition.under,
                  onSelected: (sort) =>
                      notifier.setQuery(state.query.copyWith(sort: sort)),
                  itemBuilder: (_) => [
                    for (final sort in RegistrationSort.values)
                      PopupMenuItem(value: sort, child: Text(sort.label)),
                  ],
                  child: Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: context.esn.fill,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      CupertinoIcons.arrow_up_arrow_down,
                      size: 18,
                      color: context.scheme.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: filters.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final (label, status, count) = filters[index];
                final selected = state.query.status == status;
                return _FilterChip(
                  label: count == null ? label : '$label $count',
                  selected: selected,
                  onTap: () => notifier.setQuery(
                    state.query.copyWith(status: () => status),
                  ),
                );
              },
            ),
          ),
          SizedBox(
            height: 10,
            child: state.loading && state.items.isNotEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: LinearProgressIndicator(
                        minHeight: 2,
                        borderRadius: BorderRadius.all(Radius.circular(2)),
                      ),
                    ),
                  )
                : null,
          ),
          if (state.error != null && state.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 6),
              child: Text(
                state.error!.message,
                style: context.text.bodySmall?.copyWith(
                  color: context.scheme.tertiary,
                ),
              ),
            ),
          Expanded(
            child: RefreshIndicator(onRefresh: notifier.refresh, child: body),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? context.scheme.primary : context.esn.card,
      shape: const StadiumBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Center(
            child: Text(
              label,
              style: context.text.labelMedium?.copyWith(
                fontSize: 14,
                color: selected
                    ? context.scheme.onPrimary
                    : context.scheme.onSurface,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RegistrationTile extends ConsumerWidget {
  const _RegistrationTile({required this.registration, required this.onTap});
  final Registration registration;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = registration;
    final (label, color) = registrationBadge(context, r);
    final who = r.billingName ?? r.billingEmail ?? 'No billing details yet';
    final tags = [
      if (r.isEarlyBird) ('Early bird', context.scheme.tertiary),
      if (r.audience == 'STUDENT') ('Student', context.scheme.secondary),
    ];
    return Panel(
      radius: Esn.tileRadius,
      padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  r.paperTitle ?? 'Untitled paper',
                  style: context.text.titleMedium,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  '${r.submissionNumber ?? 'No paper number'} · $who',
                  style: context.text.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (tags.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    spacing: 10,
                    children: [
                      for (final (tag, tagColor) in tags)
                        Text(
                          tag,
                          style: context.text.labelMedium?.copyWith(
                            color: tagColor,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                ref.watch(moneyProvider).format(r.amountDueMinor, r.currency),
                style: context.text.labelLarge,
              ),
              const SizedBox(height: 7),
              StatusChip(label, color),
            ],
          ),
          const SizedBox(width: 4),
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Icon(
              CupertinoIcons.chevron_right,
              size: 14,
              color: context.esn.muted.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}

class RegistrationDetailSheet extends ConsumerWidget {
  const RegistrationDetailSheet({
    super.key,
    required this.registration,
    this.conferenceEarlyBirdEndsAt,
  });
  final Registration registration;
  final DateTime? conferenceEarlyBirdEndsAt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = registration;
    final (label, color) = registrationBadge(context, r);
    final extended = r.earlyBirdExtendedUntil;
    final earlyBirdEnds =
        extended != null &&
            (conferenceEarlyBirdEndsAt == null ||
                extended.isAfter(conferenceEarlyBirdEndsAt!))
        ? extended
        : conferenceEarlyBirdEndsAt;

    Widget group(String title, List<(String, String?)> rows) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 22, 16, 8),
          child: Eyebrow(title),
        ),
        Panel(
          radius: Esn.tileRadius,
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (index, (name, value)) in rows.indexed) ...[
                if (index > 0) const Divider(indent: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 13,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: context.text.bodyMedium),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Text(
                          value ?? 'Not provided',
                          textAlign: TextAlign.end,
                          style: context.text.bodyMedium?.copyWith(
                            color: context.esn.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.submissionNumber ?? 'No paper number',
                    style: context.text.labelMedium?.copyWith(
                      color: context.esn.muted,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    r.paperTitle ?? 'Untitled paper',
                    style: context.text.titleLarge,
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          ref
                              .watch(moneyProvider)
                              .format(r.amountDueMinor, r.currency),
                          style: context.text.displaySmall,
                        ),
                      ),
                      StatusChip(label, color),
                    ],
                  ),
                ],
              ),
            ),
            group('Fee', [
              ('Audience', humanize(r.audience)),
              (
                'Rate',
                r.lockedTiming == null
                    ? 'Not locked yet'
                    : humanize(r.lockedTiming!),
              ),
              if (r.isAdditionalPaper)
                ('Paper', 'Additional paper by the same author'),
            ]),
            group('Dates', [
              (
                'Paid on',
                r.registeredAt == null
                    ? 'Not paid yet'
                    : shortDate(r.registeredAt),
              ),
              ('Deadline', shortDate(r.deadlineAt)),
              (
                'Early bird ends',
                earlyBirdEnds == null
                    ? 'No early-bird rate'
                    : '${shortDate(earlyBirdEnds)}${identical(earlyBirdEnds, extended) ? ' (extended for this paper)' : ''}',
              ),
            ]),
            group('Billing', [
              ('Name', r.billingName),
              ('Email', r.billingEmail),
              ('Affiliation', r.billingAffiliation),
              ('Country', r.billingCountry),
            ]),
          ],
        ),
      ),
    );
  }
}
