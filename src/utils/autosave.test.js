import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutosaver, entryData } from './autosave.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('entryData', () => {
  it('drops computed fields and files that are not uploaded', () => {
    const out = entryData({
      status: 'draft', draftAt: 'x', submittedAt: null, hash: null, version: 4,
      projectName: 'P',
      files: [
        { id: 1, fileId: 1, status: 'done', name: 'a.pdf' },
        { id: 'f-1', status: 'uploading', progress: 40 },
        { id: 'f-2', status: 'error', error: 'bad' }
      ]
    });
    expect(out).toEqual({ projectName: 'P', files: [{ id: 1, fileId: 1, status: 'done', name: 'a.pdf' }] });
  });
});

describe('createAutosaver', () => {
  let save, states, errors, saver;
  beforeEach(() => {
    vi.useFakeTimers();
    save = vi.fn(async (key, data, version) => ({ ...data, version: version + 1 }));
    states = [];
    errors = [];
    saver = createAutosaver({
      save,
      delay: 1000,
      onStateChange: (s) => states.push(s),
      onError: (key, err) => errors.push([key, err])
    });
    saver.setBaseline('clip', { projectName: '' }, 1);
  });
  afterEach(() => vi.useRealTimers());

  it('saves about 1 s after a change', async () => {
    saver.schedule('clip', { projectName: 'A' });
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledWith('clip', { projectName: 'A' }, 1);
    expect(states).toEqual(['saving', 'saved']);
  });

  it('does nothing when the data equals the last saved data', async () => {
    expect(saver.schedule('clip', { projectName: '' })).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('debounces several quick changes into one save of the last data', async () => {
    saver.schedule('clip', { projectName: 'A' });
    await vi.advanceTimersByTimeAsync(500);
    saver.schedule('clip', { projectName: 'AB' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('clip', { projectName: 'AB' }, 1);
  });

  it('uses the version returned by the previous save', async () => {
    saver.schedule('clip', { projectName: 'A' });
    await vi.advanceTimersByTimeAsync(1000);
    saver.schedule('clip', { projectName: 'B' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenLastCalledWith('clip', { projectName: 'B' }, 2);
  });

  it('cancels a pending save when the data goes back to the saved value', async () => {
    saver.schedule('clip', { projectName: 'A' });
    saver.schedule('clip', { projectName: '' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it('flush saves at once; without changes it returns null unless forced', async () => {
    expect(await saver.flush('clip')).toBeNull();
    expect(save).not.toHaveBeenCalled();
    const entry = await saver.flush('clip', { force: true });
    expect(save).toHaveBeenCalledWith('clip', { projectName: '' }, 1);
    expect(entry.version).toBe(2);
  });

  it('flush sends pending data without waiting for the timer', async () => {
    saver.schedule('clip', { projectName: 'A' });
    await saver.flush('clip');
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('on failure reports the error, keeps the data, and retries on flush', async () => {
    const boom = new Error('offline');
    save.mockRejectedValueOnce(boom);
    saver.schedule('clip', { projectName: 'A' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(errors).toEqual([['clip', boom]]);
    expect(states.at(-1)).toBe('error');
    expect(saver.hasUnsaved()).toBe(true);
    await saver.flush('clip');
    expect(save).toHaveBeenLastCalledWith('clip', { projectName: 'A' }, 1);
    expect(saver.hasUnsaved()).toBe(false);
  });

  it('flush rejects with the save error', async () => {
    save.mockRejectedValueOnce(new Error('nope'));
    saver.schedule('clip', { projectName: 'A' });
    await expect(saver.flush('clip')).rejects.toThrow('nope');
  });

  it('setBaseline drops a pending change and sets the version', async () => {
    saver.schedule('clip', { projectName: 'A' });
    saver.setBaseline('clip', { projectName: 'server' }, 9);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    saver.schedule('clip', { projectName: 'C' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledWith('clip', { projectName: 'C' }, 9);
  });

  it('runs one save at a time per entry, the second with the new version', async () => {
    const first = deferred();
    save.mockImplementationOnce(() => first.promise);
    saver.schedule('clip', { projectName: 'A' });
    await vi.advanceTimersByTimeAsync(1000);
    saver.schedule('clip', { projectName: 'AB' });
    const second = saver.flush('clip');
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve({ projectName: 'A', version: 2 });
    await second;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('clip', { projectName: 'AB' }, 2);
  });

  it('flushAll saves every pending entry and never rejects', async () => {
    saver.setBaseline('dance', { notes: '' }, 3);
    saver.schedule('clip', { projectName: 'A' });
    saver.schedule('dance', { notes: 'n' });
    save.mockRejectedValueOnce(new Error('x'));
    await expect(saver.flushAll()).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('reset forgets everything', async () => {
    saver.schedule('clip', { projectName: 'A' });
    saver.reset();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    expect(saver.hasUnsaved()).toBe(false);
  });
});
