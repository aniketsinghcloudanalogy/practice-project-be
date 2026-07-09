const prisma = require("../../config/prisma");
const ApiError = require("../../utils/ApiError");
const { notifyInvitation, notifyUpdate, notifyCancellation, safeNotify } = require("../notifications/notification.service");
const { emitToUsers } = require("../../config/socket");
const { expandRecurringMeeting } = require("./recurrence");

async function assertOrganizerExists(organizerId) {
    const organizer = await prisma.user.findFirst({
        where: { id: organizerId, isActive: true },
        select: { id: true },
    });
    if (!organizer) {
        throw new ApiError(404, "Organizer not found or inactive.");
    }
}

async function assertParticipantsExist(participantIds) {
    const uniqueIds = [...new Set(participantIds)];
    const found = await prisma.user.findMany({
        where: { id: { in: uniqueIds }, isActive: true },
        select: { id: true },
    });

    if (found.length !== uniqueIds.length) {
        const foundIds = new Set(found.map((u) => u.id));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        throw new ApiError(400, `Invalid or inactive participant id(s): ${missing.join(", ")}`);
    }
}

function buildMeetingWhere({ userId, status, department, organizerId, search }) {
    const accessOR = [
        { organizerId: userId },
        { participants: { some: { userId } } },
    ];

    const where = { isDeleted: false, AND: [{ OR: accessOR }] };

    if (organizerId && organizerId !== "All") {
        where.AND.push({ organizerId });
    }

    if (status && status !== "All") where.status = status;
    if (department && department !== "All") where.department = department;

    if (search) {
        where.AND.push({
            OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { participants: { some: { user: { name: { contains: search, mode: "insensitive" } } } } },
            ],
        });
    }

    return where;
}

const meetingInclude = {
    organizer: { select: { id: true, name: true, email: true } },
    participants: {
        include: { user: { select: { id: true, name: true, email: true } } },
    },
};

const CONTENT_FIELDS = [
    "title",
    "description",
    "startTime",
    "endTime",
    "location",
    "meetingUrl",
    "status",
    "priority",
    "meetingType",
    "department",
];

function participantIdsOf(meeting) {
    return meeting.participants.map((p) => p.userId);
}

async function createMeeting({ userId, data }) {
    const { title, description, startTime, endTime, location, meetingUrl, status, priority, meetingType, department, organizerId, participants, recurrenceRule, recurrenceEndDate } = data;

    const resolvedOrganizerId = organizerId || userId;
    await assertOrganizerExists(resolvedOrganizerId);
    await assertParticipantsExist(participants);

    const meeting = await prisma.meeting.create({
        data: {
            title: title.trim(),
            description: description || null,
            startTime,
            endTime,
            location: location || null,
            meetingUrl: meetingUrl || null,
            status: status || "SCHEDULED",
            priority: priority || "MEDIUM",
            meetingType: meetingType || "INTERNAL",
            department: department || null,
            organizerId: resolvedOrganizerId,
            recurrenceRule: recurrenceRule || null,
            recurrenceEndDate: recurrenceEndDate || null,
            participants: {
                create: [...new Set(participants)].map((participantUserId) => ({
                    userId: participantUserId,
                })),
            },
        },
        include: meetingInclude,
    });

    await safeNotify(notifyInvitation, {
        meeting,
        recipients: meeting.participants.map((p) => p.user),
    });

    emitToUsers("meeting:created", meeting, [resolvedOrganizerId, ...participantIdsOf(meeting)]);

    return meeting;
}

// Default expansion window when the client doesn't specify one — prevents
// unbounded RRULE expansion (e.g. a daily recurrence with no end date).
function resolveExpansionRange(dateFrom, dateTo) {
    const now = new Date();
    const start = dateFrom || new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = dateTo || new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { start, end };
}

async function listMeetings({ userId, query }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where = buildMeetingWhere({ userId, ...query });
    const { start: rangeStart, end: rangeEnd } = resolveExpansionRange(query.dateFrom, query.dateTo);

    // Non-recurring, non-exception meetings: filtered by startTime in range.
    const nonRecurringWhere = { ...where, recurrenceRule: null, parentMeetingId: null, startTime: { gte: rangeStart, lte: rangeEnd } };
    // Series parents: fetched regardless of their own startTime, since a
    // series created months ago can still produce occurrences in-range.
    const seriesParentsWhere = { ...where, recurrenceRule: { not: null }, parentMeetingId: null };
    // Exception rows: individually-edited occurrences linked to a parent.
    const exceptionsWhere = { ...where, parentMeetingId: { not: null } };

    const [nonRecurring, seriesParents, exceptions, total] = await Promise.all([
        prisma.meeting.findMany({ where: nonRecurringWhere, include: meetingInclude, orderBy: { startTime: "asc" } }),
        prisma.meeting.findMany({ where: seriesParentsWhere, include: meetingInclude }),
        prisma.meeting.findMany({ where: exceptionsWhere, include: meetingInclude }),
        prisma.meeting.count({ where: nonRecurringWhere }),
    ]);

    const exceptionsByParent = new Map();
    for (const exception of exceptions) {
        const list = exceptionsByParent.get(exception.parentMeetingId) || [];
        list.push(exception);
        exceptionsByParent.set(exception.parentMeetingId, list);
    }

    const virtualInstances = [];
    for (const parent of seriesParents) {
        const seriesExceptions = exceptionsByParent.get(parent.id) || [];
        const exceptionDates = new Set(seriesExceptions.map((e) => e.startTime.toISOString().slice(0, 10)));

        const effectiveEnd = parent.recurrenceEndDate && parent.recurrenceEndDate < rangeEnd
            ? parent.recurrenceEndDate
            : rangeEnd;

        const instances = expandRecurringMeeting(parent, rangeStart, effectiveEnd, exceptionDates);
        virtualInstances.push(...instances);

        const inRangeExceptions = seriesExceptions.filter(
            (e) => e.startTime >= rangeStart && e.startTime <= rangeEnd
        );
        virtualInstances.push(...inRangeExceptions.map((e) => ({ ...e, seriesParentId: parent.id })));
    }

    const allMeetings = [...nonRecurring, ...virtualInstances].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const paged = allMeetings.slice(skip, skip + limit);

    return {
        meetings: paged,
        pagination: {
            page,
            limit,
            total: total + virtualInstances.length,
            totalPages: Math.ceil((total + virtualInstances.length) / limit),
        },
    };
}

async function getMeetingById({ meetingId, userId, organizerOnly = false }) {
    const [realId, virtualDate] = meetingId.split("::");

    const where = organizerOnly
        ? { id: realId, isDeleted: false, organizerId: userId }
        : {
            id: realId,
            isDeleted: false,
            OR: [
                { organizerId: userId },
                { participants: { some: { userId } } },
            ],
        };

    const meeting = await prisma.meeting.findFirst({
        where,
        include: meetingInclude,
    });

    if (!meeting) {
        throw new ApiError(404, "Meeting not found.");
    }

    if (!virtualDate) {
        return meeting;
    }

    const durationMs = meeting.endTime.getTime() - meeting.startTime.getTime();
    const start = new Date(virtualDate);
    start.setHours(meeting.startTime.getHours(), meeting.startTime.getMinutes(), 0, 0);
    const end = new Date(start.getTime() + durationMs);

    return { ...meeting, id: meetingId, startTime: start, endTime: end, isVirtualRecurrence: true, seriesParentId: realId };
}

async function syncParticipants(tx, meetingId, incomingUserIds) {
    const existing = await tx.meetingParticipant.findMany({
        where: { meetingId },
        select: { userId: true },
    });

    const existingIds = new Set(existing.map((p) => p.userId));
    const incomingIds = new Set(incomingUserIds);

    const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
    const toAdd = [...incomingIds].filter((id) => !existingIds.has(id));

    if (toRemove.length) {
        await tx.meetingParticipant.deleteMany({
            where: { meetingId, userId: { in: toRemove } },
        });
    }

    if (toAdd.length) {
        await tx.meetingParticipant.createMany({
            data: toAdd.map((userId) => ({ meetingId, userId })),
            skipDuplicates: true,
        });
    }
}

/**
 * scope: "series" (default) updates the recurring parent — all future
 * un-exceptioned occurrences inherit the change. scope: "occurrence"
 * creates or updates a standalone exception row for just that one date.
 */
async function updateMeeting({ meetingId, userId, data, scope = "series" }) {
    const [realId, virtualDate] = meetingId.split("::");

    if (scope === "occurrence" && virtualDate) {
        return updateSingleOccurrence({ parentId: realId, occurrenceDate: virtualDate, userId, data });
    }

    const existingMeeting = await getMeetingById({ meetingId: realId, userId, organizerOnly: true });

    const { title, description, startTime, endTime, location, meetingUrl, status, priority, meetingType, department, organizerId, participants, recurrenceRule, recurrenceEndDate } = data;

    if (organizerId && organizerId !== existingMeeting.organizerId) {
        await assertOrganizerExists(organizerId);
    }
    if (participants) {
        await assertParticipantsExist(participants);
    }

    const uniqueParticipants = participants ? [...new Set(participants)] : null;

    await prisma.$transaction(async (tx) => {
        await tx.meeting.update({
            where: { id: realId },
            data: {
                ...(title !== undefined ? { title: title.trim() } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(startTime !== undefined ? { startTime } : {}),
                ...(endTime !== undefined ? { endTime } : {}),
                ...(location !== undefined ? { location } : {}),
                ...(meetingUrl !== undefined ? { meetingUrl } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(priority !== undefined ? { priority } : {}),
                ...(meetingType !== undefined ? { meetingType } : {}),
                ...(department !== undefined ? { department } : {}),
                ...(organizerId !== undefined ? { organizerId } : {}),
                ...(recurrenceRule !== undefined ? { recurrenceRule } : {}),
                ...(recurrenceEndDate !== undefined ? { recurrenceEndDate } : {}),
            },
        });

        if (uniqueParticipants) {
            await syncParticipants(tx, realId, uniqueParticipants);
        }
    });

    const updatedMeeting = await prisma.meeting.findUnique({
        where: { id: realId },
        include: meetingInclude,
    });

    const beforeIds = new Set(existingMeeting.participants.map((p) => p.userId));
    const afterIds = new Set(updatedMeeting.participants.map((p) => p.userId));

    const addedRecipients = updatedMeeting.participants
        .filter((p) => !beforeIds.has(p.userId))
        .map((p) => p.user);

    const removedRecipients = existingMeeting.participants
        .filter((p) => !afterIds.has(p.userId))
        .map((p) => p.user);

    const keptRecipients = updatedMeeting.participants
        .filter((p) => beforeIds.has(p.userId))
        .map((p) => p.user);

    const contentChanged = CONTENT_FIELDS.some((key) => data[key] !== undefined);

    await Promise.all([
        safeNotify(notifyInvitation, { meeting: updatedMeeting, recipients: addedRecipients }),
        safeNotify(notifyCancellation, { meeting: existingMeeting, recipients: removedRecipients }),
        contentChanged
            ? safeNotify(notifyUpdate, { meeting: updatedMeeting, recipients: keptRecipients })
            : Promise.resolve(),
    ]);

    const stillInvolvedIds = [updatedMeeting.organizerId, ...participantIdsOf(updatedMeeting)];
    emitToUsers("meeting:updated", updatedMeeting, stillInvolvedIds);

    if (removedRecipients.length) {
        emitToUsers("meeting:removed", { id: realId }, removedRecipients.map((u) => u.id));
    }

    return updatedMeeting;
}

/**
 * Creates (or updates, if one already exists for this date) an exception
 * row: a standalone Meeting linked via parentMeetingId, representing just
 * this one occurrence edited independently of the series.
 */
async function updateSingleOccurrence({ parentId, occurrenceDate, userId, data }) {
    const parent = await getMeetingById({ meetingId: parentId, userId, organizerOnly: true });

    const occurrenceStart = new Date(occurrenceDate);
    occurrenceStart.setHours(parent.startTime.getHours(), parent.startTime.getMinutes(), 0, 0);

    const existingException = await prisma.meeting.findFirst({
        where: { parentMeetingId: parentId, startTime: occurrenceStart },
    });

    const durationMs = parent.endTime.getTime() - parent.startTime.getTime();
    const defaultEnd = new Date(occurrenceStart.getTime() + durationMs);

    const mergedData = {
        title: data.title ?? parent.title,
        description: data.description ?? parent.description,
        startTime: data.startTime ?? occurrenceStart,
        endTime: data.endTime ?? defaultEnd,
        location: data.location ?? parent.location,
        meetingUrl: data.meetingUrl ?? parent.meetingUrl,
        status: data.status ?? parent.status,
        priority: data.priority ?? parent.priority,
        meetingType: data.meetingType ?? parent.meetingType,
        department: data.department ?? parent.department,
        organizerId: data.organizerId ?? parent.organizerId,
    };

    const exception = existingException
        ? await prisma.meeting.update({ where: { id: existingException.id }, data: mergedData, include: meetingInclude })
        : await prisma.meeting.create({
            data: {
                ...mergedData,
                parentMeetingId: parentId,
                isRecurringException: true,
                participants: {
                    create: (data.participants ?? parent.participants.map((p) => p.userId)).map((userId) => ({ userId })),
                },
            },
            include: meetingInclude,
        });

    const notifyIds = [exception.organizerId, ...participantIdsOf(exception)];
    emitToUsers("meeting:updated", exception, notifyIds);

    return exception;
}

async function deleteMeeting({ meetingId, userId }) {
    const [realId, virtualDate] = meetingId.split("::");

    if (virtualDate) {
        // Deleting a single occurrence: create/update an exception marked
        // CANCELLED rather than touching the series parent.
        return updateSingleOccurrence({
            parentId: realId,
            occurrenceDate: virtualDate,
            userId,
            data: { status: "CANCELLED" },
        });
    }

    const existingMeeting = await getMeetingById({ meetingId: realId, userId, organizerOnly: true });

    const meeting = await prisma.meeting.update({
        where: { id: realId },
        data: { isDeleted: true, deletedAt: new Date(), status: "CANCELLED" },
    });

    await safeNotify(notifyCancellation, {
        meeting: existingMeeting,
        recipients: existingMeeting.participants.map((p) => p.user),
    });

    const notifyIds = [existingMeeting.organizerId, ...participantIdsOf(existingMeeting)];
    emitToUsers("meeting:deleted", { id: realId }, notifyIds);

    return meeting;
}

module.exports = {
    createMeeting,
    listMeetings,
    getMeetingById,
    updateMeeting,
    deleteMeeting,
};