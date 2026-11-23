import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// The ConfKit palette: the brand greens on soft, grouped system surfaces.
class Esn {
  // Brand.
  static const forest = Color(0xFF155D51);
  static const forestDark = Color(0xFF0B3934);
  static const cover = Color(0xFF04463F);
  static const bronze = Color(0xFF9A603D);
  static const blue = Color(0xFF316B84);

  // Light surfaces and text.
  static const ink = Color(0xFF111816);
  static const muted = Color(0xFF6B7572);
  static const soft = Color(0xFFF2F4F3);
  static const paper = Color(0xFFFFFFFF);
  static const line = Color(0xFFE4E8E6);
  static const fill = Color(0xFFE8ECEA);

  // Dark surfaces and text.
  static const darkScaffold = Color(0xFF060A09);
  static const darkCard = Color(0xFF161C1A);
  static const darkLine = Color(0xFF28312F);
  static const darkFill = Color(0xFF222A28);
  static const darkText = Color(0xFFF2F5F4);
  static const darkMuted = Color(0xFF98A29F);
  static const darkForest = Color(0xFF5FB8A6);
  static const darkBronze = Color(0xFFD29A74);
  static const darkBlue = Color(0xFF7FB6CE);

  // Corner radii. Shapes are superellipses, so these read softer than circles.
  static const cardRadius = 24.0;
  static const tileRadius = 20.0;
  static const controlRadius = 14.0;
}

/// A continuous-corner ("squircle") shape.
OutlinedBorder squircle(double radius, {BorderSide side = BorderSide.none}) =>
    RoundedSuperellipseBorder(
      borderRadius: BorderRadius.circular(radius),
      side: side,
    );

/// Colors that change with brightness and are not part of [ColorScheme].
@immutable
class EsnColors extends ThemeExtension<EsnColors> {
  const EsnColors({
    required this.muted,
    required this.line,
    required this.card,
    required this.fill,
  });
  final Color muted;
  final Color line;
  final Color card;

  /// Background of quiet controls: search field, unselected chips, tracks.
  final Color fill;

  @override
  EsnColors copyWith({Color? muted, Color? line, Color? card, Color? fill}) =>
      EsnColors(
        muted: muted ?? this.muted,
        line: line ?? this.line,
        card: card ?? this.card,
        fill: fill ?? this.fill,
      );

  @override
  EsnColors lerp(EsnColors? other, double t) => other == null
      ? this
      : EsnColors(
          muted: Color.lerp(muted, other.muted, t)!,
          line: Color.lerp(line, other.line, t)!,
          card: Color.lerp(card, other.card, t)!,
          fill: Color.lerp(fill, other.fill, t)!,
        );
}

extension EsnContext on BuildContext {
  EsnColors get esn => Theme.of(this).extension<EsnColors>()!;
  ColorScheme get scheme => Theme.of(this).colorScheme;
  TextTheme get text => Theme.of(this).textTheme;
}

/// [useGoogleFonts] is off in tests, where fonts cannot be downloaded.
ThemeData esnTheme(Brightness brightness, {bool useGoogleFonts = true}) {
  final dark = brightness == Brightness.dark;
  final onSurface = dark ? Esn.darkText : Esn.ink;
  final muted = dark ? Esn.darkMuted : Esn.muted;
  final line = dark ? Esn.darkLine : Esn.line;
  final card = dark ? Esn.darkCard : Esn.paper;
  final fill = dark ? Esn.darkFill : Esn.fill;
  final primary = dark ? Esn.darkForest : Esn.forest;
  final scaffold = dark ? Esn.darkScaffold : Esn.soft;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: primary,
    onPrimary: dark ? Esn.forestDark : Colors.white,
    primaryContainer: Esn.forestDark,
    onPrimaryContainer: Colors.white,
    secondary: dark ? Esn.darkBlue : Esn.blue,
    onSecondary: Colors.white,
    tertiary: dark ? Esn.darkBronze : Esn.bronze,
    onTertiary: Colors.white,
    error: dark ? Esn.darkBronze : Esn.bronze,
    onError: Colors.white,
    surface: card,
    onSurface: onSurface,
    onSurfaceVariant: muted,
    outline: line,
    outlineVariant: line,
  );

  TextStyle type(
    double size,
    FontWeight weight,
    Color color, {
    double? height,
    double spacing = 0,
  }) {
    final base = TextStyle(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: spacing,
    );
    return useGoogleFonts ? GoogleFonts.inter(textStyle: base) : base;
  }

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: scaffold,
    splashFactory: NoSplash.splashFactory,
    highlightColor: onSurface.withValues(alpha: 0.06),
    extensions: [EsnColors(muted: muted, line: line, card: card, fill: fill)],
    textTheme: TextTheme(
      displaySmall: type(34, FontWeight.w700, onSurface, spacing: -0.9),
      headlineSmall: type(28, FontWeight.w700, onSurface, spacing: -0.7),
      titleLarge: type(22, FontWeight.w700, onSurface, spacing: -0.5),
      titleMedium: type(
        16,
        FontWeight.w600,
        onSurface,
        height: 1.25,
        spacing: -0.3,
      ),
      bodyLarge: type(
        17,
        FontWeight.w400,
        onSurface,
        height: 1.4,
        spacing: -0.3,
      ),
      bodyMedium: type(
        15,
        FontWeight.w400,
        onSurface,
        height: 1.35,
        spacing: -0.2,
      ),
      bodySmall: type(13, FontWeight.w400, muted, height: 1.35, spacing: -0.1),
      labelLarge: type(15, FontWeight.w600, onSurface, spacing: -0.2),
      labelMedium: type(13, FontWeight.w600, onSurface, spacing: -0.1),
      // Grouped-list section label.
      labelSmall: type(12, FontWeight.w600, muted, spacing: 0.4),
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: squircle(Esn.cardRadius),
    ),
    dividerTheme: DividerThemeData(color: line, thickness: 0.7, space: 0.7),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: squircle(18),
        minimumSize: const Size.fromHeight(54),
        elevation: 0,
        textStyle: type(17, FontWeight.w600, Colors.white, spacing: -0.3),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: const StadiumBorder(),
        textStyle: type(16, FontWeight.w600, primary, spacing: -0.2),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: fill,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      hintStyle: type(16, FontWeight.w400, muted, spacing: -0.2),
      labelStyle: type(16, FontWeight.w400, muted, spacing: -0.2),
      floatingLabelStyle: type(13, FontWeight.w500, muted),
      errorStyle: type(12, FontWeight.w500, scheme.error),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Esn.controlRadius),
        borderSide: BorderSide.none,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: card,
      surfaceTintColor: Colors.transparent,
      shape: squircle(28),
      titleTextStyle: type(20, FontWeight.w700, onSurface, spacing: -0.4),
      contentTextStyle: type(15, FontWeight.w400, muted, height: 1.4),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: card,
      surfaceTintColor: Colors.transparent,
      elevation: 12,
      shadowColor: Colors.black.withValues(alpha: 0.25),
      shape: squircle(18),
      textStyle: type(15, FontWeight.w500, onSurface, spacing: -0.2),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scaffold,
      surfaceTintColor: Colors.transparent,
      dragHandleColor: muted.withValues(alpha: 0.4),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: primary),
  );
}
