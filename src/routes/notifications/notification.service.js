const prisma = require("../../config/prisma");
const config = require("../../config");
const transporter = require("../../config/mail");

const FROM_ADDRESS = config.smtp.user;

function formatMeetingTime(meeting) {
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    const dateStr = start.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const startStr = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const endStr = end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr}, ${startStr} - ${endStr}`;
}

function meetingDetailsTable(meeting) {
    return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 6px 0; color: #888; width: 110px;">Title</td><td style="padding: 6px 0;">${meeting.title}</td></tr>
      <tr><td style="padding: 6px 0; color: #888;">When</td><td style="padding: 6px 0;">${formatMeetingTime(meeting)}</td></tr>
      ${meeting.location ? `<tr><td style="padding: 6px 0; color: #888;">Location</td><td style="padding: 6px 0;">${meeting.location}</td></tr>` : ""}
      ${meeting.meetingUrl ? `<tr><td style="padding: 6px 0; color: #888;">Join link</td><td style="padding: 6px 0;"><a href="${meeting.meetingUrl}">${meeting.meetingUrl}</a></td></tr>` : ""}
      <tr><td style="padding: 6px 0; color: #888;">Organizer</td><td style="padding: 6px 0;">${meeting.organizer?.name || meeting.organizer?.email || "—"}</td></tr>
    </table>
  `;
}

function emailShell({ heading, intro, meeting, footerNote }) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">${heading}</h2>
      <p style="color: #555;">${intro}</p>
      ${meetingDetailsTable(meeting)}
      ${meeting.description ? `<p style="color: #333;">${meeting.description}</p>` : ""}
      ${footerNote ? `<p style="color: #999; font-size: 13px; margin-top: 24px;">${footerNote}</p>` : ""}
    </div>
  `;
}

async function sendMail({ to, subject, html }) {
    try {
        await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
    } catch (err) {
        console.error(`[notification] Failed to email ${to}:`, err.message);
    }
}

async function recordNotifications({ recipients, meetingId, title, message, type }) {
    if (!recipients.length) return;
    try {
        await prisma.notification.createMany({
            data: recipients.map((r) => ({ userId: r.id, meetingId, title, message, type })),
        });
    } catch (err) {
        console.error("[notification] Failed to record notifications:", err.message);
    }
}

/**
 * recipients: [{ id, name, email }]
 * These three are the only exports meant to be called from outside —
 * safeNotify wraps them so callers never need their own try/catch.
 */

async function notifyInvitation({ meeting, recipients }) {
    if (!recipients?.length) return;

    await Promise.all(
        recipients.map((r) =>
            sendMail({
                to: r.email,
                subject: `Invitation: ${meeting.title}`,
                html: emailShell({
                    heading: "You're invited to a meeting",
                    intro: `${meeting.organizer?.name || meeting.organizer?.email || "Someone"} invited you to a meeting.`,
                    meeting,
                }),
            })
        )
    );

    await recordNotifications({
        recipients,
        meetingId: meeting.id,
        title: `Invitation: ${meeting.title}`,
        message: `You have been invited to "${meeting.title}".`,
        type: "INVITATION",
    });
}

async function notifyUpdate({ meeting, recipients }) {
    if (!recipients?.length) return;

    await Promise.all(
        recipients.map((r) =>
            sendMail({
                to: r.email,
                subject: `Updated: ${meeting.title}`,
                html: emailShell({
                    heading: "Meeting updated",
                    intro: `Details for "${meeting.title}" have changed.`,
                    meeting,
                    footerNote: "Please review the updated time and details.",
                }),
            })
        )
    );

    await recordNotifications({
        recipients,
        meetingId: meeting.id,
        title: `Updated: ${meeting.title}`,
        message: `"${meeting.title}" has been updated.`,
        type: "UPDATE",
    });
}

async function notifyCancellation({ meeting, recipients }) {
    if (!recipients?.length) return;

    await Promise.all(
        recipients.map((r) =>
            sendMail({
                to: r.email,
                subject: `Cancelled: ${meeting.title}`,
                html: emailShell({
                    heading: "Meeting cancelled",
                    intro: `"${meeting.title}" has been cancelled.`,
                    meeting,
                }),
            })
        )
    );

    await recordNotifications({
        recipients,
        meetingId: meeting.id,
        title: `Cancelled: ${meeting.title}`,
        message: `"${meeting.title}" has been cancelled.`,
        type: "CANCELLED",
    });
}

async function notifyReminder({ meeting, recipients }) {
    if (!recipients?.length) return;

    await Promise.all(
        recipients.map((r) =>
            sendMail({
                to: r.email,
                subject: `Starting soon: ${meeting.title}`,
                html: emailShell({
                    heading: "Meeting starting soon",
                    intro: `"${meeting.title}" starts in about 15 minutes.`,
                    meeting,
                }),
            })
        )
    );

    await recordNotifications({
        recipients,
        meetingId: meeting.id,
        title: `Starting soon: ${meeting.title}`,
        message: `"${meeting.title}" starts in about 15 minutes.`,
        type: "REMINDER",
    });
}

/**
 * Runs a notify* function but swallows any error so a notification
 * failure (bad SMTP creds, network blip) never fails the calling
 * meeting create/update/delete operation. Errors are logged only.
 */
async function safeNotify(fn, args) {
    try {
        await fn(args);
    } catch (err) {
        console.error(`[notification] ${fn.name} failed:`, err.message);
    }
}

module.exports = {
    notifyInvitation,
    notifyUpdate,
    notifyCancellation,
    notifyReminder,
    safeNotify,
};