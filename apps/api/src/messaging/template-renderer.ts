const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    if (!(key in context)) {
      return '';
    }
    return escapeHtml(context[key]);
  });
}

export function extractTemplateVariables(template: string): string[] {
  const keys = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    keys.add(match[1]!);
  }
  return [...keys];
}

export function validateTemplateVariables(
  declared: string[],
  subject: string,
  bodyHtml: string,
): void {
  const used = new Set([
    ...extractTemplateVariables(subject),
    ...extractTemplateVariables(bodyHtml),
  ]);

  const declaredSet = new Set(declared);
  for (const key of used) {
    if (!declaredSet.has(key)) {
      throw new Error(`Template uses undeclared variable: ${key}`);
    }
  }
}
