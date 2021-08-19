import { renderHook, act } from '@testing-library/react-hooks';
import { define } from './index';

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
    isFetching: boolean | null,
    response: number;
  }>();
  state.setup({
    isFetching: null,
    response: -1
  });

  const { result } = renderHook(() => state.use(s => s));

  await act(async () => {
    await state.update(function *(ctx) {
      ctx.state.isFetching = true;
      ctx.state.response = yield wait(100).then(() => 100);
      ctx.state.isFetching = false;
    });
  });
  expect(result.all).toEqual([
    { isFetching: null, response: -1 },
    { isFetching: true, response: -1 },
    { isFetching: false, response: 100 },
  ]);
});

test('async failure', async () => {
  const state = define<{
    isFetching: boolean | null,
    response: number;
  }>();
  state.setup({
    isFetching: null,
    response: -1
  });

  const { result } = renderHook(() => state.use(s => s));

  await act(async () => {
    await state.update(function *(ctx) {
      ctx.state.isFetching = true;
      try {
        ctx.state.response = yield wait(100).then(() => Promise.reject(100));
      } catch (e) {
        ctx.state.isFetching = false;
      }
    });
  });
  expect(result.all).toEqual([
    { isFetching: null, response: -1 },
    { isFetching: true, response: -1 },
    { isFetching: false, response: -1 },
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

test('nested async update', async () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  const { result } = renderHook(() => state.use(s => s.a));
  await act(async () => {
    await state.update(function *(ctx) {
      ctx.state.a++;
      ctx.state.a = yield Promise.resolve(ctx.state.a + 1);
      state.update(function *(ctx) {
        ctx.state.a++;
        ctx.state.a = yield Promise.resolve(ctx.state.a + 1);
        state.update(ctx => {
          ctx.state.a++;
        });
      });
    });
  });
  expect(result.all).toEqual([
    1,
    2,
    3,
    4,
    6
  ]);
});

test('revoked draft should raise error', (done) => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });
  state.update(ctx => {
    const draft = ctx.state;
    setTimeout(() => {
      expect(() => {
        draft.a++;
      }).toThrow();
      done();
    }, 100);
  });
});

const wait = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout));
