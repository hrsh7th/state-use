import { Draft, produce } from 'immer';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

const useIsomorphicEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const AsyncSymbol = Symbol('state-use:async');

const isAsync = (e: any): e is { [AsyncSymbol]: Promise<any> } => {
  return e && typeof e === 'object' && e[AsyncSymbol] instanceof Promise;
};

export type Async<R, E> = {
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
export type Updater<S> = (s: S, async: <R>(runner: () => Promise<R>) => Async<R, unknown>) => void;
export type Selector<S, A = S> = (s: S) => A;

/**
 * Create state object.
 */
export function define<S>() {
  return new State<S>();
}

class State<S> {

  /**
   * State has setup or not.
   */
  private hasSetup = false;

  /**
   * An internal state object.
   */
  private state!: S;

  /**
   * An draft object current proceeding.
   */
  private draft?: Draft<S>;

  /**
   * A list of function to update component's local state.
   */
  private depends: ((s: S) => void)[] = [];

  /**
   * Setup default state.
   */
  public setup = (state: S) => {
    this.hasSetup = true;
    this.state = state;
  }

  /**
   * Update function.
   */
  public update = (updater: Updater<S>) => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }

    try {
      this.produce(s => {
        updater(s as S, (runner: () => Promise<any>) => {
          throw {
            [AsyncSymbol]: runner(),
          };
        });
      });
    } catch (e) {
      // passthrough.
      if (!isAsync(e)) {
        throw e;
      }

      // loading state.
      this.produce(s => {
        updater(s as S, () => ({
          state: 'loading'
        }));
      });

      e[AsyncSymbol].then(response => {
        // success state.
        this.produce(s => {
          updater(s as S, () => ({
            state: 'success',
            response: response,
          }));
        });
      }, error => {
        // failure state.
        this.produce(s => {
          updater(s as S, () => ({
            state: 'failure',
            error: error,
          }));
        });
      });
    }

  };

  /**
   * Use state.
   */
  public use = <Select extends Selector<S, any> = (s: S) => S>(select?: Select, deps: React.DependencyList = []): ReturnType<Select> => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }

    if (typeof select === 'undefined') {
      select = ((s) => s) as Select;
    }

    const selectedRef = useRef<ReturnType<Select>>();
    const [, setVersion] = useState(() => 1);

    // Listen state changed.
    useIsomorphicEffect(() => {
      const updater = () => {
        const selected = select!(this.state);
        if (!equals(selected, selectedRef.current)) {
          selectedRef.current = selected;
          setVersion(v => v + 1)
        }
      };
      this.depends.push(updater);
      return () => {
        const idx = this.depends.indexOf(updater)
        if (idx >= 0) {
          this.depends.splice(idx, 1)
        }
      };
    }, []);

    // Listen deps changed.
    useMemo(() => {
      const selected = select!(this.state);
      if (!equals(selected, selectedRef.current)) {
        selectedRef.current = selected;
      }
    }, deps);

    return selectedRef.current!;
  }

  /**
   * Get state without including it in rendering dependencies.
   */
  public get = <Select extends Selector<S, any> = (s: S) => S>(select?: Select): ReturnType<Select> => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }

    if (typeof select === 'undefined') {
      select = ((s) => s) as Select;
    }
    return select(this.state);
  };

  /**
   * A produce function that supports nested update.
   */
  private produce = (updater: (s: Draft<S>) => void): void => {
    if (this.draft) {
      updater(this.draft);
      return
    }
    try {
      const newState = produce(this.state, s => {
        this.draft = s;
        updater(s);
        this.draft = undefined;
      });
      this.commit(newState);
    } catch (e) {
      this.draft = undefined;
      throw e;
    }
  };

  /**
   * Commit if state was changed.
   */
  private commit = (newState: S) => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }

    if (newState !== this.state) {
      this.state = newState;
      unstable_batchedUpdates(() => {
        this.depends.forEach(dep => {
          dep(this.state);
        });
      });
    }
  }
}

/**
 * @license https://github.com/streamich/fast-shallow-equal/blob/master/LICENSE
 */
const equals = (a: any, b: any) => {
  if (a === b) return true;
  if (!(a instanceof Object) || !(b instanceof Object)) return false;

  const keys = Object.keys(a);
  const length = keys.length;

  for (let i = 0; i < length; i++)
  if (!(keys[i] in b)) return false;

  for (let i = 0; i < length; i++)
  if (a[keys[i]] !== b[keys[i]]) return false;

  return length === Object.keys(b).length;
};

