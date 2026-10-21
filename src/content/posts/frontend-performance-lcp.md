---
title: '프론트엔드 성능 최적화 회고: LCP 4.2초에서 1.8초까지'
description: '서비스의 LCP가 4.2초였던 시절에서 1.8초까지 끌어올리기까지의 과정을 기록한다. 측정, 원인 진단, 그리고 실제로 효과가 있었던 개선들을 정리했다.'
date: 2026-10-18
category: 'article'
tags: ['성능', '웹']
thumbnail: /thumbnails/performance.svg
pinned: true
---

최근 운영하고 있는 서비스의 LCP(Largest Contentful Paint)가 모바일 기준 4.2초였다. Core Web Vitals 기준으로 나쁨 구간이며, 이탈률 지표와 함께 봤을 때 결코 무시할 수 없는 수준이었다. 이 글은 그 시간을 1.8초까지 줄이기까지의 과정을 기록한 회고다.

## 문제 상황

서비스는 React로 만들어진 SPA였고, 초기 진입 시 다음과 같은 특징이 있었다.

- 자바스크립트 번들이 압축 후 780KB
- 메인 비주얼 이미지가 2.1MB짜리 PNG
- 세 개의 웹 폰트를 전부 렌더링 차단 방식으로 로딩
- API 응답을 기다렸다가 히어로 섹션 렌더링

Chrome DevTools의 성능 패널과 실사용자 데이터(CrUX)를 함께 봤을 때, 문제는 명확하게 세 갈래로 나뉘었다.

## 원인 진단

### 어디서 시간을 쓰고 있나

`web-vitals` 라이브러리로 실사용자 지표를 수집하면서 attribution 정보를 함께 기록했다.

```ts
import { onLCP } from 'web-vitals';

onLCP((metric) => {
  // element, url, timeToFirstByte, resourceLoadDelay, resourceLoadDuration...
  sendToAnalytics('lcp', metric);
}, { reportAllChanges: true });
```

수집된 데이터를 보니 LCP 요소는 히어로 이미지였고, 병목은 다음과 같이 분해되었다.

| 단계 | 소요 시간 | 비고 |
| --- | --- | --- |
| TTFB | 0.6초 | CDN 미적용 구간 존재 |
| 리소스 로딩 지연 | 1.1초 | 이미지 `loading="lazy"`가 원인 |
| 리소스 로딩 | 1.8초 | 2.1MB PNG |
| 렌더 지연 | 0.7초 | 폰트 로딩으로 인한 블록 |

> 가장 흔한 실수가 여기서 나왔다. LCP 이미지에 `loading="lazy"`를 걸어둔 것. 뷰포트에 바로 보이는 이미지는 lazy가 아니라 eager + fetchpriority high여야 한다.

### 번들의 문제

자바스크립트는 초기 렌더에 필요한 것과 그렇지 않은 것이 뒤섞여 있었다. 특히 차트 라이브러리와 아이콘 세트가 전부 메인 청크에 포함되어 있었다.

## 무엇을 고쳤나

### 이미지

LCP 이미지를 AVIF/WebP로 변환하고, 반응형 `srcset`을 적용했다. 결정적으로 프리로드를 추가했다.

```html
<link
  rel="preload"
  as="image"
  href="/hero-1080.avif"
  imagesrcset="/hero-720.avif 720w, /hero-1080.avif 1080w"
  imagesizes="100vw"
  fetchpriority="high"
/>
```

### 자바스크립트 번들

라우트 기반 코드 스플리팅을 적용하고, 차트 라이브러리는 상호작용이 필요한 시점에 동적으로 가져왔다.

```ts
const Chart = lazy(() =>
  import('./Chart').then((m) => ({ default: m.Chart })),
);

// 차트는 뷰포트에 들어올 때만 로드
const ref = useRef<HTMLDivElement>(null);
const visible = useIntersection(ref);
```

그 결과 메인 청크는 780KB에서 310KB로 줄었다.

### 폰트

세 개의 웹 폰트를 서브셋으로 잘라 필요한 글자만 내리도록 했고, `font-display: swap`과 함께 폰트 프리로드를 적용했다. 국문 서브셋은 동적 서브셋(unicode-range 분할)이 특히 효과가 컸다.

## 결과

개선 후 4주간의 실사용자 지표는 다음과 같다.

- **LCP: 4.2초 → 1.8초** (p75, 모바일)
- 번들 크기: 780KB → 310KB
- 초기 렌더 차단 리소스: 3개 → 0개

## 배운 점

1. **측정 없는 최적화는 추측이다.** attribution 데이터가 원인을 정확히 가르쳐 줬다.
2. **가장 큰 효과는 보통 가장 단순한 수정에서 나온다.** lazy 속성 하나 제거로 1.1초가 줄었다.
3. 실사용자 지표와 실험실 지표를 함께 봐야 한다. 내 맥북은 세상의 어떤 갤럭시보다 빠르다.
