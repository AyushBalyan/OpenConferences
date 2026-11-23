import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../../models/registration.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';

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

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(registrationListProvider);
    final notifier = ref.read(registrationListProvider.notifier);
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

    Widget body;
    if (state.loading && state.items.isEmpty) {
      body = const Center(child: CircularProgressIndicator());
    } else if (state.error != null && state.items.isEmpty) {
      body = ErrorState(
        error: state.error!,
        onRetry: notifier.refresh,
        onReconnect: () => ref.read(credentialsProvider.notifier).disconnect(),
      );
    } else if (state.items.isEmpty) {
      body = ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 80),
          EmptyState(
            title: 'No registrations match',
            body: 'Try another filter or clear the search.',
          ),
        ],
      );
    } else {
      body = ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
        itemCount: state.items.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          if (index == state.items.length) {
            if (state.loadingMore) {
              return const Padding(
                padding: EdgeInsets.all(12),
                child: Center(child: CircularProgressIndicator()),
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
            onTap: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              showDragHandle: true,
              builder: (_) => RegistrationDetailSheet(
                registration: registration,
                conferenceEarlyBirdEndsAt: state.earlyBirdEndsAt,
              ),
            ),
          );
        },
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _search,
                  onChanged: _onSearch,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Paper, name or email',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _search.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Clear search',
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () {
                              _search.clear();
                              _onSearch('');
                            },
                          ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              PopupMenuButton<RegistrationSort>(
                tooltip: 'Sort',
                initialValue: state.query.sort,
                onSelected: (sort) =>
                    notifier.setQuery(state.query.copyWith(sort: sort)),
                itemBuilder: (_) => [
                  for (final sort in RegistrationSort.values)
                    PopupMenuItem(value: sort, child: Text(sort.label)),
                ],
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: context.esn.card,
                    border: Border.all(color: context.esn.line),
                    borderRadius: BorderRadius.circular(Esn.radius),
                  ),
                  child: const Icon(Icons.sort, size: 20),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: filters.length,
            separatorBuilder: (_, _) => const SizedBox(width: 6),
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
        if (state.loading && state.items.isNotEmpty)
          const LinearProgressIndicator(minHeight: 2),
        if (state.error != null && state.items.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            child: Text(
              state.error!.message,
              style: context.text.bodySmall?.copyWith(
                color: context.scheme.tertiary,
              ),
            ),
          ),
        const SizedBox(height: 4),
        Expanded(
          child: RefreshIndicator(onRefresh: notifier.refresh, child: body),
        ),
      ],
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
    final primary = context.scheme.primary;
    return Center(
      child: Material(
        color: selected ? primary : context.esn.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Esn.radius),
          side: BorderSide(color: selected ? primary : context.esn.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(
              label,
              style: context.text.labelMedium?.copyWith(
                color: selected ? context.scheme.onPrimary : context.esn.muted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RegistrationTile extends StatelessWidget {
  const _RegistrationTile({required this.registration, required this.onTap});
  final Registration registration;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = registration;
    final (label, color) = registrationBadge(context, r);
    final details = [
      money(r.amountDueMinor, r.currency),
      if (r.audience == 'STUDENT') 'student',
    ].join(' · ');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 11, 14, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      r.submissionNumber ?? 'No paper number',
                      style: context.text.bodySmall,
                    ),
                  ),
                  StatusChip(label, color),
                ],
              ),
              const SizedBox(height: 5),
              Text(
                r.paperTitle ?? 'Untitled paper',
                style: context.text.titleMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      r.billingName ??
                          r.billingEmail ??
                          'No billing details yet',
                      style: context.text.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(details, style: context.text.bodySmall),
                  if (r.isEarlyBird) ...[
                    Text(' · ', style: context.text.bodySmall),
                    Text(
                      'early bird',
                      style: context.text.bodySmall?.copyWith(
                        color: context.scheme.tertiary,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RegistrationDetailSheet extends StatelessWidget {
  const RegistrationDetailSheet({
    super.key,
    required this.registration,
    this.conferenceEarlyBirdEndsAt,
  });
  final Registration registration;
  final DateTime? conferenceEarlyBirdEndsAt;

  @override
  Widget build(BuildContext context) {
    final r = registration;
    final (label, color) = registrationBadge(context, r);
    final extended = r.earlyBirdExtendedUntil;
    final earlyBirdEnds =
        extended != null &&
            (conferenceEarlyBirdEndsAt == null ||
                extended.isAfter(conferenceEarlyBirdEndsAt!))
        ? extended
        : conferenceEarlyBirdEndsAt;

    Widget row(String name, String? value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(name, style: context.text.bodySmall),
          ),
          Expanded(
            child: Text(
              value ?? 'Not provided',
              style: value == null
                  ? context.text.bodySmall
                  : context.text.bodyMedium,
            ),
          ),
        ],
      ),
    );

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    r.submissionNumber ?? 'No paper number',
                    style: context.text.bodySmall,
                  ),
                ),
                StatusChip(label, color),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              r.paperTitle ?? 'Untitled paper',
              style: context.text.titleLarge,
            ),
            const SizedBox(height: 16),
            const Eyebrow('Fee'),
            row('Amount', money(r.amountDueMinor, r.currency)),
            row('Audience', humanize(r.audience)),
            row(
              'Rate',
              r.lockedTiming == null
                  ? 'Not locked yet'
                  : humanize(r.lockedTiming!),
            ),
            if (r.isAdditionalPaper)
              row('Paper', 'Additional paper by the same author'),
            const Divider(height: 24),
            const Eyebrow('Dates'),
            row(
              'Paid on',
              r.registeredAt == null
                  ? 'Not paid yet'
                  : shortDate(r.registeredAt),
            ),
            row('Deadline', shortDate(r.deadlineAt)),
            row(
              'Early bird ends',
              earlyBirdEnds == null
                  ? 'No early-bird rate'
                  : '${shortDate(earlyBirdEnds)}${identical(earlyBirdEnds, extended) ? ' (extended for this paper)' : ''}',
            ),
            const Divider(height: 24),
            const Eyebrow('Billing'),
            row('Name', r.billingName),
            row('Email', r.billingEmail),
            row('Affiliation', r.billingAffiliation),
            row('Country', r.billingCountry),
          ],
        ),
      ),
    );
  }
}
