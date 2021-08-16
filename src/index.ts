import { createDraft, Draft, finishDraft } from 'immer';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

const useIsomorphicEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type Updater<S> = (s: S) => void;
export type Selector<S, A = S> = (s: S) => A;

/**
 * Create state object.
 */
export function define<S>() {
  return new State<S>();
}

class State<S> {

  /**
   * You can modify it and then call `commit` to cause re-rendering.
   */
  public draft!: Draft<S>;

  /**
   * State has setup or not.
   */
  private hasSetup = false;

  /**
   * internal state object.
   */
  private state!: S;

  /**
   * A list of function to update component's local state.
   */
  private depends: Updater<S>[] = [];

  /**
   * Setup default state.
   */
  public setup = (state: S) => {
    this.hasSetup = true;
    this.state = state;
    this.draft = createDraft(state);
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

    updater(this.draft as S);
    this.commit();
  };

  /**
   * commit draft.
   */
  public commit = () => {
    if (process.env.NODE_ENV === 'development') {
      if (!this.hasSetup) {
        throw new Error('Required to call `setup` first.');
      }
    }

    const state = finishDraft(this.draft) as S
    this.draft = createDraft(state);

    if (state !== this.state) {
      this.state = state;
      unstable_batchedUpdates(() => {
        this.depends.forEach(dep => {
          dep(this.state);
        });
      });
    }
  }

  /**
   * use state.
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

