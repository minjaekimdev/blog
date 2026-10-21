---
title: '타입스크립트 제네릭, 어렵지 않게 이해하기'
description: '제네릭은 "타입의 함수"라고 생각하면 훨씬 쉽습니다. 함수에 비유해 제네릭의 개념부터 제약 조건, 실전 패턴까지 차근차근 정리했습니다.'
date: 2026-06-21
category: 'article'
tags: ['typescript', 'basics']
thumbnail: '/thumbnails/typescript-generics.svg'
---

타입스크립트를 배우다 보면 반드시 벽에 부딪히는 개념이 있다. 제네릭이다. `<T>`라는 낯선 문법 앞에서 많은 사람이 "일단 복사해서 쓰고 말자"로 넘어간다.

그런데 제네릭은 사실 우리가 이미 알고 있는 개념의 연장선이다. 한 문장으로 말하면 이렇다.

> 제네릭은 **타입의 함수**다.

## 함수는 값의 함수

일반 함수를 떠올려보자. 값을 받아서 값을 돌려준다.

```ts
function repeat(value: string, times: number): string[] {
  return Array(times).fill(value);
}

repeat('안녕', 3); // ['안녕', '안녕', '안녕']
```

함수를 정의할 때는 아직 `value`가 뭔지 모르고, 호출하는 순간 값이 정해진다. 매개변수는 **미래에 들어올 값에 붙인 이름**이다.

## 제네릭은 타입의 함수

제네릭도 똑같다. 타입을 받아서 타입을 돌려준다.

```ts
function identity<T>(value: T): T {
  return value;
}

const a = identity<string>('hello'); // T가 string으로 확정된다
const b = identity<number>(42);      // T가 number로 확정된다
```

- 함수 **정의** 시점: `T`는 아직 정해지지 않은 타입. 그저 "나중에 들어올 타입에 붙인 이름"이다.
- 함수 **호출** 시점: `T`가 실제 타입으로 확정된다.

`<T>`가 겁나 보였다면, 그것은 매개변수였다. 이름이 `T`든 `Item`이든 상관없다.

## 제약 조건: T에게 자격 요건을 주기

`extends`를 붙이면 `T`가 만족해야 할 조건을 지정할 수 있다. 함수 매개변수에 타입을 지정하듯이.

```ts
// T는 반드시 length 프로퍼티를 가진 타입이어야 한다
function logLength<T extends { length: number }>(value: T): T {
  console.log(value.length);
  return value;
}

logLength('hello');      // OK: string은 length가 있다
logLength([1, 2, 3]);    // OK: 배열도 length가 있다
logLength(123);          // 에러: number에는 length가 없다
```

## 실전 패턴: 응답 래퍼 만들기

API 응답을 감싸는 타입은 제네릭의 가장 흔한 용례다.

```ts
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

type UserResponse = ApiResponse<{ id: number; name: string }>;
// {
//   code: number;
//   message: string;
//   data: { id: number; name: string };
// }
```

`data`의 타입만 갈아끼우고 싶은데 나머지 구조는 공통일 때, 제네릭은 반복을 없애준다.

## 마치며

- 제네릭 = 타입의 함수. `<T>`는 "나중에 들어올 타입"의 이름표다.
- `extends`로 자격 요건을 줄 수 있다.
- 반복되는 타입에서 "딱 한 부분만 바뀐다"면, 그 부분이 제네릭의 자리다.

다음에 `<T>`를 만나면 겁먹지 말고 "이 함수에 타입을 넘기는구나"라고 생각해보자. 그것으로 절반은 이해한 것이다.
