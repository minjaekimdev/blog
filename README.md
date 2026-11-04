# minjae.dev — 김민재 개발 블로그

kciter.so 스타일을 참고해 만든 [Astro](https://astro.build) 기반 개발자 블로그입니다.

## 시작하기

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 정적 빌드 → dist/
```

## 구성

| 경로 | 설명 |
|---|---|
| `src/content/posts/` | 마크다운 글 (파일명 = URL) |
| `src/content.config.ts` | 글 frontmatter 스키마 |
| `src/components/` | 헤더/푸터/목록/목차/댓글 위젯 등 |
| `src/pages/` | 홈, 아티클, 회고, 글 상세, 소개, RSS |

## 글 쓰는 법

`src/content/posts/` 아래에 마크다운 파일을 추가합니다.

```md
---
title: '글 제목'
description: '목록에 표시될 요약'
date: 2026-10-21
category: 'article'        # article(아티클) 또는 retrospective(회고)
tags: ['tag1', 'tag2']
thumbnail: '/thumbnails/파일.svg'   # 선택
pinned: true               # 선택 — 홈 최상단 '고정된 글' 섹션에 표시
draft: true                # 선택 — true면 빌드에서 제외
---

본문 (마크다운)
```

### 이미지 & 캡션

이미지 파일은 `public/images/` 아래에 넣고, 본문에서는 `/`부터 시작하는 절대경로로 참조합니다. 파일명은 영어 소문자 + 하이픈을 권장합니다. (예: `detached-dom.png`)

```md
![대체 텍스트](/images/파일명.png)
```

캡션을 달 때는 `<figure>` + `<figcaption>`을 사용합니다. HTML 블록 안에서는 마크다운 이미지 문법(`![]()`)이 해석되지 않으므로, 이미지도 `<img>` 태그로 작성해야 합니다.

```html
<figure>
  <img src="/images/파일명.png" alt="대체 텍스트" />
  <figcaption>그림 1. 이미지에 대한 설명</figcaption>
</figure>
```

캡션은 가운데 정렬된 작은 회색 글씨로 표시됩니다. (스타일: `global.css`의 `.prose figcaption`)

## 댓글/좋아요 (Giscus)

GitHub 로그인으로 댓글을 달고 ❤️ 리액션(좋아요)을 남길 수 있습니다.
활성화 방법은 `.env.example` 파일의 안내를 따라 `.env`를 만들면 됩니다.

1. 블로그를 **공개** GitHub 저장소에 푸시
2. 저장소 **Settings → Discussions** 활성화
3. [github.com/apps/giscus](https://github.com/apps/giscus) 설치
4. [giscus.app/ko](https://giscus.app/ko)에서 `GISCUS_REPO_ID`, `GISCUS_CATEGORY_ID` 발급 → `.env`에 입력
5. 카테고리는 **Announcements** 권장 (관리자만 새 Discussion 생성 가능 → 스팸 방지, 답글은 누구나 가능)

관리자(김민재)는 독자 댓글에 자유롭게 답글을 달 수 있습니다 — 블로그 위젯이나 GitHub Discussions에서 모두 가능합니다.

## 배포 전 확인

- `astro.config.mjs`의 `site` 값을 실제 도메인으로 변경
- `.env.example`을 참고해 `.env` 작성 (커밋 금지)
