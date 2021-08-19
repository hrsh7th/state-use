# state-use

Simple state manager for React.

# Usage

### Setup

First, You should define your state.

```tsx
// src/state/user.ts
import { define } from 'state-use';

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
import { UserState } from './state/user.ts';
import { App } from './state/component/App.tsx';

UserState.setup({
  id: 0,
  nickname: 'hrsh7th',
  details: { state: 'default' },
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
    UserState.update(s => s.nickname = 'new nickname');
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
import { UserState } from '../state/user';

export const User = () => {
  const user = UserState.use();

  const onFetchButtonClick = useCallback(() => {
    UserState.update(function *(ctx) => {
      s.details.state = 'loading';
      try {
        s.details = {
          state: 'success',
          response: yield fetch(`https://example.com/users/${s.id}/details`).then(res => res.json())
        };
      } catch (e) {
        s.details = {
          state: 'failure',
          error: error
        };
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

