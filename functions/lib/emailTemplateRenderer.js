"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderEmailTemplate = renderEmailTemplate;
/**
 * GMSS Email Template Renderer — Server-side (Cloud Functions)
 * Generates complete HTML email strings for 4 layout types.
 */
const brandingFooter_1 = require("./lib/emailSystem/brandingFooter");
const DEFAULT_THEME = {
    primaryColor: "#6c5ce7",
    secondaryColor: "#00d2ff",
    backgroundColor: "#ffffff",
    textColor: "#1a1a2e",
    borderRadius: 12,
};
const DEFAULT_DATA = {
    eventTitle: "Event Reminder",
    eventTime: "Tomorrow at 10:00 AM",
    headerText: "Upcoming Event",
    timeLabel: "WHEN",
    locationLabel: "WHERE",
    message: "This is a reminder for your upcoming event.",
};
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function wrap(body, bgColor) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>GMSS Notification</title></head>
<body style="margin:0;padding:0;background:${bgColor};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${body}
</body></html>`;
}
function renderMinimal(d, t) {
    const header = d.headerText || "Event Reminder";
    const timeLbl = d.timeLabel || "When";
    const locLbl = d.locationLabel || "Where";
    return wrap(`
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;padding:32px;">
  <tr><td>
    <div style="border-left:4px solid ${t.primaryColor};padding-left:20px;margin-bottom:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;color:${t.textColor};font-weight:600;">📅 ${esc(d.eventTitle)}</h1>
      <p style="margin:0;font-size:14px;color:${t.textColor};opacity:0.6;">${esc(header)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:${t.textColor};opacity:0.5;width:80px;">${esc(timeLbl)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${t.textColor};font-weight:500;">${esc(d.eventTime)}</td></tr>
      ${d.eventLocation ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:${t.textColor};opacity:0.5;width:80px;">${esc(locLbl)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:${t.textColor};font-weight:500;">${esc(d.eventLocation)}</td></tr>` : ""}
    </table>
    ${d.message ? `<p style="margin:0 0 24px;font-size:14px;color:${t.textColor};line-height:1.6;opacity:0.8;">${esc(d.message)}</p>` : ""}
    
    ${(0, brandingFooter_1.renderBrandingFooter)(t)}
  </td></tr>
</table>`, "#f8f9fa");
}
function renderCard(d, t) {
    const header = d.headerText || "Upcoming Event";
    const timeLbl = d.timeLabel || "WHEN";
    const locLbl = d.locationLabel || "WHERE";
    return wrap(`
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;">
  <tr><td>
    <div style="background:${t.backgroundColor};border-radius:${t.borderRadius}px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,${t.primaryColor},${t.secondaryColor});padding:28px 32px;">
        <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;">${esc(header)}</p>
        <h1 style="margin:0;font-size:22px;color:#fff;font-weight:700;">${esc(d.eventTitle)}</h1>
      </div>
      <div style="padding:28px 32px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:10px;background:${t.primaryColor}15;border-radius:8px;"><p style="margin:0 0 2px;font-size:11px;color:${t.textColor};opacity:0.5;text-transform:uppercase;">${esc(timeLbl)}</p><p style="margin:0;font-size:14px;color:${t.textColor};font-weight:600;">${esc(d.eventTime)}</p></td>
          ${d.eventLocation ? `<td style="padding:10px;background:${t.primaryColor}15;border-radius:8px;"><p style="margin:0 0 2px;font-size:11px;color:${t.textColor};opacity:0.5;text-transform:uppercase;">${esc(locLbl)}</p><p style="margin:0;font-size:14px;color:${t.textColor};font-weight:600;">${esc(d.eventLocation)}</p></td>` : ""}</tr>
        </table>
        ${d.message ? `<p style="margin:0 0 20px;font-size:14px;color:${t.textColor};line-height:1.6;opacity:0.85;">${esc(d.message)}</p>` : ""}
        
        ${(0, brandingFooter_1.renderBrandingFooter)(t)}
      </div>
    </div>
  </td></tr>
</table>`, "#f0f0f5");
}
function renderBanner(d, t) {
    const header = d.headerText || "Reminder";
    const timeLbl = d.timeLabel || "WHEN"; // Not strictly used in banner but good to have
    const locLbl = d.locationLabel || "Location:";
    return wrap(`
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
  <tr><td>
    <div style="background:linear-gradient(135deg,${t.primaryColor} 0%,${t.secondaryColor} 50%,${t.primaryColor} 100%);padding:48px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.8);letter-spacing:2px;text-transform:uppercase;">${esc(header)}</p>
      <h1 style="margin:0 0 12px;font-size:28px;color:#fff;font-weight:800;">${esc(d.eventTitle)}</h1>
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:20px;padding:8px 20px;">
        <span style="font-size:14px;color:#fff;font-weight:500;">${esc(d.eventTime)}</span></div>
    </div>
    <div style="background:${t.backgroundColor};padding:32px 40px;">
      ${d.eventLocation ? `<div style="margin-bottom:16px;padding:14px 18px;background:#f8f9fa;border-radius:8px;border-left:3px solid ${t.primaryColor};"><p style="margin:0;font-size:13px;color:${t.textColor};"><strong>${esc(locLbl)}</strong> ${esc(d.eventLocation)}</p></div>` : ""}
      ${d.message ? `<p style="margin:0 0 20px;font-size:15px;color:${t.textColor};line-height:1.7;">${esc(d.message)}</p>` : ""}
      ${d.recipientName ? `<p style="margin:0;font-size:14px;color:${t.textColor};">Hello <strong>${esc(d.recipientName)}</strong>! 👋</p>` : ""}
    </div>
    
    <div style="background:#f8f9fa;padding:0 40px 16px;">
        ${(0, brandingFooter_1.renderBrandingFooter)(t)}
    </div>
  </td></tr>
</table>`, "#e8e8ec");
}
function renderElegant(d, t) {
    const header = d.headerText || "Event Reminder";
    const timeLbl = d.timeLabel || "Date & Time";
    const locLbl = d.locationLabel || "Location";
    return wrap(`
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:40px auto;">
  <tr><td>
    <div style="background:${t.backgroundColor};border:1px solid #e0d9cf;border-radius:${t.borderRadius}px;overflow:hidden;">
      <div style="height:4px;background:linear-gradient(90deg,${t.primaryColor},${t.secondaryColor},${t.primaryColor});"></div>
      <div style="padding:40px 36px;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;color:${t.primaryColor};text-transform:uppercase;letter-spacing:3px;font-weight:600;">${esc(header)}</p>
        <h1 style="margin:0 0 20px;font-size:24px;color:${t.textColor};font-family:Georgia,serif;font-weight:400;font-style:italic;">${esc(d.eventTitle)}</h1>
        <div style="width:40px;height:1px;background:${t.primaryColor};margin:0 auto 20px;"></div>
        <table style="margin:0 auto 24px;border-collapse:collapse;">
          <tr><td style="padding:8px 16px;text-align:right;font-size:12px;color:${t.textColor};opacity:0.5;font-family:Georgia,serif;">${esc(timeLbl)}</td>
          <td style="padding:8px 16px;text-align:left;font-size:14px;color:${t.textColor};font-family:Georgia,serif;">${esc(d.eventTime)}</td></tr>
          ${d.eventLocation ? `<tr><td style="padding:8px 16px;text-align:right;font-size:12px;color:${t.textColor};opacity:0.5;font-family:Georgia,serif;">${esc(locLbl)}</td>
          <td style="padding:8px 16px;text-align:left;font-size:14px;color:${t.textColor};font-family:Georgia,serif;">${esc(d.eventLocation)}</td></tr>` : ""}
        </table>
        ${d.message ? `<p style="margin:0 0 24px;font-size:14px;color:${t.textColor};line-height:1.8;font-family:Georgia,serif;opacity:0.85;">${esc(d.message)}</p>` : ""}
        ${d.recipientName ? `<p style="margin:0;font-size:14px;color:${t.textColor};font-family:Georgia,serif;">Warm regards,</p>` : ""}
      </div>
      
      <div style="padding:0 36px 14px;background:#faf9f7;border-top:1px solid #e0d9cf;">
        ${(0, brandingFooter_1.renderBrandingFooter)(t)}
      </div>
    </div>
  </td></tr>
</table>`, "#f5f3ef");
}
function renderEmailTemplate(layout, data, theme) {
    const d = { ...DEFAULT_DATA, ...data };
    const t = { ...DEFAULT_THEME, ...theme };
    switch (layout) {
        case "minimal": return renderMinimal(d, t);
        case "card": return renderCard(d, t);
        case "banner": return renderBanner(d, t);
        case "elegant": return renderElegant(d, t);
        default: return renderCard(d, t);
    }
}
//# sourceMappingURL=emailTemplateRenderer.js.map