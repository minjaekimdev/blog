---
title: "React의 탄생 배경과 트레이드오프"
description: "바닐라 JavaScript와 비교하며 이해하는 React의 설계 원리와 트레이드오프"
thumbnail: ""
date: 2026-10-29
category: "article" 
pinned: false
tags:
  ["react", "frontend"]
---

input 하나에 `useState`와 `onChange`를 붙이고, 목록에는 `key`를 넣고, `useEffect`에는 의존성 배열을 선언한다. React로 개발하면 자연스럽게 치르게 되는 이 세리머니의 출처는 React의 등장 배경에 있다. React는 **상태와 화면의 불일치**라는 하나의 문제를 없애려고 만들어졌고, 오늘날 개발자가 치르는 세리머니는 그 문제를 해결하기 위해 치른 대가다.

같은 할 일 앱을 바닐라 JavaScript와 React로 각각 만들어 보고, 온도 변환기·10,000행 목록·검색 필터·스톱워치까지 같은 기능을 두 방식으로 비교 구현하며 기록한 내용을 정리했다. 이 글에서 다루는 것은 다음 세 가지다.

1. React가 해결하려던 문제 — 상태(state)와 화면의 불일치
2. 그 해결책이 된 설계 — 선언형 UI, 단일 출처(single source of truth), 단방향 흐름
3. 그 대가로 생긴 세 가지 트레이드오프 — 전체 다시 그리기 비용, 폼의 세리머니, 스냅샷 모델

## 웹이 문서에서 애플리케이션이 되기까지

2010년대까지의 웹사이트 대부분은 MPA(Multi Page Application) 방식으로 동작했다. 사용자가 링크를 클릭하거나 폼을 제출할 때마다 서버가 새 HTML 문서 전체를 내려주고, 브라우저는 처음부터 다시 그린다. 이 방식에는 세 가지 비효율이 있었다.

- **불필요한 리소스 재로딩** — 메뉴바, 헤더, 푸터처럼 페이지마다 똑같이 들어가는 공통 영역까지 매번 다시 받고 그렸다.
- **화면 깜빡임** — 페이지가 전환될 때마다 화면이 하얗게 변했으므로 애플리케이션 같은 부드러운 전환을 만들기 어려웠다.
- **서버 부하** — 모든 렌더링 연산과 HTML 생성을 서버가 담당하므로 트래픽이 몰리면 부담이 커졌다.

2005년부터 AJAX(Asynchronous JavaScript and XML)가 대중화되면서 상황이 바뀌었다. 페이지 전체를 새로고침하지 않고도 자바스크립트로 서버와 비동기 통신을 주고받아, 필요한 데이터만 가져와 화면의 일부만 갱신할 수 있게 됐다. 웹사이트가 읽기 전용 문서에서 데스크톱 프로그램처럼 실시간으로 반응하는 RIA(Rich Internet Application)로 진화하기 시작한 것이다.

이 흐름 위에서 프론트엔드 생태계도 성숙했다. 브라우저마다 다른 자바스크립트 호환성과 복잡한 DOM 조작은 jQuery를 거쳐 React·Vue·Angular 같은 라이브러리와 프레임워크가 대신 처리하게 됐다. 서버는 HTML 대신 JSON 데이터를 API로 제공하고, 클라이언트가 라우팅(화면 전환)과 상태 관리를 직접 담당하는 API 중심 아키텍처가 보편화됐다.

문제는 여기서 끝나지 않았다. 화면을 브라우저가 직접 그리게 되자, **데이터가 바뀔 때 화면을 최신으로 유지하는 책임**이 개발자에게 넘어왔다. 바닐라 JavaScript로 화면을 직접 그리면 이 책임이 얼마나 무거운지 바로 드러난다.

## React가 해결하려던 문제: 상태와 화면의 불일치

바닐라 JavaScript로 만든 할 일 목록 앱에서 새 할 일을 추가하는 코드는 이렇다. `renderList`는 할 일 목록 `<ul>`을 다시 그리는 함수이고, `renderStats`는 완료 개수와 진행률이 표시되는 통계 영역을 다시 그리는 함수다.

```jsx
document.querySelector("#todo-form").addEventListener("submit", (e) => {
  e.preventDefault(); // 폼 제출의 기본 동작(페이지 전체 새로고침)을 막는다
  const input = document.querySelector("#todo-input");
  const text = input.value.trim();
  if (!text) return;

  todos.push({ id: nextId++, text, done: false });

  input.value = "";
  input.focus();

  // 데이터를 바꾼 뒤, 갱신 코드를 개발자가 직접 호출해야 한다
  renderList();
  renderStats();
});
```

짚어야 할 점은 세 가지다.

**첫째, 데이터를 바꾸는 코드와 화면을 갱신하는 코드가 분리되어 있다.** `todos.push(...)` 한 줄로 데이터는 이미 바뀌었지만, 화면은 `renderList()`와 `renderStats()`를 직접 호출하기 전까지 옛 모양 그대로다. 데이터와 화면을 동기화하는 건 오직 개발자의 기억력이다.

**둘째, 진입 경로가 많아질수록 갱신 코드도 같이 늘어난다.** 데이터를 바꾸는 곳이 100곳이라면 갱신 호출도 100곳에 있어야 한다. 한 곳이라도 빠뜨리면 데이터는 새 값인데 화면만 옛 값을 보여주는 **불일치 버그**가 된다.

**셋째, 갱신 방식 자체가 부담스럽다.** 목록을 다시 그릴 때마다 `부모.innerHTML = ...` 형태로 화면 전체를 교체하기 때문에, 매번 버튼마다 리스너를 다시 붙이는 일을 피하려면 이벤트 위임이 필요하다. 이벤트 위임은 각 버튼마다 리스너를 붙이는 대신 부모 요소 하나에만 리스너를 두고, 클릭된 자식을 `closest()`로 찾아 `dataset`에서 값을 읽어내는 기법이다. 만약 전체 교체 대신 요소별로 추가·삭제하는 방식을 택한다면 그때마다 리스너를 붙이고 떼는 코드를 직접 써야 하는데, 이것 역시 갱신 누락이 일어날 수 있는 자리다.

React가 탄생한 배경 중 하나가 바로 이 상태와 화면의 불일치 위험이다. 같은 앱을 React로 다시 만들면 무엇이 달라지는지 본다.

## state를 바꾸면 화면이 따라온다

앞의 추가 로직을 React로 옮기면 이렇게 된다.

```jsx
function App() {
  const [todos, setTodos] = useState([]);
  const nextId = useRef(1);

  function addTodo(text) {
    setTodos([...todos, { id: nextId.current++, text, done: false }]);
    // renderList(), renderStats() 같은 갱신 호출이 존재하지 않는다
  }
  // ...
}
```

`setTodos(...)`를 호출하는 것 외에 화면 갱신 코드가 한 줄도 없는데도 화면은 바뀐다. React에서 `setState`가 렌더링 트리거가 되면 하위 컴포넌트 전체가 리렌더링되고, 이전 가상 DOM과 비교(diff)해서 바뀐 부분만 실제 DOM에 반영하기 때문이다.

바닐라 코드에서 `renderStats()`와 `renderList()`가 차지하던 자리에는 두 가지만 남는다.

- `setTodos` — "화면을 바꾸고 싶다"는 **의도**
- JSX — "이 state일 때 화면이 어떤 모양인지"에 대한 **선언**

이벤트 위임과 `closest()`도 사라진다. 어떤 요소가 어떤 이벤트를 받는지 JSX에서 바로 선언할 수 있기 때문이다. 미리 정의된 추천 할 일을 한 번에 추가하는 버튼 행이 그 예시다.

```jsx
function QuickAddRow({ onAdd }) {
  const QUICK_ITEMS = ["물 마시기", "산책하기", "책 10쪽 읽기"];

  return (
    <div className="row quick">
      {QUICK_ITEMS.map((item) => (
        <button key={item} onClick={() => onAdd(item)} type="button">
          {item}
        </button>
      ))}
    </div>
  );
}
```

이 코드에서 두 가지 규칙이 드러난다.

### 규칙 1 — 계산 가능한 값은 state로 만들지 않는다

목록의 개수를 보여주는 뱃지는 state가 아니라 그냥 계산한다.

```jsx
<span className="badge">{todos.length}</span>
```

`todos`에서 계산할 수 있는 값을 별도 state로 관리하는 순간, 그 값을 갱신하는 코드가 다시 생긴다. 이는 앞에서 본 갱신 누락 문제를 되살리는 일이고, React가 해결하려던 구조를 스스로 재현하는 셈이다. 같은 원리로 진행률 퍼센트도 state가 아니라 계산값인데, 이때 `all === 0 ? 0 : (done / all) * 100`처럼 분모가 0일 때를 가드해야 `NaN`이 나오지 않는다.

### 규칙 2 — state는 불변성을 지켜서 바꾼다

`todos.push({...})` 대신 `[...todos, newTodo]`로 새 배열을 만드는 이유는, React가 값 비교를 <strong>참조(얕은 비교)</strong>로만 하기 때문이다.

```jsx
todos.push(newTodo);            // 참조가 그대로라 변화 감지가 어렵다
setTodos([...todos, newTodo]);  // 새 배열을 만든다 — 한 번의 참조 비교로 끝난다
```

`push`로 기존 배열을 고치면 참조가 그대라서 "무엇이 바뀌었는지" 판정하려면 배열 안의 내용물을 전부 깊게 비교해야 하는데, 이는 비용이 큰 작업이다. 새 배열을 만들어 참조만 바꾸면 바뀜 판정이 한 번의 비교로 끝난다. 이렇게 기존 값의 참조를 유지한 채 새 값을 만드는 규칙을 **불변성**이라고 부른다.

## 값의 출처를 하나로 모으는 단방향 흐름

이번에는 온도 변환이다. 섭씨 입력창에 숫자를 넣으면 화씨 입력창의 숫자가 함께 바뀌고, 반대로 화씨에 넣어도 섭씨가 따라 바뀐다. 두 입력이 항상 같은 온도를 보여줘야 하는 이 요구의 해법은, 두 입력이 각자 값을 기억하지 않고 `(temperature, scale)`이라는 **단일 출처**를 부모(App) 혼자 기억하는 것이다. 두 입력창에 보이는 값은 전부 이 원본에서 계산한 파생값이다.

어떤 값이 state여야 하는지 판단한 기준은 다음과 같다.

| 값 | state로 저장? | 이유 |
| --- | --- | --- |
| 마지막에 입력한 숫자 | O | 이 값을 가지고 다른 온도를 계산해야 한다 |
| 그 숫자의 단위(c/f) | O | 위와 같음 |
| 반대 단위로 환산한 숫자 | X | 원본에서 계산되는 파생값이다 |
| "끓는지" 여부 | X | 원본에서 계산되는 파생값이다 |

데이터는 아래로만, 요청은 위로만 흐른다.

```
1. 사용자 입력 → 자식이 onChange로 부모에게 변경을 통지 (올라가는 건 "사실"이 아니라 "요청")
2. 부모가 setTemperature/setScale로 원본을 갱신
3. React가 App을 리렌더링 → 파생값을 다시 계산
4. 새 props가 두 입력에게 모두 내려감 (위 → 아래)
```

두 입력은 서로를 전혀 호출하지 않고 각자 부모와만 대화한다. A 입력의 변경이 B 입력으로 "전달"되는 게 아니라, B도 원본에서 다시 계산됐을 뿐이다.

이 구조의 확장성은 켈빈 입력을 추가하며 확인했다. 필요한 작업은 환산 함수 하나, 파생값 계산 한 줄, JSX 추가 한 줄뿐이고 기존 컴포넌트는 한 글자도 고치지 않는다. 켈빈 값은 상태가 아니라 계산값이라서 "켈빈을 갱신하는 호출"이라는 대상 자체가 존재하지 않고, 그래서 빠뜨릴 수도 없다. 바닐라 방식이었다면 켈빈 input을 갱신하는 코드를 모든 변경 경로에 복사해 넣어야 하고, 한 곳이라도 빠뜨리면 켈빈만 옛 값으로 멈추는 앞서 본 불일치 버그가 생긴다.

### 양방향 바인딩과의 비교 — 편의성 vs 추적 가능성

같은 기능을 Angular.js의 양방향 바인딩으로 짠다면 두 입력을 각자 모델에 묶고, watcher 두 개로 서로를 환산해 쓰는 구조가 된다.

```js
$scope.$watch('celsius',     (v) => { $scope.fahrenheit = toF(v); });
$scope.$watch('fahrenheit',  (v) => { $scope.celsius    = toC(v); });
```

- **편의성은 더 높다.** 상태 설계, 끌어올리기, onChange 통지를 고민할 필요 없이 필드를 모델에 바인딩하면 끝이니, 모델이 작은 이 예제 수준에서는 코드가 더 짧을 수도 있다.
- **추적 가능성은 나쁘다.** `celsius`에 37.78이 들어 있다면 그것이 사용자의 직접 입력인지, `fahrenheit` watcher가 환산해 쓴 값인지 코드만 봐서는 알 수 없다. 두 watcher가 서로를 자극하는 환산 핑퐁이 생기고, "마지막에 편집한 쪽은 갱신 금지" 같은 묵시적 규칙에 의존하게 된다. 값이 바뀌는 입구가 그래프의 모든 노드라서, 원인을 찾으려면 watcher 그래프 전체를 머릿속으로 실행해 봐야 한다.

React 방식에서는 값의 입구가 `handleCelsiusChange`와 `handleFahrenheitChange` 두 함수로 모여 있어서 "이 온도는 언제, 어디서 바뀌는가"를 검색으로 추적할 수 있다. React는 **편의성을 내놓고 추적 가능성을 택한 것**이다. 지금부터 이 선택의 대가가 실제로 어떤 모양인지 세 가지로 살펴본다.

## 트레이드오프 ① 전체 다시 그리기의 비용

"state만 바꾸면 화면이 따라온다"의 뒷면이 있다. 개발자가 화면의 어느 부분이 바뀌는지 힌트를 주지 않는 한, React는 state가 바뀔 때마다 **그 state를 참조하는 하위 컴포넌트 전체를 다시 실행한다.** 모델과 뷰의 동기화를 이렇게 얻은 대신, 불필요한 실행을 막는 일은 개발자의 몫이 된다.

같은 작업을 네 가지 방식으로 구현해 실측을 진행했다. 상황은 10,000개 행으로 된 목록에서 사용자가 한 행의 체크박스를 누르는 것, 즉 화면상으로는 한 행만 바뀌는 상황이다. 완료된 행의 텍스트에는 취소선(`.done`)이 그어진다고 하자. 네 가지 방식은 각각 이렇다.

**바닐라 ① 전체 다시 그리기** — 데이터를 기준으로 목록 전체의 HTML을 새로 만들어 끼워 넣는다(innerHTML 교체).

```js
// 데이터(todos)를 기준으로 10,000개 행의 HTML을 매번 새로 조립해 통째로 교체한다
function renderList() {
  listEl.innerHTML = todos
    .map(
      (todo) => `
      <li data-id="${todo.id}">
        <input type="checkbox" ${todo.done ? "checked" : ""} />
        <span class="${todo.done ? "done" : ""}">${todo.text}</span>
      </li>`
    )
    .join("");
}

// 이벤트 위임: 목록이 매번 통째로 교체되므로 리스너는 부모(listEl) 하나에만 둔다
listEl.addEventListener("change", (e) => {
  const id = Number(e.target.closest("li").dataset.id);
  const todo = todos.find((t) => t.id === id);
  todo.done = e.target.checked;

  renderList(); // 한 행만 바뀌었는데 10,000개 행을 전부 다시 만든다
});
```

**바닐라 ② 필요한 곳만 수정** — 바뀐 한 행의 텍스트(취소선)만 찾아 직접 고친다.

```js
listEl.addEventListener("change", (e) => {
  const id = Number(e.target.closest("li").dataset.id);
  const todo = todos.find((t) => t.id === id);
  todo.done = e.target.checked;

  // 체크박스 모양은 브라우저가 이미 바꿔 뒀다. DOM에서 고칠 곳은 취소선 하나뿐이다.
  const row = listEl.querySelector(`li[data-id="${id}"]`);
  row.querySelector("span").classList.toggle("done", todo.done);
  // 나머지 9,999개 행의 DOM은 전혀 건드리지 않는다
});
```

**React 기본** — 최적화 없이 그대로 리렌더링한다.

```jsx
function TodoRow({ todo, onToggle }) {
  console.log("실행:", todo.id); // 체크 1번에 10,000번 찍힌다(실측 시에는 출력 비용을 빼고 카운터로 셌다)
  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
      <span className={todo.done ? "done" : ""}>{todo.text}</span>
    </li>
  );
}

function App() {
  const [todos, setTodos] = useState(initialTodos); // 10,000개짜리 초기 데이터

  function handleToggle(id) {
    // 바뀐 한 행만 새 객체로 만들고, 나머지 행은 기존 참조를 그대로 유지한다
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  return (
    <ul>
      {todos.map((t) => (
        <TodoRow key={t.id} todo={t} onToggle={handleToggle} />
      ))}
    </ul>
  );
}
```

이 코드 어디에도 "어느 행이 바뀌었는지"라는 힌트는 없다. `setTodos`를 호출하는 순간 React는 일단 App 전체를 다시 실행하고, `TodoRow` 10,000개가 전부 따라 실행된다.

**React + memo** — 바뀌지 않은 행은 props가 같음을 확인하고 재실행을 건너뛴다.

```jsx
// memo로 감싸면 렌더링 때마다 "props가 이전과 같은가?"를 얕게 비교해서,
// 같으면 컴포넌트 함수의 재실행을 건너뛴다
const TodoRow = memo(function TodoRow({ todo, onToggle }) {
  console.log("실행:", todo.id); // 체크 1번에 딱 1번만 찍힌다
  // JSX는 위의 React 기본 버전과 같다
});

function App() {
  const [todos, setTodos] = useState(initialTodos);

  // useCallback: handleToggle의 참조를 렌더링 사이에 유지한다.
  // 이게 없으면 매 렌더링마다 새 함수가 만들어져 onToggle 비교가 항상 "다름"이 나오고,
  // memo는 조용히 무용지물이 된다.
  const handleToggle = useCallback((id) => {
    // 함수형 업데이트: 최신 state를 인수로 받으므로 콜백이 옛 todos를 기억해 둘 필요가 없다
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, []);

  return (
    <ul>
      {todos.map((t) => (
        <TodoRow key={t.id} todo={t} onToggle={handleToggle} />
      ))}
    </ul>
  );
}
```

실측 결과는 다음과 같다.

| 방식 | 대략 시간 | 실행된 행 수 |
| --- | --- | --- |
| 바닐라 ① 전체 다시 그리기 | 61.4ms | 10,000 (DOM 재구성) |
| 바닐라 ② 필요한 곳만 수정 | 0.3ms | 1 |
| React 기본 (memo 적용 전) | 87.6ms | 10,000 |
| React + memo | 3.8ms | 1 |

React의 "전체 리렌더링"이 어느 쪽에 가까운지는 관점에 따라 답이 갈린다.

- **실행 관점에서는 바닐라 ①에 가깝다.** 버튼을 누르면 바뀌지 않은 9,999개 행의 컴포넌트 함수까지 전부 다시 실행됐다. "실행된 행 수 10,000"이 그 증거다.
- **실제 DOM 반영 관점에서는 바닐라 ②에 가깝다.** diff 덕분에 실제 DOM에서 만지는 곳은 1곳뿐이고, 나머지 9,999개 노드는 화면에 그대로 재사용된다.

즉 **가상 DOM diff가 해주는 것**은 이전 설계도와 새 설계도를 비교해서 달라진 부분만 실제 DOM에 반영하는 것, 즉 DOM 조작 비용을 줄이는 일이다. **못 해주는 것**은 컴포넌트 함수를 다시 실행하는 비용을 줄이는 일이다. diff는 함수를 전부 실행해 나온 결과를 실행 후에 비교하는 도구라서, "무엇이 바뀌는지 미리 알고 실행을 건너뛰는" 일은 할 수 없다. 그 역할이 바로 `memo`다.

### memo를 무조건 붙이면 안 되는 이유

`memo`를 무조건 다 붙이면 되는 건 아니다. 세 가지 이유가 있다.

1. **memo 자체에도 비용이 든다.** memo는 렌더링 때마다 이전 props와 새 props를 하나하나 얕게 비교한다. 리렌더가 드문 컴포넌트에 붙이면 비교 비용만 늘어나고 이득은 없다.
2. **불변성 규칙이라는 새로운 계약이 생긴다.** memo가 작동하려면 바뀌지 않은 데이터는 같은 참조를 유지해야 한다. 이 규칙이 깨지면 두 가지 사고가 난다. 매번 새 객체를 만들어 넘기면 memo가 조용히 무용지물이 되고, 반대로 기존 객체를 직접 고치면 참조가 같아서 바뀌었는데도 화면이 안 그려지는 정확성 버그가 된다.

3. **성급한 최적화가 되기 쉽다.** 대부분의 컴포넌트는 재실행이 워낙 빨라서 memo 없이도 충분하다. 성능 문제를 측정하기도 전에 미리 다 붙이는 건 코드만 복잡하게 만든다. 10,000행이라는 극단적 상황을 굳이 만든 이유는, memo가 "이렇게 큰 비용이 실측될 때 쓰는 도구"임을 체감시키기 위해서다.

이 세 가지 중 2번의 계약이 실제로 깨지면 어떤 일이 벌어지는지 코드로 확인해 보자.

```jsx
// 사고 1 — 매번 새 객체·새 함수를 넘긴다: 비교 결과가 항상 "다름"
<TodoRow todo={{ ...t }} onToggle={() => handleToggle(t.id)} />
// → memo가 매번 재실행된다. 안 붙인 것과 똑같다.

// 사고 2 — 기존 객체를 직접 고친다: 참조가 그대로라 비교 결과가 항상 "같음"
todo.done = true; // state 안의 객체를 직접 수정
setTodos(todos);  // 참조가 같으니 "안 바뀜"으로 판정한다
// → 체크했는데도 화면이 갱신되지 않는 정확성 버그.

// 계약을 지키는 방법 — 바뀐 행만 새 객체로, 나머지는 참조 유지
setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
```

한 가지 더. 바닐라 방식의 "갱신 호출 목록을 개발자가 관리"하는 고통과, 이 절의 "memo와 불변성 규칙을 개발자가 관리"하는 부담은 같은 종류가 아니다. 전자는 모델과 뷰의 불일치라는 **정확성** 문제였고, 후자는 렌더링 **성능** 문제다. 갱신 누락 버그는 구조적으로 사라졌지만, 그 대가로 성능 관리라는 새로운 책임이 생겼다.

## 트레이드오프 ② 폼에서 포기한 편의성

비교 대상은 두 가지 방식이다. **네이티브(비제어)** 방식은 HTML input을 그대로 쓰고 값을 DOM이 기억하게 두는 방식이고, **React 제어 컴포넌트** 방식은 input의 값을 state로 관리하며 `value`와 `onChange`로 묶는 방식이다. 같은 이메일 input을 두 방식으로 각각 만들면 다음과 같다.

**네이티브(비제어)** — 값의 원본이 DOM이다.

```jsx
function UncontrolledEmailForm() {
  const formRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    // 값은 제출 순간에 DOM에서 직접 읽는다. 타이핑하는 동안 실행되는 코드는 없다.
    const email = new FormData(formRef.current).get("email");
    console.log(email);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {/* value도 onChange도 없다. 값은 input이 저마다 기억하고, React는 타이핑을 모른다 */}
      <input type="email" name="email" />
      <button>제출</button>
    </form>
  );
}
```

**React 제어** — 값의 원본이 state다.

```jsx
function ControlledEmailForm() {
  const [email, setEmail] = useState(""); // 값의 원본

  function handleSubmit(e) {
    e.preventDefault();
    console.log(email); // state를 읽는다. DOM을 찾아 헤맬 필요가 없다.
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email} // 화면에 보이는 값은 항상 state의 복사본
        onChange={(e) => setEmail(e.target.value)} // 타이핑 1글자에 1회 재실행
      />
      <button>제출</button>
    </form>
  );
}
```

두 방식을 비교한 기록은 다음과 같다.

| 관점 | 네이티브(비제어) | React 제어 |
| --- | --- | --- |
| 값의 원본 | DOM | state |
| 이메일 input을 위한 코드 | 1줄 (HTML) | useState 1줄 + value 1줄 + onChange 1줄 |
| 타이핑 1글자당 재실행 | 0회 | 1회 (StrictMode에서 2회) |
| 값 전체를 읽는 방법 | `new FormData(form)` | state 그대로 |
| 실시간 표시의 갱신 누락 가능 | 있음 | 없음 |

React가 "input의 값을 DOM에 맡겨 두는 것"을 기본값으로 만들지 않은 이유는, 핵심 공식 <strong>"UI는 state의 함수"</strong>가 성립하려면 값의 원본이 state여야 하기 때문이다. 값이 DOM에만 있으면 세 가지가 모두 무너진다.

**(a) 리렌더링해도 값이 유지된다는 보장이 없다.** React의 렌더링 모델은 "state로부터 화면 설계도를 새로 만든다"이다. 값이 state에 없으면 React는 그 값의 존재조차 모르고, 조건부 렌더링이나 key 변경 같은 구조 변화가 일어나면 DOM 노드가 새로 만들어지면서 DOM에만 있던 값은 증발한다. 지금 폼에서 타이핑이 유지되어 보이는 건 단순한 경우에 같은 노드를 재사용하기 때문이고, 그건 보장이 아니라 우연에 가깝다.

```jsx
// 조건부 렌더링으로 input을 떼었다 다시 붙이는 순간
{open && <input placeholder="간단 메모" />}
// open이 false → true로 바뀌면 새 DOM 노드가 만들어진다.
// 사용자가 타이핑한 값은 DOM에만 존재했으므로 함께 증발하고, 복구해 줄 방법도 없다.
```

**(b) 다른 UI에서 그 값을 쓸 수 없다.** "이메일이 유효하면 제출 버튼 활성화"를 만들고 싶어도, 값이 바뀐 걸 React가 알 방법이 없으니 리렌더링 자체가 일어나지 않는다. 이걸 이벤트 리스너에서 수동으로 갱신하게 되면, 앞서 본 뱃지 갱신 누락 구조가 그대로 돌아온다.

```jsx
// 제어 — 버튼 상태를 state에서 계산한 파생값으로 선언한다. 갱신 호출이라는 코드 자체가 없다.
const isValid = email.includes("@");

<button disabled={!isValid}>제출</button>

// 비제어 — "버튼이 이메일을 지켜봐야 한다"는 연결을 개발자가 직접 만들어야 한다
emailInput.addEventListener("input", () => {
  submitButton.disabled = !emailInput.value.includes("@");
});
// 이 연결을 빠뜨리면 버튼은 영원히 옛 상태로 남는다 — renderStats() 갱신 누락과 같은 구조다.
```

**(c) 값의 현재 상태를 코드로 알 수 없다.** DOM에만 있는 값은 노드 안에 숨겨져 있어서 필요할 때마다 ref나 `FormData`로 직접 찾아 읽어야 한다. 로그로 찍거나 조건문에 쓰거나 다른 컴포넌트에 props로 전달할 수 없다.

```jsx
console.log(email); // 제어라면 이 한 줄이다. 비제어에서는 `email`이라는 변수 자체가 없다.
// 값을 알고 싶으면 그때마다 노드부터 찾아 들어가야 한다: ref → current → value
```

한 줄로 정리하면 이렇다. 값의 원본이 state여야 "state만 바꾸면 화면 전체가 따라온다"는 예측 가능성이 성립하고, 그 대가가 input 하나당 `useState` + `value` + `onChange`의 세리머니다.

### 비제어 컴포넌트가 합리적인 경우

비제어 방식이 나쁜 게 아니다. 판단 기준은 간단하다. "타이핑 도중에 UI가 이 값에 반응할 필요가 없는가?"의 답이 예라면 비제어가 합리적이다.

- **제출 시에만 값이 필요한 폼** — 회원가입, 검색창처럼 입력 중에는 아무 UI도 반응할 필요 없고 제출 순간에만 읽으면 되는 폼. 타이핑 내내 리렌더링하는 비용을 안 치러도 된다.
- **React가 아예 다루지 못하는 input** — 대표적으로 `<input type="file">`은 값이 파일이라 state 문자열로 관리되지 않으므로, 공식 문서도 비제어로만 다루라고 명시한다.
- **렌더 비용이 큰 대형 폼** — 글자 하나에 무거운 컴포넌트 전체가 다시 실행되는 상황(앞에서 실측한 비용)이라면 값에 관여하지 않는 비제어 쪽이 유리하다.
- **브라우저 기본 동작을 활용하고 싶을 때** — `maxlength`, `required` 같은 네이티브 기능을 최대한 쓰고 싶은 경우.

방법은 `useRef`로 input을 가리켰다가 제출 시점에 `ref.current.value`로 읽거나, 초기값만 필요하면 `defaultValue`를 쓰는 것이다. 기본값은 제어 컴포넌트지만, 값이 렌더에 관여할 필요가 없다면 비제어가 더 싸고 더 단순하다.

```jsx
function SearchForm() {
  const queryRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    // 제출 순간에만 DOM에서 값을 읽는다. 타이핑 내내 일어나는 재실행은 0회다.
    console.log(queryRef.current.value);
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* defaultValue는 초기값만 준다. 이후의 값은 DOM이 기억하므로 비제어로 유지된다 */}
      <input ref={queryRef} defaultValue="환율" />
      <button>검색</button>
    </form>
  );
}
```

### 편의성과 추적 가능성 사이에서

양방향 바인딩의 편의가 무조건 틀린 답은 아니다. Vue와 Svelte가 양방향 편의를 선택해 성공한 것도 사실이다. 다만 규모가 있고 오래 사는 제품에서는 단방향 명시 쪽이 유리한 이유가 두 가지 있다.

1. **디버깅 비용이 타이핑 비용보다 크다.** "이 화면 값이 대체 어디서 왔지?"를 추적 못 하는 것은 버그 하나당 몇 시간씩 먹는다. 반면 value/onChange 세리머니는 글자 몇 개짜리 비용이다.
2. **일관성이 온보딩 비용을 줄인다.** 자동 동기화 같은 마법은 편하지만 팀원마다 "마법이 어디서 도는지"를 따로 이해해야 한다. 값의 원본이 state 하나로 모인다는 규칙은 새로 온 사람도 한 문장으로 설명할 수 있다.

React 진영에서도 절충안이 있다. "타이핑 중 반응이 필요 없는 단순 폼은 비제어 허용"을 팀 컨벤션으로 정하면, React의 예측 가능성을 지키면서 불필요한 세리머니를 줄인다. 결국 팀 규모와 앱 복잡도, 그리고 "값의 출처를 추적 못 해서 생긴 버그"의 과거 이력이 기준이 된다.

## 트레이드오프 ③ 스냅샷과 의존성 배열

React의 렌더링 모델을 가장 아프게 체감시켜 주는 코드가 있다. 1초마다 1씩 늘어나야 할 스톱워치가 1초 뒤 1이 되고 그 뒤로 영원히 멈춘다.

```jsx
function StopWatch() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(seconds + 1); // ⚠️ 이 seconds는 "0이었던 그 순간"의 값
    }, 1000);
    return () => clearInterval(id);
  }, []); // 딱 한 번만 등록됨
}
```

원인은 React의 **스냅샷 모델**에 있다. React는 컴포넌트가 렌더링될 때마다 그 순간의 상태 값을 전부 사진 찍듯 복사해서 컴포넌트 함수를 실행한다.

```
[렌더 1] seconds = 0  ← 이 시점의 사진 속에서 seconds는 영원히 0
[렌더 2] seconds = 1  ← 이 시점의 사진 속에서 seconds는 영원히 1
```

렌더 1의 코드 안에서 `seconds`를 읽으면, 세상이 몇 초가 지났든 무조건 0이 나온다. 그런데 `setInterval`의 콜백은 렌더 1 시점에 만들어진 함수고, 만들어진 시점의 변수들을 평생 기억하는 성질(클로저) 때문에 1분 뒤에도 렌더 1의 사진 속 `seconds = 0`만 본다. 그래서 매초 `setSeconds(0 + 1)`이 실행되고 화면은 영원히 1이다.

이 모델을 택한 이유는 예측 가능성 때문이다. 만약 스냅샷이 없고 값이 바뀔 때마다 지워졌다 다시 쓰이는 **칠판 하나**를 모든 코드가 함께 보는 모델(Vue·Svelte 계열)이라면, 이 버그는 애초에 발생하지 않는다. 하지만 칠판 모델에서는 누가 언제 칠판을 고쳤는지 추적이 어렵고, "이 화면이 그려진 근거 상태"가 무엇인지 알기 어렵다. React는 최신값을 항상 보는 변수의 편리함을 내놓고, 예측 가능성을 택한 것이다.

### "시점"으로 나누던 코드를 "무엇을 위해"로 나눈다

렌더 이후의 시간 흐름(타이머, 구독, 정리)을 다루는 도구가 `useEffect`다. 클래스 시대와 비교하면 이해하기 쉬운 쪽은 훅 쪽이고, 이유는 응집도다.

클래스 시대에는 타이머 하나를 쓰려면 `componentDidMount`(등록)와 `componentWillUnmount`(해제) 두 곳에 코드를 흩어 써야 했다. 거꾸로 mount 시점에는 타이머 + 구독 + 로깅처럼 서로 다른 관심사가 한 메서드에 뭉치고, update 시점에도 비슷한 코드를 복사해서 붙여야 했다. `useEffect`에서는 "타이머"라는 관심사 하나가 등록과 `return () => clearInterval(id)`(정리)로 인접하게 모인다. 정리 함수를 잊기 어렵고, StrictMode가 cleanup 누락을 개발 중에 바로 드러내 준다.

실수하기 쉬운 쪽은 둘 다지만, 실수의 종류가 다르다.

| 구분 | 실수의 종류 | 드러나는 방식 |
| :--- | :--- | :--- |
| 클래스 | `componentWillUnmount`에서 해제 깜빡(메모리 누수), mount/update 로직 복붙 중복 | 암묵적 — 조용히 숨어 프로덕션까지 감 |
| `useEffect` | 의존성 배열 — 빈 배열의 stale closure(위 스톱워치 버그), 빠뜨림, 과다 주입으로 무한 재실행 | 명시적 — 배열이라는 계약이 코드에 보임 |

핵심은 이것이다. **`useEffect`는 실수 자리가 명시적이다. 명시적 실수는 학습 비용이지만, 암묵적 실수는 버그 비용이다.** 다만 그 대가로 의존성 배열이라는 새로운 개념을 배워야 하고, 앞의 스톱워치 버그가 그 학습 비용이 어떤 것인지 그대로 보여준다.

### useEffect를 쓰기 전의 기준 질문

과일 목록을 검색어로 걸러 보여주는 컴포넌트에서, 검색어(`query`)가 바뀔 때마다 렌더가 두 번 일어나는 현상이 관찰됐다. 첫 번째는 query가 바뀌어서 일어난 필요한 렌더고, 두 번째는 effect 안의 `setFiltered(...)`가 또 렌더를 일으킨 불필요한 것이다.

```jsx
// 수정 전: query가 바뀐 뒤 effect가 한 번 더 렌더를 일으킨다
const [filtered, setFiltered] = useState(FRUITS);
useEffect(() => {
  setFiltered(FRUITS.filter((f) => f.toLowerCase().includes(query.toLowerCase())));
}, [query]);

// 수정 후: 렌더 중에 계산 — 렌더는 정확히 한 번
const filtered = FRUITS.filter((f) => f.toLowerCase().includes(query.toLowerCase()));
```

`filtered`는 `query`만 있으면 계산되는 파생값이므로, 상태와 effect를 지우고 렌더 중에 계산하자 입력마다 렌더가 정확히 한 번이 됐고 `filtered`가 뒤처질 위험도 구조적으로 사라졌다.

그래서 effect를 다루는 기준이 되는 한 문장은 이것이다.

> **"이 값(또는 이 작업), 이미 가진 상태만으로 계산(또는 처리)할 수 없나?"**

- **계산 가능한 파생값이면** — 상태도 만들지 말고 effect도 쓰지 말고 렌더 중에 계산한다. 앞서 정리한 원칙("계산 가능한 값은 state로 만들지 않는다")이 effect에도 똑같이 적용된다.
- **그 질문을 통과했는데도 effect가 필요하다면** — 다음 기준은 "이건 외부 시스템(타이머·구독·서버)과의 동기화인가, 아니면 이벤트 핸들러로 충분한가?"다. 타이핑에 반응하는 UI 로직은 이벤트 핸들러에, 외부 동기화만 effect에 둔다. 이 체크리스트 전체가 공식 문서 *You Might Not Need an Effect*의 내용이다.

## 마치며 — 함정을 드러내는 설계

지금까지의 흐름을 한 줄로 잇면 이렇다. 바닐라 JavaScript에서 갱신 책임의 무게를 직접 짊어지고, React가 그 책임을 가져가는 방식을 확인했으며, 그 대가인 세 가지 트레이드오프를 실측하고 부딪혀 봤다.

| 트레이드오프 | 얻은 것 | 내놓은 것 |
| --- | --- | --- |
| ① 전체 다시 그리기 | 갱신 누락의 원천적 제거 | 렌더링 성능 관리(memo, 불변성) 책임 |
| ② 제어 컴포넌트 | 값의 출처 추적 가능 | input 하나당 세 줄의 세리머니 |
| ③ 스냅샷 모델 | 예측 가능한 렌더링 | 스냅샷 개념 + 의존성 배열 학습 |

세 가지의 공통점이 보인다. React는 **자동으로 추론해 주는 마법을 줄이고, 개발자가 명시적으로 선언하는 계약을 늘리는 방향**으로 설계됐다. 그래서 React를 잘 다룬다는 건 문법을 외우는 게 아니라, 각 계약이 왜 존재하는지 이해하는 일이다. 이제 `useState`와 `onChange` 세 줄을 붙일 때도, 의존성 배열을 채울 때도 그 뒤에 있는 트레이드오프가 보인다.

### 참고 자료

- [State as a Snapshot](https://react.dev/learn/state-as-a-snapshot) · [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates)
- [useEffect](https://react.dev/reference/react/useEffect) · [useRef](https://react.dev/reference/react/useRef) · [StrictMode](https://react.dev/reference/react/StrictMode) · [memo](https://react.dev/reference/react/memo)
- React v16.8 발표 블로그 (2019) — <https://legacy.reactjs.org/blog/2019/02/06/react-v16.8.0.html>
- Hooks RFC — <https://github.com/reactjs/rfcs/pull/68>
