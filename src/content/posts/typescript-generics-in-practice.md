---
title: '실무에서 자주 쓰는 타입스크립트 제네릭 패턴'
description: '제네릭은 "타입의 함수"다. 반복되는 타입 선언을 줄여주는 실무 패턴 네 가지를 예제와 함께 정리했다.'
date: 2026-09-21
category: 'article'
tags: ['TypeScript']
thumbnail: /thumbnails/generics.svg
---

타입스크립트를 쓰다 보면 "구조는 같은데 타입만 다른" 코드가 반복된다. API 응답 래퍼, 폼 상태, 선택적 필드 변환처럼 말이다. 제네릭은 이 반복을 줄여주는 도구이며, 어렵게 느껴질 때는 **타입의 함수**라는 관점만 잡히면 훨씬 단순해진다.

## 제네릭이 필요한 순간

값을 받아 처리하는 함수를 타입 수준에서 표현한 것이 제네릭이다.

```ts
// 아무 값이나 받아 그대로 돌려주는 함수
function identity<T>(value: T): T {
  return value;
}

const a = identity('hello'); // a: string
const b = identity(42); // b: number
```

`any`를 쓰면 반환 타입 정보가 사라지지만, 제네릭은 **들어온 타입을 기억해서 그대로 돌려준다.** 이것이 제네릭의 출발점이다.

## 패턴 1: API 응답 래퍼

가장 흔한 패턴이다. 모든 API 응답이 같은 봉투(envelope)에 담겨 온다면 봉투만 제네릭으로 만든다.

```ts
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface User {
  id: number;
  name: string;
}

type UserResponse = ApiResponse<User>; // data: User
type UsersResponse = ApiResponse<User[]>; // data: User[]
```

함수 시그니처에도 그대로 적용할 수 있다.

```ts
async function get<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(path);
  return res.json();
}

const { data } = await get<User>('/api/me'); // data: User
```

호출하는 쪽이 타입을 결정하므로 라이브러리 코드는 구체 타입을 몰라도 된다.

## 패턴 2: 제네릭 제약으로 의도 드러내기

`extends`로 제약을 걸면 "이 제네릭은 최소한 이 모양은 해야 한다"를 표현할 수 있다.

```ts
// key는 반드시 객체 T에 존재하는 키여야 한다
function pick<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: '민재' };
const id = pick(user, 'id'); // number
pick(user, 'age'); // ❌ 컴파일 에러: 'age'는 존재하지 않음
```

`T[K]`처럼 인덱스 접근 타입을 반환하면 **키와 값의 타입이 정확히 연결**된다. 문자열 리터럴 조합만으로 오타를 컴파일 타임에 잡아주는 것이 이 패턴의 힘이다.

## 패턴 3: 유틸리티 타입 만들기

내장 유틸리티 타입도 전부 제네릭이다. 자주 쓰는 커스텀 조합을 직접 만들어 보자.

```ts
// 모든 메서드를 optional로 만드는 타입 (목킹에 유용)
type PartialMethods<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any ? T[K] : never;
};

// createdAt처럼 서버가 채워주는 필드를 제외한 입력 타입
type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

interface Post {
  id: number;
  title: string;
  body: string;
  createdAt: Date;
}

type NewPost = CreateInput<Post>; // { title: string; body: string }
```

매핑된 타입(mapped type)에 제네릭을 얹으면 **"이 타입에서 이런 모양을 뽑아낸다"** 는 변환기를 재사용할 수 있다.

## 패턴 4: 조건부 타입과 infer

조건부 타입은 타입 수준의 if문이다. `infer`와 함께 쓰면 구조 안의 타입을 꺼낼 수 있다.

```ts
// Promise가 감싼 타입을 벗겨낸다
type Awaited<T> = T extends Promise<infer U> ? U : T;

type A = Awaited<Promise<string>>; // string

// 배열 요소 타입 꺼내기
type ElementOf<T> = T extends Array<infer E> ? E : never;
type B = ElementOf<number[]>; // number
```

`infer`는 "이 위치에 오는 타입을 U라고 부르겠다"는 선언이다. 함수의 반환 타입만 뽑는 등 라이브러리 수준의 타입도 같은 방식으로 만들어진다.

```ts
type ReturnOf<T> = T extends (...args: any[]) => infer R ? R : never;
```

## 마치며

제네릭을 어렵게 만드는 건 문법이 아니라 **언제 써야 하는지**다. 기준은 단순하다.

1. 같은 구조의 타입이 두 번 이상 반복되면 → 제네릭으로 뽑아낸다
2. 타입 간 관계(키와 값, 입력과 출력)가 있으면 → 제약과 인덱스 접근으로 연결한다
3. 타입 변환이 반복되면 → 매핑된 타입과 조건부 타입으로 변환기를 만든다

타입도 코드다. 반복을 줄이고 관계를 드러내는 방향으로 쓰면, 제네릭은 어려운 기능이 아니라 그냥 리팩터링 도구가 된다.
