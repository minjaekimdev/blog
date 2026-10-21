---
title: 'React Server Components, 결국 무엇이 달라지나'
description: 'RSC는 새로운 문법이 아니라 렌더링이 일어나는 위치에 대한 새로운 약속이다. 서버 컴포넌트와 클라이언트 컴포넌트의 경계가 어디에 있고, 무엇을 고려해야 하는지 정리했다.'
date: 2026-10-05
category: 'article'
tags: ['React']
thumbnail: /thumbnails/rsc.svg
---

React Server Components(RSC)를 처음 접하면 "서버에서 도는 컴포넌트"라는 말이 오히려 혼란스럽다. SSR도 있는데 뭐가 또 서버인가 싶기 때문이다. 이 글에서는 RSC가 기존 렌더링 방식과 어떻게 다른지, 그리고 실무에서 무엇이 달라지는지를 정리한다.

## 왜 등장했나

클라이언트 중심의 React 앱에는 오래된 고민이 있었다.

- 데이터를 가져오려면 물 타워(waterfall)가 생긴다. 컴포넌트가 마운트된 뒤에야 요청이 시작되기 때문이다.
- 상태 관리, 데이터 페칭 라이브러리, Suspense 경계까지 클라이언트 번들에 들어가는 코드가 계속 늘어난다.
- 마크다운 파서처럼 무거운 라이브러리 하나를 쓰려면 그 비용을 전부 사용자의 기기가 치른다.

RSC는 이 문제를 "컴포넌트 일부는 아예 서버에서 실행되고, 결과만 클라이언트로 보낸다"로 푼다. 번들에는 그 컴포넌트의 코드가 아예 포함되지 않는다.

## 렌더링 위치의 변화

핵심은 **컴포넌트 트리를 두 부분으로 쪼갠다**는 것이다.

- **서버 컴포넌트**: 서버에서 실행. 결과(UI 조각)는 직렬화되어 클라이언트로 전달된다. `useState`를 쓸 수 없지만, 데이터베이스나 파일 시스템에 바로 접근할 수 있다.
- **클라이언트 컴포넌트**: 기존의 React 컴포넌트. 브라우저로 전송되어 하이드레이션된다.

```tsx
// ✅ 서버 컴포넌트 — 파일 최상단에 아무 표시도 없다
// 데이터베이스에 직접 접근하고, 이 코드는 번들에 포함되지 않는다.
import { db } from './db';

export default async function PostList() {
  const posts = await db.post.findMany();
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

```tsx
'use client';

// ✅ 클라이언트 컴포넌트 — 상호작용이 필요한 곳에만 최소한으로
import { useState } from 'react';

export function LikeButton({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  return <button onClick={() => setCount(count + 1)}>좋아요 {count}</button>;
}
```

## 'use client'의 의미

`'use client'`는 "이 파일이 클라이언트에서 실행된다"는 선언이자, **의존성 그래프의 경계**다.

중요한 규칙은 다음과 같다.

1. `'use client'` 파일에 import된 것은 전부 클라이언트 번들에 들어간다.
2. 서버 컴포넌트는 클라이언트 컴포넌트를 **자식으로** 넘길 수 있다 (`children` 패턴).
3. 클라이언트 컴포넌트에서 서버 컴포넌트를 import할 수는 없다.

```tsx
// 서버 컴포넌트
import { SearchInput } from './SearchInput'; // 'use client'

export default function Page() {
  // 서버에서 조회한 데이터를 그대로 props로 내려줄 수 있다
  const items = await fetchItems();
  return (
    <SearchInput>
      <ResultList items={items} />
    </SearchInput>
  );
}
```

`SearchInput`은 클라이언트 컴포넌트지만, 그 안으로 들어온 `children`(`ResultList`)은 서버에서 렌더링된다. 상호작용 껍데기와 콘텐츠를 분리하는 이 패턴이 RSC 설계의 절반을 차지한다.

## 데이터 페칭이 달라지는 지점

서버 컴포넌트에서는 `useEffect`와 `useQuery` 없이 그냥 `await`한다.

```tsx
export default async function Post({ id }: { id: string }) {
  const post = await getPost(id); // 서버에서 직접
  const comments = await getComments(id); // 컴포넌트마다 필요한 만큼

  return (
    <article>
      <h1>{post.title}</h1>
      <CommentList comments={comments} />
    </article>
  );
}
```

물 타워가 사라지는 이유는, 요청이 브라우저 → 서버 API → DB의 왕복이 아니라 서버 내부의 호출이 되기 때문이다. 캐싱 전략은 프레임워크의 캐시 계층(`fetch` 캐시, revalidation)으로 옮겨간다.

## 한계와 트레이드오프

RSC가 만능은 아니다.

- **상태를 가진 UI는 전부 클라이언트 컴포넌트다.** 결국 경계를 어디에 둘지가 설계의 핵심이며, 이것은 생각보다 자주 고민하게 된다.
- 서버와 클라이언트가 하나의 트리에 섞이면서 **"이 로직이 어디서 실행되지?"** 를 항상 의식해야 한다. 빌드 오류로 걸러지지 않는 실수(예: 서버 전용 모듈을 클라이언트에서 import)는 런타임에 드러난다.
- 백엔드 접근이 컴포넌트 안으로 들어오면서, 레이어 분리를 포기하면 나중에 도메인 로직이 UI에 스며들기 쉽다.

## 정리

RSC는 새로운 문법이 아니라 **렌더링이 일어나는 위치에 대한 새로운 약속**이다.

- 서버 컴포넌트: 데이터와 무거운 연산, 번들에 절대 포함되지 않음
- 클라이언트 컴포넌트: 상호작용, 상태, 브라우저 API
- `'use client'`는 경계선을 긋는 도구이고, 경계 설계가 곧 아키텍처다

도입 자체보다 "무엇을 서버에 남기고 무엇을 클라이언트로 보낼 것인가"라는 질문을 코드 수준에서 강제한다는 점이 진짜 변화다.
