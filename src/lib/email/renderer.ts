type EmailVars = Record<string, string>;

/**
 * Replace {{variable}} placeholders with actual values.
 */
export function interpolate(text: string, vars: EmailVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Render email HTML stored from Unlayer with variable substitution.
 */
export function renderEmailHtml(html: string, vars: EmailVars): string {
  return interpolate(html, vars);
}

/**
 * Interpolate subject line with variables.
 */
export function renderSubject(subject: string, vars: EmailVars): string {
  return interpolate(subject, vars);
}
