---
title: "가상 스크롤의 주인공은 rAF가 아니다"
description: "고정 높이 가상 리스트를 구현하며 브라우저 작동 원리 알아보기"
date: 2026-10-29
category: "article" # article(아티클) 또는 retrospective(회고) 둘 중 하나만 가능
pinned: true
tags:
  ["event loop", "task queue", "requestAnimationFrame", "frontend", "browser"]
---

※ 이 글은 고정 높이 가상 리스트를 구현하며 학습한 내용을 담고 있습니다. 구현에 사용된 전체 코드는 [virtual-list-optimization](https://github.com/minjaekimdev/virtual-list-optimization) 저장소에서 볼 수 있다.

## 배경: 왜 카드 10만 장을 한꺼번에 그리면 안 될까?

카드 10만 장을 리스트로 보여준다고 해보자. 가장 단순한 방법은 전부 DOM으로 만드는 것이다.

<figure>
  <img src="/images/naive-render.png" alt="클릭 하나로 6초가 넘는 롱 태스크와 긴 레이아웃 작업이 기록된 성능 프로파일" />
  <figcaption>카드 10만 개를 한 번에 렌더링했을 때의 성능 프로파일 — 클릭 하나가 6초가 넘는 롱 태스크가 되고, 레이아웃 계산에 수 초가 소요된다</figcaption>
</figure>

하지만 DOM 노드 하나는 그 자체로 비용이다. 생성 비용, 메모리, 브라우저가 스타일과 레이아웃을 계산할 때 훑어야 할 트리의 크기까지 전부 늘어난다. 실제로 카드 10만 개를 한 번에 렌더링하면 초기 화면까지 수 초가 걸리고, 이후 모든 스타일·레이아웃 계산이 그 무거운 트리 위에서 돌게 된다.

<figure>
  <img src="/images/virtual-list-concept.png" alt="전체 10만 장 중 DOM에는 보이는 7장만 존재한다는 가상 리스트 개념도" />
</figure>

그런데 정작 사용자가 실제로 보는 것은 화면 높이에 해당하는 카드 몇 장뿐이다. "**보이는 부분만 그리고, 나머지는 빈 공간으로 대체하면 되지 않을까?**" — 이것이 가상 리스트(윈도잉, Windowing)의 핵심 아이디어이다.

## 구현하기

### spacer: 전체 카드 높이에 해당하는 스크롤바 만들기

스크롤은 콘텐츠의 높이에서 나온다. 그런데 가상 리스트는 전체 카드 중 극히 일부만 DOM에 존재하므로, 그대로는 스크롤 자체가 불가능하다.

따라서 **전체 카드 길이만큼의 빈 공간**(`spacer`)을 만들어 스크롤바의 길이를 진짜처럼 속여야 한다. 카드 높이가 모두 120px(카드 112px + 간격 8px)로 같다면 `spacer`의 높이는 `전체 개수 × 120px`으로 계산할 수 있다.

```js
const spacer = document.createElement("div");
spacer.className = "spacer";
spacer.style.height = `${items.length * ITEM_HEIGHT}px`;
viewport.innerHTML = "";
viewport.appendChild(spacer);
```

### render: 현재 화면과 DOM 동기화하기

이제 스크롤할 때마다 지금 화면에 보여야 할 카드를 계산해서 DOM과 동기화해 주는 `render` 함수를 작성한다.

우선 `scrollTop`과 현재 뷰포트의 `clientHeight`를 바탕으로 DOM에 존재해야 할 카드의 인덱스를 구한다.

```js
// (1) 읽기 — 맨 앞에서 몰아서
const scrollTop = viewport.scrollTop;
const viewHeight = viewport.clientHeight;

// (2) 계산 — 그려야 할 범위
const first = Math.floor(scrollTop / ITEM_HEIGHT);
const start = Math.max(0, first - OVERSCAN);
const end = Math.min(
  items.length,
  first + Math.ceil(viewHeight / ITEM_HEIGHT) + OVERSCAN,
);
```

여기서 `OVERSCAN`은 화면 위아래로 여유 있게 더 그려 두는 카드 수다. 이 값이 왜 필요한지는 뒤에서 다룬다.

구한 범위에서 벗어난 카드는 DOM에서 제거하고, 아직 없는 카드는 생성해서 DOM에 추가한다. 이때 그려진 카드를 인덱스로 추적하기 위해 `Map`을 활용한다. 키는 카드 인덱스, 값은 DOM 요소다.

```js
const rendered = new Map();
```

```js
// 범위에서 벗어난 카드는 DOM에서 제거
rendered.forEach((value, key) => {
  if (key < start || key >= end) {
    value.remove();
    rendered.delete(key);
  }
});

// 범위 안에서 아직 없는 카드를 생성
for (let i = start; i < end; i++) {
  if (rendered.has(i)) continue;
  const card = createCard(items[i], i);
  card.classList.add("card--fixed");
  card.style.top = `${i * ITEM_HEIGHT}px`;
  rendered.set(i, card);
  spacer.appendChild(card);
}
```

여기서 중요한 점은, 범위를 벗어난 카드를 제거할 때 `value.remove()`뿐 아니라 `rendered.delete(key)`도 함께 호출했다는 점이다. 그 이유는 뒤에서 다룬다.

### 스크롤 이벤트 핸들러 작성하기

이제 `scroll` 이벤트가 발생했을 때 실행될 이벤트 핸들러를 작성한다.

`requestAnimationFrame`과 `flag`를 활용해 한 프레임에 하나의 이벤트 핸들러만 실행되도록 제어한다.

```js
let flag = false;
const onScroll = () => {
  if (flag === true) return;
  flag = true;
  requestAnimationFrame(() => {
    flag = false;
    render(); // render() 실행 도중 이벤트 핸들러는 실행될 수 없음
  });
};
```

구현은 생각보다 간단해 보이지만, 이 짧은 코드 안에는 브라우저의 여러 원리가 숨어 있다. 컴포지터의 동작 방식, 이벤트의 실행 시점, 그리고 DOM이 메모리에서 사라지는 조건이 모두 얽혀 있다. 지금부터 하나씩 살펴본다.

## 컴포지터는 메인 스레드와 독립적이다

앞서 작성한 `render` 함수는 화면 바깥쪽으로 `OVERSCAN`만큼 여유를 두고 카드 범위를 계산했다. 이 여유가 필요한 이유는 스크롤이 실제로 처리되는 과정에 있다.

스크롤과 같은 **사용자 제스처는 렌더러 프로세스 내의 컴포지터 스레드에서 우선적으로 감지한다.** 컴포지터 스레드는 오프셋이 바뀌자마자 이미 그려 둔 레이어 타일을 위로 밀어올려 새 프레임을 만들어 화면에 반영한다. 이 작업은 메인 스레드와 완전히 독립적이기 때문에, 메인 스레드가 JS로 바쁘게 돌고 있어도 화면은 멈추지 않고 스크롤된다.

반면 새 콘텐츠를 만드는 일은 메인 스레드의 몫이다. 컴포지터는 새 오프셋을 메인 스레드에 통지하고, 메인 스레드는 다음 프레임 처리 과정의 초반(rAF 콜백보다도 먼저)에 `scroll` 이벤트를 발행해 우리가 등록한 핸들러를 실행한다. 이 흐름을 타임라인으로 나타내면 다음과 같다.

```
t=0     컴포지터    : 이미 그려 둔 타일을 즉시 위로 이동 → 화면은 움직였다
t=0+    메인 스레드 : 프레임 작업 시작 → scroll 이벤트 발행
t=0+α   핸들러      : 새 카드 render() → 스타일 → 레이아웃 → 페인트 → 커밋
t=0+β   컴포지터    : 새로 그려진 타일로 화면 교체 → 빈 영역 해소
```

**핵심은 컴포지터와 메인 스레드 사이에 구조적인 시차(β)가 존재한다는 점이다.** 이 시차 동안 새로 노출된 영역에는 그릴 것이 없다.

`OVERSCAN`은 바로 이 시차를 메우기 위한 장치다. 컴포지터가 타일을 밀어올리는 동안에는 화면 밖에 미리 그려 둔 카드가 대기하고 있으므로, 빈 영역 대신 그 카드가 노출된다.

## DOM을 제거하고 싶다면 모든 참조를 끊어주어야 한다

`render` 함수는 범위를 벗어난 카드를 제거할 때 다음과 같이 두 단계를 거친다.

```js
if (key < start || key >= end) {
  value.remove();        // DOM 트리에서 떼어낸다
  rendered.delete(key);  // Map에서도 제거한다
}
```

DOM에서는 이미 떼어냈는데 왜 `Map`에서도 지워야 할까? 이 질문에 답하려면 브라우저가 DOM 노드를 메모리에 어떻게 보관하고 언제 버리는지 알아야 한다.

`createCard`는 내부에서 `document.createElement`로 요소를 생성한다. 이때 메모리에는 두 가지가 생긴다. 자바스크립트 힙 위의 JS wrapper 객체와, C++ 힙 위의 실제 DOM 객체다. 두 객체는 서로를 직접 참조하는 한 쌍으로 존재한다. 렌더러 프로세스의 메모리는 역할이 다른 두 개의 힙으로 나뉘고, 카드 하나는 두 힙에 걸쳐 있는 한 쌍(wrapper ↔ DOM 노드)이다.

<figure>
  <img src="/images/js-dom-two-heaps.png" alt="자바스크립트 힙(V8)과 C++ 힙(Blink)에 걸친 카드의 참조 구조 도식" />
  <figcaption>카드 하나는 두 힙에 걸친 한 쌍으로 존재한다</figcaption>
</figure>

`spacer.appendChild(card)`를 실행하면 연결고리가 하나 더 생긴다. `spacer`의 자식 목록에 카드가 추가되는 것이다. 정리하면 카드는 두 간선에 매달려 있는 상태다.

1. **자바스크립트 쪽 간선** — `rendered`(`Map`)가 카드의 wrapper를 참조한다.
2. **DOM 트리 쪽 간선** — `spacer`가 카드를 자식으로 참조한다.

브라우저의 가비지 컬렉터는 객체를 버릴지 판단할 때 도달 가능성을 기준으로 삼는다. 전역 객체 같은 루트에서 참조를 따라가 닿을 수 있는 객체는 살리고, 닿을 수 없는 객체는 수거 대상으로 분류한다. 문제는 카드처럼 두 힙에 걸친 쌍이다. 생존 여부를 한쪽 힙만으로 판단할 수 없기 때문에 Chrome은 자바스크립트 힙에서 출발해 C++ DOM까지 왕복하며 도달 가능성을 추적하는 방식을 사용한다. Chrome 57부터 도입된 방식이다.

이제 두 호출이 각각 어떤 간선을 끊는지 대조해 보자.

- `value.remove()` — 카드를 부모(`spacer`)의 자식 목록에서 떼어낸다. DOM 트리 쪽 간선이 사라진다.
- `rendered.delete(key)` — `Map`에서 해당 엔트리를 제거한다. 자바스크립트 쪽 간선이 사라진다.

문제는 wrapper와 카드 DOM이 서로를 참조하는 한 쌍이라는 점이다. **간선 하나만 끊어서는 쌍 전체가 살아남는다.**

<figure>
  <img src="/images/detached-dom.png" alt="Detached DOM 객체가 수거되지 않고 남아 있는 힙 스냅샷" />
  <figcaption><code>remove()</code>만 호출하고 <code>Map</code> 참조를 끊지 않았을 때의 힙 스냅샷</figcaption>
</figure>

- `remove()`만 호출한 경우: 자바스크립트 쪽 간선(`Map` → wrapper → 카드 DOM)이 남는다. 트리에서는 떨어져 나왔지만 여전히 도달 가능하므로 수거되지 않는다. 힙 스냅샷에서 "Detached DOM"으로 보이는 상태가 바로 이것이다.
- `delete()`만 호출한 경우: DOM 트리 쪽 간선(`spacer` → 카드)이 남는다. 자바스크립트에서 다시 찾을 수 없게 되었을 뿐, 노드는 여전히 트리에 붙어 살아 있다.

두 간선을 모두 끊어야 비로소 카드는 어느 쪽 루트에서도 도달할 수 없게 되고, 쌍 전체가 수거된다. 그래서 `remove()`와 `delete()`는 함께 호출해야 한다.

## 진짜 주인공은 rAF가 아니다

### 브라우저의 프레임 주기와 타이머의 한계

rAF(requestAnimationFrame)를 이해하려면 먼저 브라우저가 화면을 그리는 주기를 알아야 한다. 디스플레이는 주사율에 맞춰 화면을 갱신하는데, 일반적인 디스플레이의 주사율은 60fps, 즉 1초에 60번이다. 따라서 브라우저는 16.6ms 안에 한 프레임의 모든 작업을 끝내야 하고, 조금이라도 초과하면 그 프레임은 화면에 반영되지 못하고 버려진다. 스타일 계산부터 레이아웃, 페인트까지 프레임을 새로 만드는 작업은 대부분 이 메인 스레드에서 이뤄진다.

rAF가 등장하기 전에는 화면을 움직이거나 애니메이션을 만들 때 `setInterval`이나 `setTimeout`을 사용했다. 하지만 이 방식에는 세 가지 구조적인 문제가 있다.

1. **브라우저의 렌더링 주기와 불일치**: `setInterval(fn, 16)`은 브라우저의 렌더링 주기와 아무런 연동이 없다. 두 주기가 엇박자를 내면 어떤 프레임은 갱신 기회를 놓치고, 이로 인해 프레임이 누락되는 버벅임이 발생한다.
2. **불필요한 리소스 낭비**: 사용자가 다른 탭으로 이동하거나 창을 최소화해도 `setInterval`은 계속 코드를 실행해 CPU·GPU 자원을 낭비한다.
3. **타이머의 정확성 문제**: 자바스크립트의 이벤트 루프 특성상 `setTimeout`이나 `setInterval`은 지정한 시간에 정확히 실행된다는 보장이 없다. 메인 스레드가 다른 무거운 작업으로 바쁘면 타이머가 밀리고, 애니메이션은 뚝뚝 끊긴다.

<figure>
  <img src="/images/setTimeout-frame-bad-annotated.png" alt="setTimeout vs rAF 성능 프로파일" />
  <figcaption>setTimeout vs rAF 성능 프로파일</figcaption>
</figure>

실제로 `setTimeout`과 rAF로 애니메이션을 만들어 비교해 보면 차이가 눈에 보인다. `setTimeout` 쪽은 버벅이지만 rAF 쪽은 부드럽게 움직인다. 주기를 20ms로 바꾸면 이 차이는 더욱 커진다.

<iframe
  src="/demos/interval-vs-raf.html"
  sandbox="allow-scripts"
  title="setInterval vs requestAnimationFrame 비교 데모"
  width="100%"
  height="480"
  style="border:1px solid #dee2e6; border-radius:8px; margin:24px 0;"
></iframe>
<script src="/demos/iframe-fit.js"></script>

### rAF는 지연을 해결하지 않는다

그러나 rAF는 콜백의 실행 시점을 렌더링 직전으로 옮겨줄 뿐, 같은 프레임 안에서의 중복 실행을 막아주지는 않는다. 다음 코드를 보자.

```js
const onScroll = () => {
  requestAnimationFrame(() => {
    render();
  });
};
```

이 코드는 `render()`를 다음 프레임의 렌더링 직전으로 예약한다. 하지만 한 프레임 안에서 `scroll` 이벤트가 여러 번 발생하면 그 횟수만큼 rAF 예약이 쌓이고, 결국 같은 프레임 안에서 `render()`가 여러 번 실행된다. 실행 시점이 뒤로 미뤄졌을 뿐 실행 횟수는 그대로다.

그래서 rAF에 `flag`를 조합한다. **rAF가 실행 시점을 프레임에 맞춰주는 동안, `flag`는 '이번 프레임에 이미 예약이 걸렸는지'를 확인해 중복 실행을 잠가주는 역할을 한다.**

```js
let flag = false;
const onScroll = () => {
  if (flag === true) return;
  flag = true;
  requestAnimationFrame(() => {
    flag = false;
    render(); // 이번 프레임에 단 한 번만 실행됨
  });
};
```

이벤트가 한 프레임 안에서 여러 번 발생할 수 있는 상황에서는, rAF는 `flag`와 함께 쓰일 때 비로소 제 역할을 한다. 아래 데모로 직접 확인해 볼 수 있다.

데모의 핵심 코드다. `onScrollNoGuard`는 rAF만 사용한 버전, `onScrollWithFlag`는 flag를 조합한 버전으로 데모의 두 카드가 하나씩 사용하며, `render()`는 실행될 때마다 카운터를 1씩 올리는 함수로 단순화했다. flag가 없는 쪽은 한 프레임에 여러 번 호출되면 그 횟수만큼 `render()`가 그대로 실행되므로, 카운터 차이에서 중복 실행을 바로 확인할 수 있다. 

```js
let times = 5;
let leftCount = 0, rightCount = 0;

// ---------- 섹션의 코드와 동일한 두 구현 ----------
// (1) rAF만 사용: 호출 횟수만큼 예약이 쌓인다
const onScrollNoGuard = () => {
  requestAnimationFrame(() => renderNoGuard());
};

// (2) rAF + flag: 이번 프레임에 이미 예약됐으면 무시한다
let flag = false;
const onScrollWithFlag = () => {
  if (flag === true) return;
  flag = true;
  requestAnimationFrame(() => {
    flag = false;
    renderFlag();
  });
};

// ---------- render(): 여기서는 카운터 증가가 전부다 ----------
function renderNoGuard() {
  leftCount++;
  els.countLeft.textContent = leftCount;
  pulse(els.cardLeft);
}
function renderFlag() {
  rightCount++;
  els.countRight.textContent = rightCount;
  pulse(els.cardRight);
}

function pulse(card) {
  card.classList.remove('pulse');
  void card.offsetWidth; // 리플로우를 강제해 애니메이션을 처음부터 다시 재생
  card.classList.add('pulse');
}

// ---------- 버튼 동작 ----------
els.fire.addEventListener('click', () => {
  const beforeLeft = leftCount, beforeRight = rightCount;

  // 같은 태스크에서 동기 호출 → 전부 "같은 프레임"에 속한다.
  // (실제 scroll 이벤트가 아니므로 브라우저의 이벤트 병합도 개입하지 않는다)
  for (let i = 0; i < times; i++) onScrollNoGuard();
  for (let i = 0; i < times; i++) onScrollWithFlag();

  // 이 rAF는 두 카드의 콜백보다 늦게 등록됐으므로, 같은 프레임의 맨 마지막에 실행된다.
  // → 이번 프레임에 각각 몇 번 실행됐는지 정확히 집계할 수 있다.
  requestAnimationFrame(() => {
    const dLeft = leftCount - beforeLeft;
    const dRight = rightCount - beforeRight;
    showResult(dLeft, dRight);
  });
});
```

<iframe
  src="/demos/raf-duplicate-run.html"
  sandbox="allow-scripts"
  title="rAF 중복 실행 비교 데모"
  width="100%"
  height="560"
  style="border:1px solid #dee2e6; border-radius:8px; margin:24px 0;"
></iframe>
<script src="/demos/iframe-fit.js"></script>

이처럼 rAF가 정리해 주는 것은 어디까지나 **콜백이 실행되는 시점**까지고, 렌더링 단계 안에서 코드가 무엇을 하는지는 여전히 개발자의 몫이다.

예를 들어 rAF 콜백 안에서라도 레이아웃 값을 읽고(`offsetHeight` 등) 스타일을 쓰는 작업을 번갈아 반복하면, 읽을 때마다 레이아웃을 강제로 다시 계산하는 <strong>레이아웃 스레싱(layout thrashing)</strong>이 발생해 16.6ms 예산을 쉽게 초과한다. 실행 시점이 아무리 정확해도 작업량이 예산을 넘으면 프레임은 떨어진다.

즉 rAF는 '언제 실행할지'만 정해줄 뿐 '한 프레임에서 얼마나 비싼 일을 하는지'는 줄여주지 않는다. 프레임 예산 안에 들어서려면 결국 프레임마다 다뤄야 할 작업량 자체를 줄여야 하고, 그 역할을 하는 것이 바로 가상화다.

### 브라우저는 스크롤 이벤트를 프레임당 한 번으로 모은다

흥미로운 점은, 이 rAF + `flag` 패턴을 쓰지 않아도 스크롤 핸들러는 프레임당 한 번만 실행된다는 것이다. 브라우저는 메인 스레드에서의 과도한 이벤트 호출을 줄이기 위해 `scroll`처럼 연속적으로 발생하는 이벤트(`wheel`, `mousemove`, `pointermove`, `touchmove` 등)를 병합하고, 다음 `requestAnimationFrame` 직전까지 전달을 지연하기 때문이다.

실제로 `render` 함수 안에 타임스탬프를 기록하며 빠르게 스크롤해 보면, 핸들러가 프레임 간격(16.6~16.7ms)으로 한 번씩 실행되는 것을 확인할 수 있다.

<figure>
  <img src="/images/render-timestamp.png" alt="약 16.5ms 간격으로 기록된 render 함수의 타임스탬프 로그" />
  <figcaption>빠르게 스크롤해도 <code>render</code> 로그는 약 16.5ms(프레임 주기) 간격으로 한 번씩 기록된다 — 브라우저가 스크롤 이벤트를 프레임당 한 번으로 모아 주기 때문이다</figcaption>
</figure>

스크롤 핸들러가 왜 렌더링 직전에 실행되는지는 메인 스레드의 한 사이클을 따라가 보면 명확해진다.

```
① 태스크 큐에서 태스크 하나를 꺼내 실행
│    ★ 일반 스크립트
│      (click 핸들러, setTimeout 콜백, 네트워크 응답,
│       HTML 파서, 이벤트 핸들러...)
│
│ ② 마이크로태스크 체크포인트
│    (Promise.then, MutationObserver — 태스크 끝나자마자)
│
│ ③ 렌더링 기회가 있으면 → update the rendering
│     ├ resize steps
│     ├ run the scroll steps   (scroll 핸들러 = 스크립트)
│     ├ evaluate media queries
│     ├ update animations and send events
│     ├ fullscreen steps
│     ├ run the animation frame callbacks (rAF = 스크립트)
│     └ transition steps
│         → 렌더링 갱신 (style → layout → paint)
│           ★ 이 부분은 브라우저 내부 작업
│
│ ④ 다음 태스크로… (반복)
```

`update the rendering` 단계는 렌더링 기회가 있을 때 브라우저의 프레임 주기에 맞춰 실행되며, 여기에는 스크롤 핸들러 실행이 포함되어 있다. 즉 **rAF를 사용하지 않아도 스크롤 이벤트 핸들러는 이미 페인트 직전에 실행되고 있다**는 뜻이다.

정리하면 브라우저는 스크롤 이벤트를 자동으로 프레임당 한 번으로 모아 주고, 핸들러의 실행 시점도 렌더링 단계에 맞춰 정렬해 준다. 가상 리스트에서 rAF 자체가 큰 기여를 하지 못하는 이유다.

### 진짜 주인공은 가상화 자체

지금까지 살펴본 것처럼 rAF의 역할은 생각보다 작다. 브라우저가 이미 스크롤 이벤트를 프레임당 한 번으로 병합하고 실행 시점도 렌더링 직전에 맞춰 주기 때문이다. 

가상 리스트는 어떤 순간에도 카드 10만 장을 DOM에 두지 않는다. 화면과 그 주변에 해당하는 수십 장만 유지하고, 범위를 벗어난 카드는 참조까지 완전히 끊어서 버린다. 그 결과 프레임마다 브라우저가 계산해야 할 트리의 크기는 전체 데이터 크기와 무관하게 항상 일정하게 유지된다.

이것이 핵심이다. 스크롤 성능은 한 프레임 안에서 브라우저가 몇 개의 노드를 상대하는지로 결정된다. 카드가 10만 장이든 100만 장이든 DOM에는 늘 비슷한 개수만 남으므로 스타일 계산, 레이아웃, 페인트 비용은 데이터가 커져도 늘어나지 않는다. rAF를 넣거나 빼는 일은 이 구조 위에서의 디테일일 뿐이다.

## 참고 자료

- [Tracing from JS to the DOM and back again — V8 블로그](https://v8.dev/blog/tracing-js-dom)
- [DOM Standard — Trees](https://dom.spec.whatwg.org/#concept-tree)
- [ECMA-262 — Map.prototype.delete](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map.prototype.delete)
