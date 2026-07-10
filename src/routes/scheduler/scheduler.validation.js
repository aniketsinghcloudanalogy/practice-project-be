const { z } = require("zod");
const ApiError = require("../../utils/ApiError");
const { RRule } = require("rrule");

const VALID_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"];
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const VALID_MEETING_TYPES = ["INTERNAL", "EXTERNAL"];

// Validates that a bare rule string (no DTSTART) parses correctly.
const rruleString = z.string().refine(
    (value) => {
        try {
            RRule.parseString(value);
            return true;
        } catch {
            return false;
        }
    },
    { message: "Invalid recurrence rule format." }
);

const baseMeetingObject = z.object({
    title: z.string().trim().min(1, "Meeting title is required."),
    description: z.string().optional().nullable(),
    startTime: z.coerce.date({ invalid_type_error: "A valid start time is required." }),
    endTime: z.coerce.date({ invalid_type_error: "A valid end time is required." }),
    location: z.string().optional().nullable(),
    meetingUrl: z.string().url("Meeting URL must be a valid URL.").optional().nullable().or(z.literal("")),
    status: z.enum(VALID_STATUSES).optional(),
    priority: z.enum(VALID_PRIORITIES).optional(),
    meetingType: z.enum(VALID_MEETING_TYPES).optional(),
    department: z.string().optional().nullable(),
    organizerId: z.string().optional(),
    participants: z
        .array(z.string().min(1, "Invalid participant id."))
        .min(1, "Add at least one participant."),
    recurrenceRule: rruleString.optional().nullable(),
    recurrenceEndDate: z.coerce.date().optional().nullable(),
});

const createMeetingSchema = baseMeetingObject
    .refine((data) => data.endTime > data.startTime, {
        message: "End time must be after start time.",
        path: ["endTime"],
    })
    .refine(
        (data) => !data.recurrenceRule || !data.recurrenceEndDate || data.recurrenceEndDate > data.startTime,
        { message: "Recurrence end date must be after the meeting start time.", path: ["recurrenceEndDate"] }
    );

const updateMeetingSchema = baseMeetingObject.partial().refine(
    (data) => {
        if (data.startTime && data.endTime) {
            return data.endTime > data.startTime;
        }
        return true;
    },
    { message: "End time must be after start time.", path: ["endTime"] }
);

const editScopeSchema = z.object({
    scope: z.enum(["occurrence", "series"]).optional().default("series"),
});

const listQuerySchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    status: z.enum(["All", ...VALID_STATUSES]).optional(),
    department: z.string().optional(),
    organizerId: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const message = result.error.issues[0]?.message || "Invalid request body.";
            return next(new ApiError(400, message));
        }
        req.body = result.data;
        next();
    };
}

function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const message = result.error.issues[0]?.message || "Invalid query parameters.";
            return next(new ApiError(400, message));
        }
        req.query = result.data;
        next();
    };
}

function validateMeetingIdParam(req, res, next) {
    if (!req.params.id || typeof req.params.id !== "string" || !req.params.id.trim()) {
        return next(new ApiError(400, "A valid meeting id is required."));
    }
    next();
}

module.exports = {
    validateCreateMeeting: validateBody(createMeetingSchema),
    validateUpdateMeeting: validateBody(updateMeetingSchema),
    validateListQuery: validateQuery(listQuerySchema),
    validateEditScope: validateQuery(editScopeSchema),
    validateMeetingIdParam,
};