"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderBrandingFooter = renderBrandingFooter;
function renderBrandingFooter(theme) {
    const year = new Date().getFullYear();
    const { primaryColor, textColor } = theme;
    // Ensure we have a valid color for the footer text, defaulting to a muted version of the text color
    const footerTextColor = textColor ? `${textColor}99` : '#666666';
    const linkColor = primaryColor || '#6c5ce7';
    return `
    <!-- ───────────────────────────────────────────────────────────── -->
    <!-- BRANDING FOOTER (STATIC & CONTROLLED) -->
    <!-- ───────────────────────────────────────────────────────────── -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 40px; border-top: 1px solid rgba(0,0,0,0.05);">
        <tr>
            <td style="padding: 32px 20px; text-align: center;">
                <!-- Logo / Brand Name -->
                <p style="margin: 0 0 12px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 700; font-size: 14px; color: ${textColor}; letter-spacing: 1px;">
                    GMSS
                </p>
                
                <!-- Links -->
                <p style="margin: 0 0 16px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: ${footerTextColor}; line-height: 1.8;">
                    <a href="https://www.gauravpatil.online" target="_blank" style="color: ${footerTextColor}; text-decoration: none; font-weight: 500; transition: color 0.2s;">Gaurav's Portfolio</a>
                    <span style="display: inline-block; margin: 0 8px; color: ${footerTextColor}; opacity: 0.3;">|</span>
                    <a href="https://www.gauravworkspace.site" target="_blank" style="color: ${footerTextColor}; text-decoration: none; font-weight: 500; transition: color 0.2s;">Gaurav's Workspace</a>
                </p>

                <!-- Copyright -->
                <p style="margin: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: ${footerTextColor}; opacity: 0.6;">
                    &copy; ${year} All Rights Reserved.
                </p>
            </td>
        </tr>
    </table>
    `;
}
//# sourceMappingURL=brandingFooter.js.map