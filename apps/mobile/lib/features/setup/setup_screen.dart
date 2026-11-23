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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        top: false,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Container(
              color: Esn.forestDark,
              padding: EdgeInsets.fromLTRB(
                20,
                MediaQuery.paddingOf(context).top + 36,
                20,
                28,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const BrandMark(size: 64),
                  const SizedBox(height: 18),
                  const Eyebrow('OpenConferences', color: Esn.eyebrowOnDark),
                  const SizedBox(height: 8),
                  Text(
                    'ConfKit',
                    style: context.text.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontSize: 30,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Connect a read-only key to follow submissions, reviews and registrations.',
                    style: context.text.bodyMedium?.copyWith(
                      color: const Color(0xFFDCE9E5),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _url,
                      keyboardType: TextInputType.url,
                      autocorrect: false,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'API address',
                        hintText: 'api.yourconference.org',
                      ),
                      validator: (v) => (v ?? '').trim().isEmpty
                          ? 'Enter the API address'
                          : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _conference,
                      autocorrect: false,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Conference ID',
                        hintText: '3f2a9c1e-5b7d-4e8f-9a1b-2c3d4e5f6a7b',
                      ),
                      validator: (v) => _uuid.hasMatch((v ?? '').trim())
                          ? null
                          : 'Paste the conference ID from the dashboard address',
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _key,
                      obscureText: _hideKey,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: 'API key',
                        hintText: 'ocbot_v1.…',
                        suffixIcon: IconButton(
                          tooltip: _hideKey ? 'Show key' : 'Hide key',
                          icon: Icon(
                            _hideKey
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () => setState(() => _hideKey = !_hideKey),
                        ),
                      ),
                      validator: (v) => (v ?? '').trim().startsWith('ocbot_v1.')
                          ? null
                          : 'Keys start with ocbot_v1.',
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        _error!,
                        style: context.text.bodyMedium?.copyWith(
                          color: context.scheme.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _busy ? null : _connect,
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Connect'),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Create the key in the web dashboard under Settings, Integrations. '
                      'Give it the analytics, revenue and registrations permissions. '
                      'It is stored only on this phone.',
                      style: context.text.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
