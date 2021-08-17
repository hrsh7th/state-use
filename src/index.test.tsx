import { renderHook, act } from '@testing-library/react-hooks';
import { Async, define } from './index';

test('should update', () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });

  const { result, rerender } = renderHook((props) => {
    return state.use(s => s.a + props.delta, [props.delta]);
  }, {
    initialProps: { delta: 1 }
  });

  // update state.
  act(() => {
    state.update(s => {
      s.a++;
    });
    state.update(s => {
      s.a++;
    });
  });
  expect(result.current).toBe(4);
  expect(result.all).toHaveLength(2);

  // update deps.
  rerender({ delta: 2 });
  expect(result.current).toBe(5);
  expect(result.all).toHaveLength(3);
});

test('shouldn\'t update', () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });

  const { result, rerender } = renderHook((props) => {
    return state.use(s => [s.a + props.delta], [props.delta]);
  }, {
    initialProps: { delta: 1 }
  });

  // no change state.
  const current = result.current;
  act(() => {
    state.update(s => {
      s.a = 1;
    });
  });
  expect(result.current).toBe(current);
  expect(result.all).toHaveLength(1);

  // no change deps.
  rerender({ delta: 1 })
  expect(result.current).toBe(current);
  expect(result.all).toHaveLength(2);
});

test('async success', async () => {
  const state = define<{
    response: Async<number, unknown>;
  }>();
  state.setup({
    response: {
      state: 'default'
    }
  });

  const { result, waitForNextUpdate } = renderHook(() => state.use(s => s.response));

  await act(async () => {
    state.update((s, async) => {
      s.response = async(async () => {
        return wait(50).then(() => 100);
      });
    });
  });
  expect(result.current).toEqual({ state: 'loading' });
  expect(result.all).toHaveLength(2);

  await waitForNextUpdate();
  expect(result.current).toEqual({ state: 'success', response: 100 });
  expect(result.all).toHaveLength(3);
});

test('async failure', async () => {
  const state = define<{
    response: Async<number, unknown>;
  }>();
  state.setup({
    response: {
      state: 'default'
    }
  });

  const { result, waitForNextUpdate } = renderHook(() => state.use(s => s.response));

  await act(async () => {
    state.update((s, async) => {
      s.response = async(async () => {
        return wait(50).then(() => {
          throw 'error';
        });
      });
    });
  });
  expect(result.current).toEqual({ state: 'loading' });
  expect(result.all).toHaveLength(2);

  await waitForNextUpdate();
  expect(result.current).toEqual({ state: 'failure', error: 'error' });
  expect(result.all).toHaveLength(3);
});

test('revoked draft should raise error', (done) => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  state.update(s => {
    setTimeout(() => {
      expect(() => {
        s.a++;
      }).toThrow();
      done();
    }, 100);
  });
});

const wait = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout));
