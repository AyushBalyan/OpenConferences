import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Palette taken from the `:root` variables of esn-press.com.
class Esn {
  static const forest = Color(0xFF155D51);
  static const forestDark = Color(0xFF0B3934);
  static const ink = Color(0xFF18211F);
  static const muted = Color(0xFF5C6764);
  static const bronze = Color(0xFF9A603D);
  static const blue = Color(0xFF316B84);
  static const soft = Color(0xFFF3F6F5);
  static const line = Color(0xFFD9DFDD);
  static const paper = Color(0xFFFFFFFF);

  // Dark counterparts, built from the site's dark hero band.
  static const darkScaffold = Color(0xFF101816);
  static const darkCard = Color(0xFF18211F);
  static const darkLine = Color(0xFF2C3A37);
  static const darkText = Color(0xFFE3ECE9);
  static const darkMuted = Color(0xFF91A49F);
  static const darkForest = Color(0xFF5FB8A6);
  static const darkBronze = Color(0xFFD29A74);
  static const darkBlue = Color(0xFF7FB6CE);
  static const eyebrowOnDark = Color(0xFF9BBAB2);

  static const radius = 4.0;
}

/// Colors that change with brightness and are not part of [ColorScheme].
@immutable
class EsnColors extends ThemeExtension<EsnColors> {
  const EsnColors({
    required this.muted,
    required this.line,
    required this.card,
  });
  final Color muted;
  final Color line;
  final Color card;

  @override
  EsnColors copyWith({Color? muted, Color? line, Color? card}) => EsnColors(
    muted: muted ?? this.muted,
    line: line ?? this.line,
    card: card ?? this.card,
  );

  @override
  EsnColors lerp(EsnColors? other, double t) => other == null
      ? this
      : EsnColors(
          muted: Color.lerp(muted, other.muted, t)!,
          line: Color.lerp(line, other.line, t)!,
          card: Color.lerp(card, other.card, t)!,
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
  final primary = dark ? Esn.darkForest : Esn.forest;

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

  TextStyle sans(
    double size,
    FontWeight weight,
    Color color, {
    double? height,
  }) {
    final base = TextStyle(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );
    return useGoogleFonts ? GoogleFonts.inter(textStyle: base) : base;
  }

  TextStyle serif(double size, Color color) {
    final base = TextStyle(
      fontSize: size,
      fontWeight: FontWeight.w600,
      color: color,
      height: 1.2,
    );
    return useGoogleFonts
        ? GoogleFonts.sourceSerif4(textStyle: base)
        : base.copyWith(fontFamily: 'serif');
  }

  final shape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(Esn.radius),
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? Esn.darkScaffold : Esn.soft,
    extensions: [EsnColors(muted: muted, line: line, card: card)],
    textTheme: TextTheme(
      headlineSmall: serif(24, onSurface),
      titleLarge: serif(20, onSurface),
      titleMedium: serif(16, onSurface),
      bodyLarge: sans(15, FontWeight.w400, onSurface, height: 1.45),
      bodyMedium: sans(14, FontWeight.w400, onSurface, height: 1.4),
      bodySmall: sans(12, FontWeight.w400, muted, height: 1.35),
      labelLarge: sans(14, FontWeight.w600, onSurface),
      labelMedium: sans(12, FontWeight.w500, onSurface),
      // The site's small uppercase section label ("OUR ROLE").
      labelSmall: sans(
        11,
        FontWeight.w700,
        primary,
      ).copyWith(letterSpacing: 1.1),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Esn.forestDark,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: serif(20, Colors.white),
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Esn.radius),
        side: BorderSide(color: line),
      ),
    ),
    dividerTheme: DividerThemeData(color: line, thickness: 1, space: 1),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: card,
      elevation: 0,
      height: 64,
      indicatorColor: primary.withValues(alpha: 0.12),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? primary : muted,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => sans(
          12,
          states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w500,
          states.contains(WidgetState.selected) ? primary : muted,
        ),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: shape,
        minimumSize: const Size.fromHeight(48),
        textStyle: sans(15, FontWeight.w600, Colors.white),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: shape,
        side: BorderSide(color: line),
        minimumSize: const Size(0, 44),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: card,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      hintStyle: sans(14, FontWeight.w400, muted),
      labelStyle: sans(14, FontWeight.w400, muted),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Esn.radius),
        borderSide: BorderSide(color: line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Esn.radius),
        borderSide: BorderSide(color: line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Esn.radius),
        borderSide: BorderSide(color: primary, width: 1.5),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: card,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(Esn.radius * 2),
        ),
      ),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: primary),
  );
}
