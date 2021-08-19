import { createDraft, finishDraft } from 'immer';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const useIsomorphicEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type Context<S> = { state: S; };
export type Updater<S> = (ctx: Context<S>) => Generator<Promise<unknown>, unknown> | void;
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
   * Setup default state.
   */
  public setup = (state: S) => {
    this.hasSetup = true;
    this.state = state;
    this.context = {
      state: createDraft(this.state) as S
    };
  }

  /**
   * Update function.
   */
  public update = async (updater: Updater<S>): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }
    const gen = updater(this.context);
    if (gen && typeof gen.next === 'function' && typeof gen.throw === 'function') {
      return new Promise<void>((resolve, reject) => {
        const next = (gen: Generator<Promise<unknown>, unknown>, r: unknown, e: unknown): void => {
          this.commit();

          const current = typeof r !== 'undefined'
            ? gen.next(r)
            : typeof e !== 'undefined'
              ? gen.throw(e)
              : gen.next();
          if (current.done) {
            return resolve();
          }
          if (!(current.value instanceof Promise)) {
            return reject(new Error('The `updater` can only yield Promises.'));
          }
          current.value.then(
            r => next(gen, r, undefined),
            e => next(gen, undefined, e)
          );
        }
        next(gen!, undefined, undefined);
      }).then(r => {
        this.commit();
        return r;
      }, e => {
        this.commit();
        throw e;
      });
    } else {
      this.commit();
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
   * Commit if state was changed.
   */
  private commit = () => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }
    const newState = finishDraft(this.context.state) as S;
    this.context.state = createDraft(newState) as S;
    if (newState !== this.state) {
      this.state = newState;
      this.depends.forEach(dep => {
        dep(newState);
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

