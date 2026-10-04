export const CSV_TEMPLATE_HEADERS = [
  'type',
  'full_name',
  'student_id',
  'email',
  'phone',
  'faculty_or_department',
  'year',
  'academic_title',
  'is_leader'
];

export const CSV_TEMPLATE_SAMPLE_ROWS = [
  ['advisor', 'สมชาย ใจดี', '', 'somchai.j@university.ac.th', '081-234-5678', 'คณะครุศาสตร์', '', 'รศ.', ''],
  ['student', 'นิด สุวรรณี', '6401234567', 'nid.s@university.ac.th', '089-111-2222', 'คณิตศาสตร์ศึกษา', '3', '', 'yes'],
  ['student', 'อาร์ม ธนพล', '6401234588', 'arm.t@university.ac.th', '', 'คณิตศาสตร์ศึกษา', '3', '', 'no']
];

export const generateCsvTemplateContent = () => {
  const lines = [
    CSV_TEMPLATE_HEADERS.join(','),
    ...CSV_TEMPLATE_SAMPLE_ROWS.map(row => row.join(','))
  ];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
};
