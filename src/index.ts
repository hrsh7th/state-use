import { createDraft, finishDraft, current } from 'immer';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

const useIsomorphicEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const isGenerator = (arg?: any): arg is Generator<Promise<unknown>, void, unknown> => {
  return arg && 'next' in arg && 'throw' in arg && typeof arg.next === 'function' && typeof arg.throw === 'function';
};

export type Context<S> = { state: S; };
export type Updater<S> = (ctx: Context<S>) => Generator<Promise<unknown>, void, unknown> | void;
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
  private context!: Context<S>;

  /**
   * A list of function to update component's local state.
   */
  private depends: ((s: S) => void)[] = [];

  /**
   * Current running state to avoid unneeded commit.
   */
  private running = false;

  /**
   * Setup default state.
   */
  public setup = async (state: S) => {
    this.hasSetup = true;
    this.context = {
      state: createDraft(state) as S
    };
    if (this.depends.length) {
      return Promise.resolve().then(() => {
        this.commit();
      });
    } else {
      this.commit();
    }
    return Promise.resolve();
  }

  /**
   * Update function.
   */
  public update = async (updater: Updater<S>) => {
    if (process.env.NODE_ENV !== 'production') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }
    if (this.running) {
      return this.resolve(updater(this.context));
    }

    this.running = true;
    const ret = updater(this.context);
    if (!isGenerator(ret)) {
      this.running = false;
      this.commit();
      return Promise.resolve();
    } else {
      return this.resolve(ret, true).then(() => {
        this.running = false;
      });
    }
  };

  /**
   * Use state.
   */
  public use = <Select extends Selector<S, any> = (s: S) => S>(select?: Select, deps: React.DependencyList = []): ReturnType<Select> => {
    if (process.env.NODE_ENV !== 'production') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }

    if (typeof select === 'undefined') {
      select = ((s) => ({ ...s })) as Select;
    }

    const selectedRef = useRef<ReturnType<Select>>();
    const [, setVersion] = useState(() => 1);

    // Listen state changed.
    useIsomorphicEffect(() => {
      const updater = (newState: S) => {
        const selected = select!(newState);
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
    if (process.env.NODE_ENV !== 'production') {
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
   * Run generator.
   */
  private resolve = async (gen: Generator<Promise<unknown>, void, unknown> | void, commit: boolean = false) => {
    if (!isGenerator(gen)) {
      if (commit) {
        this.commit();
      }
      return Promise.resolve();
    }

    await new Promise<void>((resolve) => {
      const next = async (gen: Generator<Promise<unknown>, void, unknown>, r: unknown, e: unknown): Promise<void> => {
        // Resume suspended generator.
        const current = typeof r !== 'undefined'
          ? gen.next(r)
          : typeof e !== 'undefined'
            ? gen.throw(e)
            : gen.next();

        // Resolve promise with current state when generator has done.
        if (current.done) {
          return resolve();
        }

        // Wait for promise and then run next.
        this.commit();
        return Promise.resolve(current.value).then(
          r => {
            return next(gen, r, undefined)
          },
          e => {
            return next(gen, undefined, e)
          }
        );
      };

      // First run.
      next(gen, undefined, undefined);
    });
    this.commit();
  };

  /**
   * Commit if state was changed.
   */
  private commit = () => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }
    const newState = current(this.context.state);
    if (newState !== this.state) {
      if (process.env.NODE_ENV !== 'production') {
        finishDraft(this.context.state);
      }
      this.context.state = createDraft(newState) as S;
      unstable_batchedUpdates(() => {
        this.state = newState;
        this.depends.forEach(dep => {
          dep(newState);
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

