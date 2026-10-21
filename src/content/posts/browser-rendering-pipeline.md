---
title: '브라우저는 화면을 어떻게 그리는가'
description: 'DOM에서 픽셀까지, 브라우저 렌더링 파이프라인의 여섯 단계를 따라가 봅니다. reflow와 repaint가 왜 비싼지, 그리고 애니메이션은 왜 transform으로 만들어야 하는지 이해하게 됩니다.'
date: 2026-05-11
category: 'article'
tags: ['browser', 'performance', 'rendering']
thumbnail: '/thumbnails/browser-rendering.svg'
---

"웹사이트가 느리다"의 원인은 대부분 네트워크가 아니라 **메인 스레드**에 있다. 그리고 메인 스레드가 바쁜 이유를 이해하려면 브라우저가 화면을 그리는 과정을 알아야 한다.

## 렌더링 파이프라인의 여섯 단계

브라우저는 HTML과 CSS를 받은 뒤 대략 이런 순서로 화면을 그린다.

1. **파싱(Parsing)** — HTML을 DOM 트리로, CSS를 CSSOM 트리로 만든다.
2. **스타일(Style)** — 어떤 노드에 어떤 규칙이 적용되는지 계산한다.
3. **레이아웃(Layout)** — 각 요소의 위치와 크기를 계산한다.
4. **페인트(Paint)** — 텍스트, 이미지, 색상을 레이어에 그린다.
5. **컴포지트(Composite)** — 레이어들을 순서에 맞게 합쳐 최종 화면을 만든다.

중요한 사실은, **코드 한 줄이 바뀔 때마다 이 파이프라인 전체가 도는 게 아니라는 것**이다. 무엇이 바뀌었는지에 따라 돌아가는 구간이 달라진다.

## Reflow는 비싸다

레이아웃 속성(너비, 높이, 위치 등)이 바뀌면 어떻게 될까?

```js
// 나쁜 예: 프레임마다 레이아웃을 강제로 계산한다
element.style.width = '100px';  // 레이아웃 계산 발생
console.log(element.offsetHeight); // 레이아웃 다시 읽기 (강제 동기 레이아웃)
element.style.width = '200px';  // 또 레이아웃 계산
console.log(element.offsetHeight); // 또 읽기
```

레이아웃이 바뀌면 **그 아래에 있는 모든 요소의 위치가 다시 계산**된다. 최상위 요소의 높이 하나가 바뀌어도 페이지 전체가 영향받을 수 있다. 이것을 reflow(또는 layout thrashing)라고 부른다.

반면 색상이나 그림자처럼 위치에 영향을 주지 않는 속성은 페인트만 다시 하면 된다. 레이아웃 재계산이 없으므로 훨씬 싸다.

## transform과 opacity는 공짜에 가깝다

애니메이션을 만들 때 `top`/`left` 대신 `transform`을 쓰라는 조언을 들어본 적이 있을 것이다. 그 이유가 바로 여기 있다.

- `top`, `left` 애니메이션 → 매 프레임 **레이아웃 → 페인트 → 컴포지트** 전부 실행
- `transform`, `opacity` 애니메이션 → **컴포지트만** 실행. 메인 스레드를 거치지 않기도 한다.

```css
/* 나쁨: 매 프레임 레이아웃을 다시 계산 */
.box {
  transition: left 0.3s;
}

/* 좋음: 합성만으로 처리되어 부드럽다 */
.box {
  transition: transform 0.3s;
}
.box--moved {
  transform: translateX(100px);
}
```

## 실전 체크리스트

- 애니메이션은 `transform`과 `opacity`로 만든다.
- 읽기(`offsetHeight` 등)와 쓰기(`style` 변경)를 번갈아 하지 않는다. 읽기를 먼저 몰아서 하고 쓰기를 몰아서 한다.
- 큰 리스트에는 가상 스크롤(react-window 등)을 고려한다.
- 뭔가 느끼면 개발자 도구의 Performance 패널에서 **보라색(Layout) 막대**를 찾아보자. 그것이 reflow의 흔적이다.

## 마치며

브라우저의 렌더링은 생각보다 규칙적이다. "무엇이 바뀌었고, 그로 인해 파이프라인의 어디부터 다시 도는가"만 물을 줄 알아도 성능 문제의 절반은 스스로 진단할 수 있다. 다음에 느린 페이지를 만나면 그래프부터 열어보자.
