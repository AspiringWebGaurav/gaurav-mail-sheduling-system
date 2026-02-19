/**
 * Enterprise Minimal HTML Email Template for GMSS.
 * Focus: Clarity, Authority, Structure.
 */

import { EmailThemeColors } from './emailTemplateRenderer';

export interface InviteEmailParams {
    inviterName: string;
    eventTitle: string;
    eventTime: string;
    eventLocation?: string;
    inviteLink: string;
    role: string;
    headerText?: string;
    buttonText?: string;
    expiryText?: string;
}

export function renderInviteEmail(params: InviteEmailParams): string {
    const {
        inviterName,
        eventTitle,
        eventTime,
        eventLocation,
        inviteLink,
        role,
        headerText = "Event Invitation",
        buttonText = "Accept Invitation",
        expiryText = "This link is valid for 10 hours"
    } = params;

    // Ensure production links
    let baseUrl = 'https://gmss.app';
    try {
        baseUrl = new URL(inviteLink).origin;
    } catch (e) {
        // Fallback for relative or invalid URLs
        if (inviteLink.includes('localhost')) {
            baseUrl = 'http://localhost:3000';
        }
    }

    // Colors
    const c = {
        bg: '#000000',           // Pure Black Body
        contentBg: '#09090b',
        text: '#ffffff',
        muted: '#a1a1aa',
        highlight: '#c084fc',    // Bright Purple for dynamic data
        accentGradient: 'linear-gradient(90deg, #6c5ce7 0%, #ff0080 100%)',
        border: '#1f1f22',
        footerBg: '#0e0e11'
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(headerText)}</title>
    <style>
        /* Desktop defaults */
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${c.text}; background-color: ${c.bg}; }
        
        /* Mobile overrides */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; max-width: 100% !important; }
            .content-padding { padding-left: 20px !important; padding-right: 20px !important; }
            .mobile-font-lg { font-size: 28px !important; line-height: 1.2 !important; }
            .mobile-font-md { font-size: 16px !important; line-height: 1.6 !important; }
            .mobile-block { display: block !important; width: 100% !important; }
            .mobile-hide { display: none !important; }
            .spacer-sm { height: 24px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${c.bg};">
    
    <!-- Outlook Wrapper -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${c.bg}; width: 100%;">
        <tr>
            <td align="center">
                
                <!-- Main Content (Centered) -->
                <table class="container" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; margin: 0 auto;">
                    
                    <!-- SPACER -->
                    <tr><td height="24" class="spacer-sm"></td></tr>

                    <!-- LOGO HEADER -->
                    <tr>
                        <td align="left" class="content-padding" style="padding: 0 24px 20px 24px;">
                            <div style="font-size: 20px; font-weight: 800; color: ${c.text}; letter-spacing: -1px; display: inline-block;">
                                GMSS<span style="color: #6c5ce7;">.</span>
                            </div>
                        </td>
                    </tr>

                    <!-- HERO SECTION -->
                    <tr>
                        <td align="left" class="content-padding" style="padding: 0 24px;">
                            <h1 class="mobile-font-lg" style="margin: 0 0 12px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; color: ${c.text};">
                                ${escapeHtml(eventTitle)}
                            </h1>
                            <p class="mobile-font-md" style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${c.muted};">
                                <strong style="color: ${c.highlight};">${escapeHtml(inviterName)}</strong> has invited you to collaborate.
                            </p>
                        </td>
                    </tr>

                    <!-- DETAILS GRID (Clean Vertical) -->
                    <tr>
                        <td align="left" class="content-padding" style="padding: 0 24px 24px 24px;">
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="padding-bottom: 20px; border-left: 2px solid ${c.border}; padding-left: 16px;">
                                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${c.muted}; margin-bottom: 4px; letter-spacing: 0.5px;">Time</div>
                                        <div style="font-size: 15px; font-weight: 600; color: ${c.highlight};">${escapeHtml(eventTime)}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 20px; border-left: 2px solid ${c.border}; padding-left: 16px;">
                                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${c.muted}; margin-bottom: 4px; letter-spacing: 0.5px;">Role</div>
                                        <div style="font-size: 15px; font-weight: 600; color: ${c.highlight}; text-transform: capitalize;">${escapeHtml(role)}</div>
                                    </td>
                                </tr>
                                ${eventLocation ? `
                                <tr>
                                    <td style="border-left: 2px solid ${c.border}; padding-left: 16px;">
                                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${c.muted}; margin-bottom: 4px; letter-spacing: 0.5px;">Location</div>
                                        <div style="font-size: 15px; font-weight: 600; color: ${c.highlight};">${escapeHtml(eventLocation)}</div>
                                    </td>
                                </tr>` : ''}
                            </table>
                        </td>
                    </tr>

                    <!-- ACTION BUTTON -->
                    <tr>
                        <td align="left" class="content-padding" style="padding: 0 24px 32px 24px;">
                            <a href="${escapeHtml(inviteLink)}" target="_blank" class="mobile-block" style="background: ${c.accentGradient}; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 99px; display: inline-block; box-shadow: 0 10px 20px -10px rgba(108, 92, 231, 0.5); text-align: center;">
                                ${escapeHtml(buttonText)} &rarr;
                            </a>
                            <div style="margin-top: 12px; font-size: 12px; color: #52525b;">
                                ${escapeHtml(expiryText)}
                            </div>
                        </td>
                    </tr>

                </table>

                <!-- COMPACT FOOTER -->
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${c.footerBg}; border-top: 1px solid ${c.border};">
                    <tr>
                        <td align="center" class="content-padding" style="padding: 24px 24px;">
                            
                            <!-- GRADIENT BRAND + Personal Branding -->
                            <div style="margin-bottom: 16px;">
                                <span style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px; background: ${c.accentGradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #6c5ce7; margin-right: 12px;">
                                    GMSS PRO
                                </span>
                                <span class="mobile-block" style="font-size: 13px; color: ${c.muted}; font-weight: 500;">
                                    Made by Gaurav for Gaurav.
                                </span>
                            </div>

                            <!-- Links & Copyright -->
                            <div style="font-size: 12px; color: #52525b;">
                                <a href="${baseUrl}/terms" target="_blank" style="color: ${c.muted}; text-decoration: none; margin: 0 8px;">Terms</a>
                                <span style="color: ${c.border};">&bull;</span>
                                <a href="${baseUrl}/privacy" target="_blank" style="color: ${c.muted}; text-decoration: none; margin: 0 8px;">Privacy</a>
                                <span style="color: ${c.border};">&bull;</span>
                                <a href="${baseUrl}/license" target="_blank" style="color: ${c.muted}; text-decoration: none; margin: 0 8px;">License</a>
                                <span class="mobile-hide" style="color: ${c.border};">&bull;</span>
                                <span class="mobile-block" style="color: #52525b; margin-left: 8px;">&copy; ${new Date().getFullYear()} GMSS</span>
                            </div>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>
</html>`;
}

export function renderInviteEmailText(params: InviteEmailParams): string {
    const {
        inviterName,
        eventTitle,
        eventTime,
        inviteLink,
        role
    } = params;

    return `EVENT INVITATION

${eventTitle}

${inviterName} has invited you to join this session.

DETAILS
Date & Time: ${eventTime}
Role: ${role}

ACCEPT INVITATION
${inviteLink}

(Link expires in 10 hours)

--------------------------------------------------
GMSS | Terms | Privacy | License
`;
}

export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
