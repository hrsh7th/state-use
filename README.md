# state-use

Simple state manager for React.

# Usage

### Setup

First, You should define your state.

```tsx
// src/state/user.ts
import { define } from 'state-use';

// async helpers.
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
export const Async = {
  default: () => ({ state: 'default' } as const),
  loading: () => ({ state: 'loading' } as const),
  success: <R extends unknown>(r: R) => ({ state: 'success', response: r } as const),
  failure: <E extends unknown>(e: E) => ({ state: 'failure', error: e } as const),
};

export const UserState = define<{
  id: number;
  nickname: string;
  details: Async<{ birthday: string; }, unknown>;
}>();
```

Then you can initialize state.

```tsx
// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { UserState, Async } from './state/user.ts';
import { App } from './state/component/App.tsx';

UserState.setup({
  id: 0,
  nickname: 'hrsh7th',
  details: Async.default(),
}); // Setup default state (It can be used to fill server-side props).

ReactDOM.render((
  <App />
), document.querySelector('#app'));
```

### Basic read/write state

```tsx
// src/component/User.tsx

import React from 'react';
import { UserState } from '../state/user';

export const User = () => {
  const nickname = UserState.use(s => s.nickname);

  const onNicknameClick = useCallback(() => {
    UserState.update(ctx => {
      ctx.state.nickname = 'new nickname';
    });
  });

  return (
    <div onClick={onNicknameClick}>{nickname}</div>
  );
};
```

### Async read/write state

The `state-use` handles async operation via Generator Function.

```tsx
// src/component/User.tsx

import React from 'react';
import { UserState, Async } from '../state/user';

export const User = () => {
  const user = UserState.use();

  const onFetchButtonClick = useCallback(() => {
    // Warning: You must use `ctx.state` directly. You can't save `ctx.state` as another variable.
    UserState.update(function *(ctx) => {
      ctx.state.details = Async.loading();
      try {
        ctx.state.details = Async.success(yield fetch(`https://example.com/users/${s.id}/details`).then(res => res.json()));
      } catch (e) {
        ctx.state.details = Async.failure(e);
      }
    });
  });

  return (
    <div onClick={onFetchButtonClick}>fetch details</div>
    {user.details.state === 'default' && (
      <div>
        {user.details.state === 'loading' ? (
          'Loading...'
        ) : user.details.state === 'success' ? (
          <UserDetails details={user.details.response} />
        ) : (
          'Error...'
        )}
      </div>
    )}
  );
};
```

