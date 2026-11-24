import { describe, it, expect } from 'vitest';
import { TRACKS, FINAL_DEADLINE } from '../../src/data/tracks.js';
import { getRequirements } from '../../src/utils/requirements.js';
import { emptySubmission } from '../../src/data/seedData.js';

describe('shared frontend modules', () => {
  it('load in node', () => {
    expect(TRACKS.length).toBe(11);
    expect(typeof FINAL_DEADLINE).toBe('string');
    expect(typeof getRequirements).toBe('function');
    expect(emptySubmission().status).toBe('not_started');
  });
});
