// Shape of one blank entry. Shared with the server (server/src/entries.js imports it),
// so keep this file free of browser APIs and of imports from React files.
// Only `links.video` is kept (contracts amendment 1).
export const emptySubmission = (extra = {}) => ({
  status: 'not_started',
  projectName: '',
  summary: '',
  notes: '',
  members: [],
  files: [],
  links: { video: '' },
  subjectGroup: '',
  ...extra
});
