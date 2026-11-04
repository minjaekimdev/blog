import type { CollectionEntry } from 'astro:content';

export interface TagGroup {
  /** 화면에 표시할 태그 이름 (표기법은 최신 글 기준, 예: 'TypeScript') */
  name: string;
  /** URL 조각으로 쓸 정규화된 값 (소문자, 예: 'typescript') */
  value: string;
  /** 이 태그가 붙은 글 목록 (최신순) */
  posts: CollectionEntry<'posts'>[];
}

/**
 * 모든 글의 태그를 모아 대소문자 구분 없이 그룹핑한다.
 * 예: 'react'와 'React'가 섞여 있어도 같은 태그로 묶이며,
 * 화면 표시는 최신 글에 쓰인 표기법을 따른다.
 *
 * 반환 배열은 태그별 글 수 내림차순 → 이름 오름차순으로 정렬된다.
 */
export function groupTags(posts: CollectionEntry<'posts'>[]): TagGroup[] {
  // 최신 글부터 훑어서 대표 표기법(대소문자)이 최신 글을 따르도록 한다.
  const sorted = [...posts].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  const map = new Map<string, TagGroup>();
  for (const post of sorted) {
    for (const tag of post.data.tags) {
      const value = tag.toLowerCase();
      const group = map.get(value);
      if (group) {
        group.posts.push(post);
      } else {
        map.set(value, { name: tag, value, posts: [post] });
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name)
  );
}

/** 태그 페이지 링크 href를 만든다. 한글 태그도 쓰므로 URL 인코딩이 필요하다. */
export function tagHref(value: string): string {
  return `/tags/${encodeURIComponent(value)}/`;
}
