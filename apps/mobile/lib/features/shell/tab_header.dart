import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';

Future<void> confirmDisconnect(BuildContext context, WidgetRef ref) async {
  final yes = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Disconnect this phone?'),
      content: const Text(
        'The key is removed from this phone. It keeps working elsewhere until you revoke it in the dashboard.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: context.scheme.error),
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Disconnect'),
        ),
      ],
    ),
  );
  if (yes == true) await ref.read(credentialsProvider.notifier).disconnect();
}

/// The large title at the top of each tab, with the conference above it.
class TabHeader extends ConsumerWidget {
  const TabHeader({super.key, required this.title});
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(capabilitiesProvider).value?.conferenceName;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 10, 0, 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const BrandMark(size: 20),
                    const SizedBox(width: 7),
                    Flexible(
                      child: Text(
                        name ?? 'ConfKit',
                        style: context.text.labelMedium?.copyWith(
                          color: context.esn.muted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(title, style: context.text.displaySmall),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Material(
              color: context.esn.fill,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: IconButton(
                tooltip: 'Disconnect',
                constraints: const BoxConstraints.tightFor(
                  width: 40,
                  height: 40,
                ),
                padding: EdgeInsets.zero,
                icon: Icon(
                  CupertinoIcons.square_arrow_right,
                  size: 19,
                  color: context.scheme.onSurface,
                ),
                onPressed: () => confirmDisconnect(context, ref),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
