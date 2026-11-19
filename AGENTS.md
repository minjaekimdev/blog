# 블로그 저장소 작업 지침

Astro 정적 블로그(minjaekim.blog). 글은 `src/content/posts/` 아래 마크다운으로 추가하며, 작성법은 README의 "글 쓰는 법"을 따른다.

## 썸네일 제작

아티클/회고 글에는 소셜 미리보기(OG 이미지)용 썸네일을 적용한다. 디자인은 기존 썸네일들과 통일해야 한다.

### 규격과 파일 규칙

- **규격: PNG 1200×630** (OG 이미지 표준). SVG은 카카오톡·트위터 등 일부 플랫폼이 `og:image`로 지원하지 않으므로 쓰지 않는다.
- 파일 위치/이름: `public/thumbnails/<글 슬러그>.png` — 영어 소문자 + 하이픈(예: `react-background-tradeoff.png`)
- 적용: 글 frontmatter에 `thumbnail: "/thumbnails/<글 슬러그>.png"` — `BaseLayout.astro`가 사이트 URL과 조합해 `og:image`로 변환한다.

### 디자인 템플릿 — `templates/thumbnail.html`

처음부터 그리지 말고 이 파일의 **제목·태그·날짜만 교체**해서 사용한다. 요소별 사양은 다음과 같다.

| 요소 | 사양 |
| --- | --- |
| 배경 | `#0a0d12` + 은은한 라디얼 그라디언트(`#131822`, 62% 42% 지점) |
| 브랜드(좌상단) | `M` 배지(`#6f76f2`, 46px, radius 12px) + `minjaekim.blog`(흰색, 27px/700) |
| 제목 | 78px / weight 800 / `letter-spacing: -0.02em`, 2~3줄로 줄바꿈, **핵심 단어 하나만 `#4d9dff`로 강조** |
| 태그 칩 | 글 frontmatter 태그 그대로. JetBrains Mono 22px/500, `#9fb8dc`, 테두리 `1.5px solid #3b4759`, pill radius, padding 10px 24px |
| 하단 메타 | `ARTICLE · <frontmatter date>` — JetBrains Mono 21px, `#6b7280`, letter-spacing 0.08em. 회고 글이면 `RETROSPECTIVE` |
| 폰트 | 블로그와 동일: `'Pretendard Variable', Pretendard, ...` + `'JetBrains Mono', ...` |

레이아웃 좌표(1200×630 기준): 브랜드 top 56 / 제목 top 172 / 칩 top 442 / 메타 top 550, 모두 left 84. **글 제목이 짧아도 칩·메타 위치는 고정**한다 — 썸네일 간 리듬을 맞추기 위함.

### 렌더링 절차

1. `templates/thumbnail.html`을 임시 디렉터리에 복사해 내용만 교체한다(저장소 파일은 오염시키지 않는다).
2. Chrome(DevTools MCP)에서 `file://`로 열고, **`resize_page`가 아니라 `emulate`의 viewport로 `1200x630x2`(deviceScaleFactor 2)를 지정**한다. `resize_page`는 창 크기 기준이라 뷰포트가 달라지는 부작용이 있었다(1440×780로 잡혀 콘텐츠가 좌상단에 몰린 적 있음).
3. 스크린샷을 PNG로 저장한다. 픽셀 크기가 **2400×1260**인지 확인한다(2배). 크기가 다르면 뷰포트 설정이 잘못된 것.
4. 축소 저장: `sips -z 630 1200 <파일> --out public/thumbnails/<슬러그>.png` — 2배로 캡처해 절반으로 줄이면 글자가 더 선명하다.
5. 완성된 PNG를 육안으로 확인하고, 기존 썸네일(예: `multiple-scroll-frame.png`)과 나란히 봤을 때 톤·비율이 같은지 비교한다.
6. frontmatter에 경로를 넣고 `npm run build`로 검증 후 커밋한다.
