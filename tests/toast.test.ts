import { beforeEach, describe, expect, it, vi } from 'vitest';
import hotToast from 'react-hot-toast';
import toast, { dismissAll } from '@/lib/toast';

vi.mock('react-hot-toast', () => {
  const dismiss = vi.fn();
  const success = vi.fn();
  const error = vi.fn();
  const toastFn = vi.fn();
  const api = Object.assign(toastFn, { dismiss, success, error });
  return {
    default: api,
    toast: toastFn,
    success,
    error,
    dismiss,
  };
});

describe('toast helpers', () => {
  beforeEach(() => {
    const api = vi.mocked(hotToast);
    api.mockClear();
    api.dismiss.mockClear();
    api.success.mockClear();
    api.error.mockClear();
  });

  it('routes messages to the appropriate hot-toast helper', () => {
    toast.success('saved');
    expect(hotToast.dismiss).toHaveBeenCalledTimes(1);
    expect(hotToast.success).toHaveBeenCalledWith('saved', expect.any(Object));

    toast.error('failed', false);
    expect(hotToast.dismiss).toHaveBeenCalledTimes(1);
    expect(hotToast.error).toHaveBeenCalledWith('failed', expect.any(Object));

    toast.info('info');
    expect(hotToast).toHaveBeenCalledWith('info', expect.any(Object));
  });

  it('exposes a dismissAll helper that proxies through', () => {
    dismissAll();
    expect(hotToast.dismiss).toHaveBeenCalledTimes(1);
  });
});
