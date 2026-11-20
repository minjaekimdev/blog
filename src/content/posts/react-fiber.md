---
title: '리액트 파이버 바닥부터 구현하기'
description: '파이버를 직접 구현해 가며 리액트 동작 원리 이해하기'
date: 2026-11-20
category: 'article'
tags: ['react', 'frontend']
---

`setState`를 호출하면 화면이 바뀌고, `useEffect`의 콜백은 화면이 그려진 뒤에 실행된다. React를 쓰면서 이 두 가지를 너무나 자연스럽게 받아들이다가, 막상 "그게 내부에서는 어떻게 가능하지?"라고 물었을 때 답하지 못했다. 상태는 어디에 기억되는지, 리렌더링은 누가 언제 예약하는지 알지 못했기 때문이다.

이 글은 리액트의 핵심 자료구조인 <strong>파이버(fiber)</strong>를 직접 구현해 보며 이 물음에 답을 찾아간 기록이다. Didact(Build your own React)의 구현 방식을 따라 렌더와 커밋 페이즈의 전체 흐름을 먼저 잡고, 그 위에서 훅을 하나씩 얹는다. 이 글에서 다루는 것은 다음과 같다.

1. 렌더와 커밋 — 파이버 트리를 만들고 DOM에 반영하는 두 페이즈의 협업 방식
2. 상태를 기억하는 훅 — useState, useRef, useMemo
3. 렌더 이후에 실행되는 훅 — useEffect

글은 진행 중이며, 훅 구현을 계속 추가해 가며 보완할 예정이다.

## 렌더와 커밋: 화면을 그리는 두 페이즈

### 파이버: 화면을 구성하는 단위를 표현하는 객체

파이버는 화면을 구성하는 하나의 단위(DOM 노드 또는 컴포넌트)를 표현하는 자바스크립트 객체다. DOM 노드에 대응되는 파이버는 `dom` 필드에 실제 노드의 참조를 저장하고, 컴포넌트에 대응되는 파이버는 `dom`이 없는 대신 자식 파이버들을 통해 화면에 기여한다.

```jsx
{
  dom: ...,        // 이 파이버가 담당하는 실제 DOM 노드
  props: { ... },  // JSX에서 넘어온 props
  alternate: ...,  // 이전 렌더의 같은 위치 파이버 (변경 비교의 기준)
  child: ...,      // 첫 번째 자식 파이버
  sibling: ...,    // 바로 다음 형제 파이버
  hooks: [ ... ],  // 이 컴포넌트가 호출한 훅들의 배열 (뒤에서 다룬다)
}
```

트리 순회를 재귀 대신 연결 리스트(`child`/`sibling`)로 하는 데에는 이유가 있다. 렌더 작업을 중간에 멈추고 다시 이어하기 위해서다. 재귀 순회는 멈춘 위치를 콜스택으로만 기억할 수 있지만, 연결 리스트는 "지금 처리 중인 파이버" 참조 하나(`nextUnitOfWork`)만 들고 있으면 언제든 이어할 수 있다.

파이버 트리는 항상 두 개가 존재한다.

- **currentRoot** — 화면에 그려져 있는 현재 트리
- **wipRoot** (work in progress) — 다음 상태를 계산하고 있는 트리

각 파이버의 `alternate`는 반대편 트리의 같은 위치 파이버를 가리킨다. 두 트리 사이를 잇는 다리 역할이며, 리렌더링 때 "무엇이 바뀌었는지" 비교하는 기준이 된다.

### 렌더 페이즈: 새 트리를 잘게 쪼개서 만든다

렌더 페이즈가 하는 일은 두 가지로 요약할 수 있다.

1. `nextUnitOfWork`부터 파이버를 하나씩 처리한다(performUnitOfWork). 컴포넌트 파이버라면 함수를 실행해 반환된 JSX로 자식 파이버를 만들고, DOM 파이버라면 `props.children`으로 자식 파이버를 만든다.
2. 새 파이버를 만들 때마다 `alternate`(옛 트리의 같은 위치 파이버)와 비교해, 커밋 페이즈에서 수행할 작업을 기록해 둔다.

이 작업을 한 번에 끝내지 않고 브라우저의 상태를 보며 쪼개서 진행하는 도구가 `workLoop`다.

```jsx
function workLoop(deadline) {
  let shouldYield = false;
  // requestIdleCallback이 브라우저가 유휴 상태일 때만 호출해 주고,
  // 프레임에 남은 시간이 1ms보다 적으면 브라우저에 양보한다.
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    // deadline.timeRemaining(): 프레임 안에서 유휴 시간이 얼마나 남았는지 알려준다.
    shouldYield = deadline.timeRemaining() < 1;
  }
  // 모든 작업 단위를 처리했고 wip 트리가 존재하면 커밋한다.
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop);
}
```

`requestIdleCallback`은 브라우저가 바쁘지 않을 때 콜백을 실행해 주는 API다. `deadline.timeRemaining()`이 1ms보다 작으면 다음 유휴 타임으로 순서를 양보하고, 나머지 작업은 그때 이어서 진행한다. (실제 리액트는 `requestIdleCallback` 대신 자체 스케줄러를 사용한다. 이 글의 구현은 아이디어를 확인하기 위한 최소 도구다.)

여기서 렌더 페이즈의 가장 중요한 성질이 드러난다. **렌더 페이즈는 언제든 중단될 수 있다.** wip 트리가 반쯤 만들어진 상태로 멈춰도 괜찮다. 화면이 보고 있는 트리는 current 트리고, 렌더 페이즈에서는 DOM을 전혀 건드리지 않기 때문이다. 불완전한 화면이 사용자에게 보일 일은 없다.

### 커밋 페이즈: 만들어진 트리를 한 번에 반영한다

커밋 페이즈는 렌더 페이즈와 정반대로 동작한다. **한 번 시작하면 끊지 않는다.** 반쯤 반영된 DOM이 화면에 그려지는 상황을 만들지 않기 위해서다. 렌더 페이즈가 wip 트리를 끝까지 완성하면(workLoop의 `!nextUnitOfWork` 조건) 그때 `commitRoot`가 실행된다.

```jsx
function commitRoot() {
  // 삭제 예약된 노드를 먼저 처리한다.
  deletions.forEach((fiber) => commitDeletion(fiber));

  // wip 트리를 타고 가며 DOM을 최신 상태로 만든다.
  commitWork(wipRoot.child);

  // 커밋이 끝나면 wip 트리가 곧 current 트리가 된다.
  currentRoot = wipRoot;

  // 이펙트는 브라우저가 화면을 그린 뒤에 실행한다. (setTimeout 콜백은 태스크 큐에 등록된다)
  setTimeout(() => runEffects(), 0);

  wipRoot = null;
}
```

`commitRoot`는 세 가지를 순서대로 수행한다. 삭제 예약된 파이버를 먼저 제거하고, `commitWork`로 wip 트리를 순회하며 DOM에 변경을 반영한 뒤, `currentRoot`를 wipRoot로 교체한다. 커밋이 끝나면 두 트리의 역할이 바뀐다. 다음 렌더링 때는 이번의 wip 트리가 비교 기준이 되는 current 트리가 된다.

마지막 줄의 `setTimeout(runEffects, 0)`은 이펙트 실행을 페인트 이후로 미루는 장치다. 왜 이렇게 하는지는 useEffect 절에서 다룬다.

### 훅은 파이버의 hooks 배열에 저장된다

훅으로 넘어가기 전에, 훅이 "상태를 기억"할 수 있는 이유를 짚어야 한다. 컴포넌트는 함수다. 리렌더링할 때마다 함수가 다시 실행되고 지역 변수는 매번 새로 만들어진다. 그런데 `useState`는 이전 렌더의 값을 돌려준다. 그 값은 함수 안에 있을 수 없으니, 함수 바깥 — 정확히는 그 컴포넌트의 **파이버** 안에 있어야 한다.

- 컴포넌트 파이버는 `hooks` 배열을 가진다. 렌더 중에 호출된 훅의 데이터(state, queue, deps 등)가 호출 순서대로 push된다.
- 훅이 "이전 렌더의 나"를 찾을 때는 `wipFiber.alternate.hooks[hookIndex]`를 본다. `hookIndex`는 이번 렌더에서 이 훅이 몇 번째로 호출됐는지를 나타낸다. 훅과 훅의 연결은 전부 <strong>순서(index)</strong>로 이루어진다.
- 이 구조가 바로 "훅은 컴포넌트 최상위에서만 호출하라"는 규칙의 근거다. 조건문이나 반복문 안에서 훅을 호출하면 호출 순서가 렌더링마다 달라질 수 있고, index로 매칭되는 훅이 어긋나 엉뚱한 이전 값을 물어온다.

이제 이 구조 위에 훅을 하나씩 얹어 보자.

## useState: 업데이트를 큐에 쌓아 두었다가 한 번에 적용한다

### 초기 렌더링과 리렌더링

`useState(initial)`이 렌더 중에 호출되면 두 갈래로 나뉜다.

- **초기 렌더링** — `alternate`가 없거나 훅이 아예 없어 oldHook을 찾지 못한다. `initial`을 state로 하는 새 훅 객체를 만든다.
- **리렌더링** — `alternate.hooks[hookIndex]`로 이전 훅을 찾아 state를 이어받는다. 그다음 이전 훅의 queue에 쌓여 있던 업데이트를 지금 여기서 모두 적용한다. 큐를 한 번에 비워 적용하는 이 과정을 드레이닝(drain)이라고 부르겠다.

```jsx
function useState(initial) {
  // 초기 렌더링(alternate 부재)이거나 훅이 아예 없었던 경우 oldHook은 null이다.
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  // queue에 쌓여 있던 업데이트를 여기서 모두 적용한다(드레이닝).
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(
    (action) =>
      (hook.state = typeof action === "function" ? action(hook.state) : action),
  );

  wipFiber.hooks.push(hook);
  hookIndex++;

  const setState = (action) => {
    // 업데이트를 큐에 등록한다.
    hook.queue.push(action);

    // action이 현재 state와 같으면 리렌더링하지 않는다.
    if (action === hook.state) {
      return;
    }

    // 새 wipRoot를 만들어 nextUnitOfWork로 지정하면 렌더링이 예약된다.
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  return [hook.state, setState];
}
```

`setState`는 state를 즉시 바꾸지 않는다. 업데이트를 queue에 쌓고 리렌더링만 예약할 뿐이다. 실제 적용은 다음 렌더링 때 `useState`가 queue를 드레이닝하면서 이루어진다.

### 클로저에 갇힌 state와 함수형 업데이트

업데이트를 값으로 전달할 때와 함수로 전달할 때의 차이는 클로저에서 온다.

```jsx
setState(state + 1);
setState(state + 1); // 1만 더해진다
```

`state` 변수는 이 렌더가 실행된 시점의 값을 클로저로 물고 있다. 두 번의 `setState`는 결국 같은 숫자를 두 번 등록하는 것이므로, 드레이닝해도 1만 더해진다.

```jsx
setState((x) => x + 1);
setState((x) => x + 1); // 2가 더해진다
```

업데이트 함수는 드레이닝 시점에 `hook.state` 자체를 순서대로 바꾸므로 두 업데이트가 모두 반영된다. "리액트의 state는 스냅샷이다"는 이야기가 코드 수준에서는 이렇게 나타난다. 이전 상태를 기준으로 값을 계산해야 하는 업데이트는 값 대신 함수로 전달하는 것이 안전하다.

## useEffect: 화면이 그려진 뒤에 실행한다

### 렌더 중에는 콜백을 실행하지 않는다

`useEffect`의 콜백은 렌더 페이즈에서 실행되지 않는다. 렌더 중에는 hook 객체에 effect와 deps를 기록하고, 나중에 실행하기 위한 `effects` 배열에 등록만 해 둔다.

```jsx
function useEffect(callback, deps) {
  const oldHook =
    wipFiber.alternate && // 초기 렌더링 대비
    wipFiber.alternate.hooks && // 훅이 아예 없었던 경우 대비
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    effect: callback,
    deps,
    // 이전 클린업을 물려받는다. 없으면 null.
    cleanup: oldHook ? oldHook.cleanup : null,
  };

  // 렌더 중에는 실행하지 않고, 실행 대상 목록(effects)에 등록만 한다.
  wipFiber.hooks.push(hook);
  wipFiber.effects.push(hook);

  hookIndex++;
}
```

렌더 중에 실행하지 않는 데에는 이유가 있다. 앞에서 봤듯 렌더 페이즈는 언제든 중단될 수 있고, 완성되지 않은 트리 위에서 side effect가 실행되면 잘못된 결과를 낳는다. 이펙트는 커밋이 끝나 화면이 온전히 그려진 뒤에야 실행될 자격이 생긴다.

### 태스크 큐와 페인트의 순서

이펙트 실행은 커밋이 끝난 시점, `commitRoot`의 `setTimeout(runEffects, 0)`에서 예약된다. `setTimeout(fn, 0)`은 콜백을 즉시 실행하지 않고 태스크 큐에 등록만 한다. 브라우저는 현재 태스크가 끝나면 마이크로태스크를 비우고, 화면을 페인트한 뒤에야 다음 태스크를 꺼내 실행한다. 그래서 이펙트는 페인트 이후에 실행된다.

```
[태스크 A] workLoop → commitRoot()
  └ DOM에 변경사항 반영 (동기 실행)
  └ setTimeout(runEffects, 0) → 콜백이 태스크 큐에 "등록만" 됨
[태스크 A 종료]
[마이크로태스크 처리]
[브라우저가 새 DOM으로 화면을 그림 ← 페인트]
[태스크 B] setTimeout 콜백 → runEffects() 실행
```

이 방식의 대가는 지연이다. setTimeout은 최소 지연이 4ms로 클램프된다.

실제 리액트는 setTimeout 대신 MessageChannel을 사용한다. 이유는 세 가지다.

- 4ms 클램프가 없다.
- setTimeout은 백그라운드 탭에서 1초 이상 쓰로틀링되지만, MessageChannel은 그렇지 않다.
- 여전히 매크로태스크라서, 브라우저가 태스크 사이에 페인트할 여지는 그대로 유지된다. (마이크로태스크로 실행하면 페인트 전에 돌아 버린다.)

### 이펙트를 순회하는 방법

`runEffects`는 커밋이 끝난 current 트리를 순회하며 이펙트를 실행하고, 삭제된 파이버의 클린업도 함께 실행한다.

```jsx
function runEffects() {
  // 1) current 트리를 순회하며 이펙트를 실행한다.
  runEffectsInCurrentTree(currentRoot);

  // 2) 삭제된 파이버의 클린업을 실행한다.
  // (클린업을 반환하지 않는 이펙트가 있으므로 존재 검사가 필요하다)
  deletions
    .filter((fiber) => fiber.effects)
    .forEach((fiber) => fiber.effects.forEach((hook) => hook.cleanup()));
}
```

### 자식의 이펙트부터 실행한다

트리 순회는 위에서 아래가 아니라 자식부터 이루어진다(bottom-up). 부모의 `useEffect`에서 `ref.current.getBoundingClientRect()`처럼 자식까지 포함한 레이아웃을 측정하는 경우를 생각해 보면 이유가 명확하다. 자식들의 이펙트가 이미 끝나 있어야 부모가 올바른 값을 볼 수 있다.

```jsx
function runEffectsInCurrentTree(fiber) {
  if (!fiber) return;

  // 1. 자식부터 실행한다 (bottom-up)
  if (fiber.child) runEffectsInCurrentTree(fiber.child);

  const effects = fiber.effects;
  const oldEffects = fiber.alternate?.effects; // 초기 렌더링은 alternate가 없다

  if (effects) {
    // 실행 조건: 마운트 / deps가 undefined / deps가 바뀐 경우
    effects.forEach((effectObj, i) => {
      const oldEffectObj = oldEffects ? oldEffects[i] : null;

      const isMount = !oldEffectObj;
      const isDepsUndefined = effectObj.deps === undefined;
      const isDepsChanged =
        oldEffectObj &&
        effectObj.deps &&
        hasChangeDeps(oldEffectObj.deps, effectObj.deps);

      if (isMount || isDepsUndefined || isDepsChanged) {
        // 보관해 둔 클린업을 먼저 실행한다.
        if (effectObj?.cleanup) {
          effectObj.cleanup();
        }

        // 새 이펙트를 실행하고 반환값을 클린업으로 저장한다.
        effectObj.cleanup = effectObj.effect();
      }

      // 이번 렌더에서 실행하지 않은 이펙트는 클린업을 그대로 유지한다.
    });
  }

  if (fiber.sibling) {
    runEffectsInCurrentTree(fiber.sibling);
  }
}
```

### deps 비교와 클린업

이펙트를 실행할지는 세 가지 조건으로 판단한다.

| 조건 | 실행 여부 |
| --- | --- |
| 이전 렌더에 훅이 없다(마운트) | 실행 |
| deps가 `undefined` | 매 렌더마다 실행 |
| deps가 있고 이전과 하나라도 다르다 | 실행 |
| deps가 빈 배열 `[]` | isDepsChanged가 항상 false → 재실행하지 않음 |

실행이 결정되면 이전에 보관해 둔 클린업을 먼저 실행하고, 실행 후의 반환값을 새 클린업으로 저장한다. 이번 렌더에서 실행하지 않기로 한 이펙트는 이전 클린업을 그대로 유지해야 한다. 나중에 이 이펙트가 실행될 때 사용될 수 있기 때문이다.

클린업이 실행되는 또 하나의 시점은 언마운트다. 삭제된 파이버에 남아 있는 이펙트의 클린업은 `runEffects`의 두 번째 단계에서 실행된다.

## useRef: 리렌더링을 유발하지 않는 값

### 참조 동일성이 곧 기능이다

`useRef`는 값이 바뀌어도 컴포넌트의 리렌더링을 유발하지 않아야 할 때 사용한다. 단, 화면에 보이는 것과 관련된 값을 담아서는 안 된다. ref만 바꿔서는 화면이 다시 그려지지 않기 때문이다.

구현은 짧다.

```jsx
function useRef(initial) {
  const oldHook =
    wipFiber.alternate && // 초기 렌더링 대비
    wipFiber.alternate.hooks && // 훅이 아예 없었던 경우 대비
    wipFiber.alternate.hooks[hookIndex];

  // oldHook이 존재하면 새 객체를 만들지 않고 그대로 반환한다.
  const hook = oldHook ? oldHook : { current: initial };
  wipFiber.hooks.push(hook);
  hookIndex++;

  return hook;
}
```

oldHook이 존재하면 새 객체를 만들지 않고 그대로 돌려준다. 몇 번을 리렌더링해도 항상 같은 객체 참조를 유지하는 것이 핵심이다. `current`를 바꿔도 React는 그 변화를 알 방법이 없고, 알 필요도 없다. 리렌더링이 일어나지 않는 이유가 바로 이것이다.

### ref로 DOM에 직접 접근하기

가장 대표적인 사용처는 DOM 노드를 직접 다루는 일이다. React는 `ref` prop을 받은 요소를 마운트한 뒤 `ref.current`에 그 DOM 노드를 할당한다.

```jsx
import React, { useRef } from "react";

function EmailForm() {
  const emailRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    const email = emailRef.current?.value.trim() ?? "";

    if (!email) {
      alert("이메일을 입력해주세요.");
      emailRef.current?.focus();
      return;
    }

    console.log("제출된 이메일:", email);

    // 실제 DOM의 value를 직접 비운다 (리렌더링 없음)
    if (emailRef.current) {
      emailRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">이메일</label>
      {/* 마운트 후 emailRef.current에 input DOM 노드가 할당된다 */}
      <input
        id="email"
        type="email"
        ref={emailRef}
        defaultValue=""
        placeholder="name@example.com"
      />
      <button type="submit">확인</button>
    </form>
  );
}

export default EmailForm;
```

`ref.current.value`를 직접 비워도 화면이 다시 그려지지 않는다. DOM에는 반영되지만 리렌더링을 유발하는 상태 변화가 아니기 때문이다. 값을 읽고, 포커스를 옮기고, DOM을 직접 고치는 등 화면 렌더링과 무관한 명령형 작업에 ref가 적합한 이유다.

## useMemo: deps가 바뀔 때만 다시 계산한다

### 캐시 미스와 캐시 히트

`useMemo`는 계산 비용이 큰 값을 deps가 바뀔 때만 다시 계산해 캐싱한다.

```jsx
function useMemo(callback, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    value: null,
    deps: deps,
  };

  // 캐시 미스: 마운트이거나 deps가 바뀌었다면 callback을 다시 실행한다.
  if (!oldHook || hasChangeDeps(oldHook.deps, deps)) {
    hook.value = callback();
  } else {
    // 캐시 히트: 이전 값을 그대로 사용한다.
    hook.value = oldHook.value;
  }

  wipFiber.hooks.push(hook);
  hookIndex++;

  return hook.value;
}
```

oldHook이 없거나(마운트) deps가 바뀌었다면 `callback`을 실행해 새 값을 저장하고, 아니라면 이전 값을 그대로 돌려준다.

### 캐시를 재사용할 때도 새 hook 객체를 만드는 이유

코드를 다시 보면, 캐시 히트인 경우에도 새 hook 객체를 만들어 push한다. oldHook을 그대로 push하면 안 될까? 실제로 그렇게 해도 동작한다. useRef는 그렇게 하고 있다.

```jsx
let hook;
if (!oldHook || hasChangeDeps(oldHook.deps, deps)) {
  hook = { value: callback(), deps };
} else {
  hook = oldHook; // 재사용
}
```

useRef가 oldHook을 그대로 돌려주는 것은 객체 공유 자체가 기능이기 때문이다. 반면 훅 객체 안에 가변 상태를 두는 훅은 옛 트리의 객체를 그대로 쓰면 문제가 생긴다.

- **useState** — `hook.queue`는 setState 클로저가 계속 push하는 가변 배열이다. 옛 훅을 공유하면 어느 트리의 큐에 업데이트가 쌓이는지 애매해지고, 드레이닝 타이밍이 꼬인다.
- **useEffect** — `hook.cleanup`은 `runEffects`가 계속 덮어쓰는 가변 필드다.

정리하면 이렇다. 캐시 히트 분기에서 만든 hook 객체는 버려지는 게 아니라, 다음 렌더의 비교 기준(oldHook)이 될 기록지로 push되는 것이다. value만 복사해서 끝내는 게 아니라 deps 기록도 갱신해서 전달해야 하고, "매 렌더마다 새 객체를 push"하는 규칙 자체가 옛 트리와의 가변 상태 공유를 막는 안전장치다.
