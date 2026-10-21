---
title: 'Astro로 블로그를 다시 만들었습니다'
description: '수년간 묵혀둔 블로그를 Astro로 새로 지었습니다. 왜 다시 만들었고, 왜 Astro였는지, 그리고 어떤 구성으로 만들었는지 정리한 첫 글입니다.'
date: 2026-09-14
category: 'article'
tags: ['astro', 'blog', 'frontend']
thumbnail: '/thumbnails/astro-blog.svg'
pinned: true
---

블로그를 다시 만들었다. 다시 만들었다는 말이 꽤나 무책임하게 들리지만, 개발자의 블로그는 늘 그렇다. 글을 쓰는 것보다 블로그를 고치는 일이 더 재미있어서, 어느 순간 글은 없고 코드만 성장해 있는 상황이 된다.

이번에는 블로그를 고치는 시간을 최소화하고 글을 쓰는 시간을 늘리는 것을 목표로 삼았다. 그래서 선택한 것이 Astro다.

## 왜 Astro인가?

 Astro를 선택한 이유는 단순하다. **기본이 정적 사이트라는 점**과 **콘텐츠 중심 사이트에 최적화되어 있다는 점** 때문이다.

- 글은 마크다운으로 관리하고, 빌드 시점에 HTML로 변환된다. 방문자는 자바스크립트 없이도 글을 읽을 수 있다.
- 코드 하이라이팅(Shiki)이 내장되어 있어 별도 설정 없이 예쁜 코드 블록을 얻는다.
- 프레임워크를 섞을 필요가 없다. 필요하면 나중에 React나 Svelte 섬(Island)을 얹으면 된다.

블로그라는 콘텐츠에 가장 최적화된 구조이며, 성능도 기본적으로 좋다. Lighthouse 점수를 위해 밤을 새울 일이 없다.

## 콘텐츠 컬렉션

Astro 5의 콘텐츠 컬렉션은 글의 메타데이터를 타입으로 강제할 수 있어 마음에 든다. `src/content.config.ts`에 스키마를 정의한다.

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(['article', 'retrospective']),
    tags: z.array(z.string()).default([]),
    thumbnail: z.string().optional(),
  }),
});

export const collections = { posts };
```

이제 `date` 필드에 오타를 넣거나 `category`에 엉뚱한 문자열을 넣으면 빌드가 실패한다. 블로그의 모든 글이 같은 규칙을 따른다는 것이 코드로 보장되는 셈이다.

## 마크다운 한 편이 곧 페이지 하나

글은 `src/content/posts` 아래에 마크다운 파일로 쌓는다. 파일명이 곧 URL이 된다.

```md
---
title: '글 제목'
description: '요약'
date: 2026-09-14
category: 'article'
tags: ['frontend']
---

본문은 마크다운으로 작성한다.
```

동적 라우트는 `getStaticPaths`로 생성한다. 빌드 시점에 모든 글의 페이지가 만들어진다.

```ts
export async function getStaticPaths() {
  const posts = await getCollection('posts');
  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}
```

## 마치며

블로그를 다시 만드는 데 걸린 시간은 주말 이틀 정도였다. 이제 남은 일은 딱 하나, 꾸준히 글을 쓰는 것이다. 다음 글은 이 블로그의 기능을 하나씩 붙여가는 과정을 적어볼 생각이다.
