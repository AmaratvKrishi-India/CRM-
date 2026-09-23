import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackupService } from '../../src/services/backupService';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BackupService browser download', () => {
  it('keeps the Blob URL alive until after the download click handoff', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup-test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    BackupService.downloadJsonFile('backup.json', '{"ok":true}');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup-test');
  });
});
