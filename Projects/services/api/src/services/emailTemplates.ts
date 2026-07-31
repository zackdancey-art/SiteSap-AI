const YEAR = new Date().getFullYear();

// Header logo. Email clients require an ABSOLUTE, publicly-hosted image URL
// (Gmail strips data: URIs and can't reach a repo file), so the real SiteSnap
// clipboard logo — the same asset the app/web login screens use — is served by
// this API at GET /assets/logo.png (see server.ts). Overridable via LOGO_URL
// for other environments; defaults to the live API host.
const LOGO_URL = process.env.LOGO_URL || "https://sitesap-ai.onrender.com/assets/logo.png";

type EmailTemplateOptions = {
  heading: string;
  bodyLines: string[];
  ctaButton?: { text: string; url: string };
  codeBlock?: string;
  noteLines?: string[];
};

export function buildEmailHtml(opts: EmailTemplateOptions): string {
  const heading = `<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F2B46;line-height:1.3;">${opts.heading}</h1>`;

  const body = opts.bodyLines
    .map((line) => `<p style="margin:0 0 12px;font-size:15px;color:#1A3D5C;line-height:1.6;">${line}</p>`)
    .join("");

  const code = opts.codeBlock
    ? `<div style="margin:20px 0;text-align:center;">
        <div style="display:inline-block;background-color:#F5F7FA;border:2px solid #DDE3EB;border-radius:12px;padding:18px 36px;">
          <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0F2B46;font-family:Courier New,Courier,monospace;">${opts.codeBlock}</div>
        </div>
      </div>`
    : "";

  const cta = opts.ctaButton
    ? `<div style="text-align:center;margin:28px 0 12px;">
        <a href="${opts.ctaButton.url}" style="display:inline-block;background-color:#E8731A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">${opts.ctaButton.text}</a>
      </div>
      <p style="margin:10px 0 0;font-size:12px;color:#6B7C93;text-align:center;">If the button doesn't work, copy this link:</p>
      <p style="margin:4px 0 0;font-size:12px;text-align:center;word-break:break-all;"><a href="${opts.ctaButton.url}" style="color:#E8731A;text-decoration:underline;">${opts.ctaButton.url}</a></p>`
    : "";

  const notes = (opts.noteLines ?? [])
    .map((line) => `<p style="margin:14px 0 0;font-size:13px;color:#6B7C93;line-height:1.5;">${line}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Opt OUT of the client's automatic dark-mode colour inversion. Without this,
     Gmail/Apple Mail lightness-invert the navy #0F2B46 header into pale
     lavender and darken the white body. Declaring the email light-only makes
     compliant clients render the authored brand colours as-is. -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  :root { color-scheme: only light; supported-color-schemes: light; }
</style>
<title>SiteSnap AI</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F5F7FA;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background-color:#0F2B46;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
            <img src="${LOGO_URL}" width="52" height="52" alt="SiteSnap AI" style="display:block;margin:0 auto 14px;border-radius:14px;" />
            <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.3px;">SiteSnap AI</div>
            <div style="color:rgba(255,255,255,0.55);font-size:12px;margin-top:4px;letter-spacing:0.2px;">Construction Site Management</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#FFFFFF;padding:36px 40px;border-left:1px solid #DDE3EB;border-right:1px solid #DDE3EB;">
            ${heading}${body}${code}${cta}${notes}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F5F7FA;border-radius:0 0 12px 12px;border:1px solid #DDE3EB;border-top:none;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9EAFC2;line-height:1.7;">
              &copy; ${YEAR} SiteSnap AI &nbsp;&middot;&nbsp;
              <a href="mailto:support@getsitesnapai.com" style="color:#9EAFC2;text-decoration:underline;">support@getsitesnapai.com</a>
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#9EAFC2;">
              You received this because you have an account with SiteSnap AI.
              Questions? Reply to this email and we'll help.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
