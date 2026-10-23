/** Public READMEs can contain example or accidentally live credentials. Never republish them. */
export function redactReadme(markdown: string) {
  let redactions = 0;
  const patterns = [
    /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]+/g,
    /https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[A-Za-z0-9_/-]+/g,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
    /\bsk-(?:or-v1-|proj-)[A-Za-z0-9_-]{20,}\b/g,
  ];
  for (const pattern of patterns)
    markdown = markdown.replace(pattern, () => {
      redactions++;
      return "[CREDENTIAL_REDACTED]";
    });
  return { markdown, redactions };
}
