import { renderHook, act } from '@testing-library/react-hooks';
import { define } from './index';

type Async<R, E> = {
  state: 'default';
} | {
  state: 'loading';
} | {
  state: 'success';
  response: R;
} | {
  state: 'failure';
  error: E;
};

const async = {
  default: () => ({ state: 'default' } as const),
  loading: () => ({ state: 'loading' } as const),
  success: <R extends unknown>(r: R) => ({ state: 'success', response: r } as const),
  failure: <E extends unknown>(e: E) => ({ state: 'failure', error: e } as const),
};

test('re-setup', async () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });

  const { result } = renderHook(() => state.use(s => s.a));

  // update state.
  await act(async () => {
    await state.setup({
      a: 2
    });
  });
  expect(result.current).toBe(2);
  expect(result.all).toHaveLength(2);
});

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
    state.update(ctx => {
      ctx.state.a++;
    });
    state.update(ctx => {
      ctx.state.a++;
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
    state.update(ctx => {
      ctx.state.a = 1;
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
    num: Async<number, unknown>;
  }>();
  state.setup({
    num: async.default()
  });

  const { result } = renderHook(() => state.use(s => s));

  await act(async () => {
    await state.update(function *(ctx) {
      ctx.state.num = async.loading();
      try {
        ctx.state.num = async.success(yield wait(100).then(() => 100));
      } catch (e) {
        ctx.state.num = async.failure(e);
      }
    });
  });
  expect(result.all).toEqual([
    { num: async.default() },
    { num: async.loading() },
    { num: async.success(100) },
  ]);
});

test('async failure', async () => {
  const state = define<{
    num: Async<number, unknown>;
  }>();
  state.setup({
    num: async.default()
  });

  const { result } = renderHook(() => state.use(s => s));

  await act(async () => {
    await state.update(function *(ctx) {
      ctx.state.num = async.loading();
      try {
        ctx.state.num = async.success(yield wait(100).then(() => Promise.reject(100)));
      } catch (e) {
        ctx.state.num = async.failure(e);
      }
    });
  });
  expect(result.all).toEqual([
    { num: async.default() },
    { num: async.loading() },
    { num: async.failure(100) },
  ]);
});

test('nested update', () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  const { result } = renderHook(() => state.use(s => s.a));
  act(() => {
    state.update(ctx => {
      ctx.state.a++;
      state.update(ctx => {
        ctx.state.a++;
      });
    });
  });
  expect(result.current).toEqual(3);
  expect(result.all).toHaveLength(2);
});

test('merge synchronous context', () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  const { result } = renderHook(() => state.use(s => s.a));
  act(() => {
    state.update(ctx => {
      const s = ctx.state;
      state.update(() => {
        s.a++;
      });
      s.a++;
    });
  });
  expect(result.current).toEqual(3);
  expect(result.all).toHaveLength(2);
});

test('merge synchronous context after async', async () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  const { result } = renderHook(() => state.use(s => s.a));
  await act(async () => {
    await state.update(function *(ctx) {
      ctx.state.a = 2;
      ctx.state.a = yield wait(100).then(() => Promise.resolve(100));
      const s = ctx.state;
      state.update(() => {
        s.a++;
      });
      s.a++;
    });
  });
  expect(result.current).toEqual(102);
  expect(result.all).toHaveLength(3);
});

test('nested async update', async () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  const { result } = renderHook(() => state.use(s => s.a));
  await act(async () => {
    await state.update(function *(ctx) {
      ctx.state.a++;
      ctx.state.a = yield wait(100).then(() => ctx.state.a + 1);
      yield state.update(function *(ctx) {
        ctx.state.a++;
        ctx.state.a = yield wait(100).then(() => ctx.state.a + 1);
        state.update(ctx => {
          ctx.state.a++;
        });
      });
    });
  });
  expect(result.all).toEqual([
    1,
    2,
    4,
    6
  ]);
});

test('revoked draft should raise error', (done) => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  state.update(ctx => {
    const draft = ctx.state;
    draft.a++;
    setTimeout(() => {
      expect(() => {
        draft.a++;
      }).toThrow();
      done();
    }, 100);
  });
});

test('re-listen when deps were changed', async () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  const { result, rerender } = renderHook((props) => {
    return state.use(s => s.a + props.delta, [props.delta])
  }, {
    initialProps: {
      delta: 1
    }
  });
  act(() => {
    state.update(ctx => {
      ctx.state.a = 2;
    });
  });
  expect(result.current).toEqual(3);
  expect(result.all).toHaveLength(2);

  rerender({ delta: 2 });
  expect(result.current).toEqual(4);
  expect(result.all).toHaveLength(3);

  act(() => {
    state.update(ctx => {
      ctx.state.a = 3;
    });
  });
  expect(result.current).toEqual(5);
  expect(result.all).toHaveLength(4);
});

const wait = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout));
