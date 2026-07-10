const { RRule, rrulestr } = require("rrule");

/**
 * Parses a stored recurrenceRule string and re-anchors it to the meeting's
 * actual startTime. Rules are stored as bare strings like "FREQ=WEEKLY"
 * (no DTSTART) since DTSTART would duplicate startTime — this function is
 * the single place that combines the two back together correctly.
 */
function buildAnchoredRule(recurrenceRuleString, startTime) {
    const parsedOptions = RRule.parseString(recurrenceRuleString);
    return new RRule({
        ...parsedOptions,
        dtstart: startTime,
    });
}

/**
 * Given a series-parent meeting (has recurrenceRule) and a bounded date
 * range, returns virtual instance objects for the calendar — one per
 * occurrence, each with a deterministic virtual id `${parentId}::${isoDate}`
 * so the frontend can address a specific occurrence without it being a
 * real DB row. Occurrences that already have a real exception row (edited
 * individually) are skipped here via `exceptionDates` — the caller merges
 * those real rows in separately so the edited version is shown instead.
 */
function expandRecurringMeeting(parentMeeting, rangeStart, rangeEnd, exceptionDates) {
    const rule = buildAnchoredRule(parentMeeting.recurrenceRule, parentMeeting.startTime);
    const durationMs = parentMeeting.endTime.getTime() - parentMeeting.startTime.getTime();

    const occurrenceStarts = rule.between(rangeStart, rangeEnd, true);

    return occurrenceStarts
        .filter((date) => !exceptionDates.has(date.toISOString().slice(0, 10)))
        .map((start) => {
            const end = new Date(start.getTime() + durationMs);

            return {
                ...parentMeeting,
                id: `${parentMeeting.id}::${start.toISOString().slice(0, 10)}`,
                startTime: start,
                endTime: end,
                isVirtualRecurrence: true,
                seriesParentId: parentMeeting.id,
            };
        });
}

module.exports = { expandRecurringMeeting, buildAnchoredRule };