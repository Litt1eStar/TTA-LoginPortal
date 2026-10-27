import { TRACKS, isGrouped, entryKey } from '../data/tracks';
import { emptySubmission } from '../data/seedData';

// All submissions that belong to a track.
// Non-grouped track → one entry; grouped track (theory / practice) → one entry
// per กลุ่มสาขาวิชา. Every group always exists as its own sub-type, blank until filled.
export const getEntries = (track, submissions) => {
  if (!isGrouped(track)) {
    return [{ key: track.id, groupIdx: null, group: null, sub: submissions[track.id] || emptySubmission() }];
  }
  return track.subjectGroups.map((group, i) => {
    const key = entryKey(track.id, i);
    return { key, groupIdx: i, group, sub: submissions[key] || emptySubmission({ subjectGroup: group }) };
  });
};

// Every item a university can submit, for the dashboard overview (always 17).
// Item: { key, track, groupIdx, groupLabel, sub, status }
export const getOverviewItems = (submissions) =>
  TRACKS.flatMap(track =>
    getEntries(track, submissions).map(e => ({
      key: e.key,
      track,
      groupIdx: e.groupIdx,
      groupLabel: e.group,
      sub: e.sub,
      status: e.sub.status || 'not_started'
    }))
  );

// Combine several statuses: submitted when all are, draft when any work has started
const combine = (statuses) => {
  if (!statuses.length) return 'not_started';
  if (statuses.every(s => s === 'submitted')) return 'submitted';
  if (statuses.some(s => s !== 'not_started')) return 'draft';
  return 'not_started';
};

// Overall status of a track (grouped: across all its กลุ่มสาขาวิชา)
export const getTrackStatus = (track, submissions) =>
  combine(getEntries(track, submissions).map(e => e.sub.status || 'not_started'));

// Status of a top-level type (one track, or a category with sub-types)
export const getTypeStatus = (type, submissions) =>
  combine(type.tracks.map(t => getTrackStatus(t, submissions)));
