import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../../core/secure_store.dart';
import '../../theme/esn_theme.dart';
import '../../widgets/common.dart';

final _uuid = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key});

  @override
  ConsumerState<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends ConsumerState<SetupScreen> {
  final _form = GlobalKey<FormState>();
  final _url = TextEditingController();
  final _conference = TextEditingController();
  final _key = TextEditingController();
  bool _busy = false;
  bool _hideKey = true;
  String? _error;

  @override
  void dispose() {
    _url.dispose();
    _conference.dispose();
    _key.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    final credentials = Credentials(
      baseUrl: normalizeBaseUrl(_url.text),
      conferenceId: _conference.text.trim().toLowerCase(),
      key: _key.text.trim(),
    );
    try {
      final capabilities = await ref
          .read(apiFactoryProvider)(credentials)
          .capabilities();
      if (!capabilities.has('analytics:read') &&
          !capabilities.has('registrations:read')) {
        throw const ApiException(ApiFailure.forbidden);
      }
      await ref.read(credentialsProvider.notifier).save(credentials);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(
        () => _error = e.kind == ApiFailure.forbidden
            ? 'This key needs the analytics or registrations permission. Issue a new key with them.'
            : e.message,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// A borderless field for use inside the grouped card.
  InputDecoration _field(String label, String hint, {Widget? suffix}) =>
      InputDecoration(
        labelText: label,
        hintText: hint,
        filled: false,
        border: InputBorder.none,
        contentPadding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        suffixIcon: suffix,
      );

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.paddingOf(context);
    return Scaffold(
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          20,
          insets.top + 44,
          20,
          insets.bottom + 24,
        ),
        children: [
          const Center(child: BrandMark(size: 92)),
          const SizedBox(height: 18),
          Text(
            'ConfKit',
            textAlign: TextAlign.center,
            style: context.text.displaySmall,
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Connect a read-only key to follow submissions, reviews and registrations.',
              textAlign: TextAlign.center,
              style: context.text.bodyMedium?.copyWith(
                color: context.esn.muted,
              ),
            ),
          ),
          const SizedBox(height: 30),
          Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Panel(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _url,
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                        textInputAction: TextInputAction.next,
                        decoration: _field(
                          'API address',
                          'api.yourconference.org',
                        ),
                        validator: (v) => (v ?? '').trim().isEmpty
                            ? 'Enter the API address'
                            : null,
                      ),
                      const Divider(indent: 16),
                      TextFormField(
                        controller: _conference,
                        autocorrect: false,
                        textInputAction: TextInputAction.next,
                        decoration: _field(
                          'Conference ID',
                          '3f2a9c1e-5b7d-4e8f-9a1b-2c3d4e5f6a7b',
                        ),
                        validator: (v) => _uuid.hasMatch((v ?? '').trim())
                            ? null
                            : 'Paste the conference ID from the dashboard address',
                      ),
                      const Divider(indent: 16),
                      TextFormField(
                        controller: _key,
                        obscureText: _hideKey,
                        autocorrect: false,
                        enableSuggestions: false,
                        decoration: _field(
                          'API key',
                          'ocbot_v1.…',
                          suffix: IconButton(
                            tooltip: _hideKey ? 'Show key' : 'Hide key',
                            icon: Icon(
                              _hideKey
                                  ? CupertinoIcons.eye_fill
                                  : CupertinoIcons.eye_slash_fill,
                              size: 20,
                              color: context.esn.muted,
                            ),
                            onPressed: () =>
                                setState(() => _hideKey = !_hideKey),
                          ),
                        ),
                        validator: (v) =>
                            (v ?? '').trim().startsWith('ocbot_v1.')
                            ? null
                            : 'Keys start with ocbot_v1.',
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Text(
                      _error!,
                      style: context.text.bodyMedium?.copyWith(
                        color: context.scheme.error,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: _busy ? null : _connect,
                  child: _busy
                      ? const CupertinoActivityIndicator(color: Colors.white)
                      : const Text('Connect'),
                ),
                const SizedBox(height: 18),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Text(
                    'Create the key in the web dashboard under Settings, Integrations. '
                    'Give it the analytics, revenue and registrations permissions. '
                    'It is stored only on this phone.',
                    textAlign: TextAlign.center,
                    style: context.text.bodySmall,
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
