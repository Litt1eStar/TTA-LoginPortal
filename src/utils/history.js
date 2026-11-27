import { TRACKS, trackSubtitle } from '../data/tracks';
import { getEntries } from './entries';
import { fmtDateTime, statusMeta, teamLabel } from './formatters';
import { submissionSummary } from './requirements';

// One row per entry (grouped tracks get a row for every กลุ่มสาขา), shared by the history
// table (tablets and up) and the history cards (phones).
export const historyRows = (submissions) =>
  TRACKS.flatMap(t => getEntries(t, submissions).map(e => {
    const sub = e.sub;
    const isSubmitted = sub.status === 'submitted';
    return {
      key: e.key,
      track: t,
      groupIdx: e.groupIdx,
      title: t.th,
      subtitle: e.group || trackSubtitle(t),
      summary: submissionSummary(t, sub),
      timestamp: sub.submittedAt
        ? fmtDateTime(sub.submittedAt)
        : (sub.draftAt ? `${fmtDateTime(sub.draftAt)} (ร่าง)` : '-'),
      meta: statusMeta(sub.status, 0),
      isSubmitted,
      isDraft: sub.status === 'draft',
      team: teamLabel(sub.members, t),
      hash: isSubmitted ? sub.hash || null : null,
      filesCount: (sub.files || []).filter(f => f.status === 'done').length,
      linksCount: sub.links?.video ? 1 : 0,
      action: isSubmitted ? 'ดูรายละเอียด' : (sub.status === 'draft' ? 'แก้ไขต่อ' : 'เริ่มส่ง')
    };
  }));
