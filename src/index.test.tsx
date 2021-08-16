import { renderHook, act } from '@testing-library/react-hooks';
import { define } from './index';

test('should update (draft API)', () => {
  const state = define<{ a: number }>();
  state.setup({ a: 1 });

  const { result, rerender } = renderHook((props) => {
    return state.use(s => s.a + props.delta, [props.delta]);
  }, {
    initialProps: { delta: 1 }
  });

  // update state.
  act(() => {
    state.draft.a++;
    state.commit();
    state.draft.a++;
    state.commit();
  });
  expect(result.current).toBe(4);
  expect(result.all).toHaveLength(2);

  // update deps.
  rerender({ delta: 2 });
  expect(result.current).toBe(5);
  expect(result.all).toHaveLength(3);
});

test('should update (update API)', () => {
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

test('shouldn\'t update (draft API)', () => {
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
    state.draft.a = 1;
    state.commit();
  });
  expect(result.current).toStrictEqual(current);
  expect(result.all).toHaveLength(1);

  // no change deps.
  rerender({ delta: 1 })
  expect(result.current).toStrictEqual(current);
  expect(result.all).toHaveLength(2);
});

test('shouldn\'t update (update API)', () => {
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
  expect(result.current).toStrictEqual(current);
  expect(result.all).toHaveLength(1);

  // no change deps.
  rerender({ delta: 1 })
  expect(result.current).toStrictEqual(current);
  expect(result.all).toHaveLength(2);
});

