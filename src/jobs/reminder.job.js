const cron = require("node-cron");
const prisma = require("../config/prisma");
const { notifyReminder, safeNotify } = require("../routes/notifications/notification.service");

const REMINDER_WINDOW_MINUTES = 15;

const meetingInclude = {
    organizer: { select: { id: true, name: true, email: true } },
    participants: {
        include: { user: { select: { id: true, name: true, email: true } } },
    },
};

/**
 * Finds meetings starting within the next REMINDER_WINDOW_MINUTES that
 * haven't been reminded yet, and sends a reminder to the organizer and
 * all participants.
 *
 * Each meeting is "claimed" via an atomic updateMany (reminderSentAt: null
 * -> now) before sending. If claimed.count === 0, another run already
 * grabbed it, so we skip — this makes the sweep safe to run concurrently
 * (overlapping ticks, multiple server instances) without double-sending.
 */
async function runReminderSweep() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000);

    const candidates = await prisma.meeting.findMany({
        where: {
            isDeleted: false,
            status: "SCHEDULED",
            reminderSentAt: null,
            startTime: { gte: now, lte: windowEnd },
        },
        include: meetingInclude,
    });

    for (const meeting of candidates) {
        const claimed = await prisma.meeting.updateMany({
            where: { id: meeting.id, reminderSentAt: null },
            data: { reminderSentAt: new Date() },
        });

        if (claimed.count === 0) continue; // already claimed by another run

        const recipients = [meeting.organizer, ...meeting.participants.map((p) => p.user)];

        await safeNotify(notifyReminder, { meeting, recipients });
    }

    return candidates.length;
}

/**
 * Starts the reminder cron. Call this once at server startup
 * (e.g. in server.js / index.js after the app starts listening).
 */
function startReminderCron() {
    cron.schedule("* * * * *", () => {
        runReminderSweep().catch((err) => {
            console.error("[reminder-cron] sweep failed:", err.message);
        });
    });

    console.log("[reminder-cron] scheduled to run every minute");
}

module.exports = { startReminderCron, runReminderSweep };