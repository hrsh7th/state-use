# state-use

Simple state manager for React.

# Usage

First, You should define your state.

```tsx
// src/state/user.ts
import { define } from 'state-use';

const user = define<{
  id: number;
  nickname: string;
}>();

export { user };
```

Then you can initialize state.

```tsx
// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { user } from './state/user.ts';
import { App } from './state/component/App.tsx';

user.setup(...); // Setup default state (It can be used to fill server-side props).

ReactDOM.render((
  <App />
), document.querySelector('#app'));
```

Now, any component can be used the state.

```tsx
// src/component/User.tsx

import React from 'react';
import { user } from '../state/user';

export const User = () => {
  const nickname =  user.use(s => s.nickname);

  const onNicknameClick = useCallback(() => {
    user.draft.nickname = 'new nickname';
    user.commit();

    // The above code can be write to the below.
    user.update(s => s.nickname = 'new nickname');
  });

  return (
    <div onClick={onNicknameClick}>{nickname}</div>
  );
};
```

