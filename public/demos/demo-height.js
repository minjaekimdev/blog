// ============================================
// 데모(iframe 안) → 블로그 글(밖)으로 자기 높이를 알려주는 스크립트
//
// 사용법: 데모 html의 </body> 직전에 아래 한 줄을 추가
//   <script src="/demos/demo-height.js"></script>
//
// 원리:
//   1. document.body.scrollHeight = 실제 컨텐츠 높이 (뷰포트 클램프 없음)
//   2. parent.postMessage(...) = iframe을 감싸고 있는 부모 페이지에 메시지 전달
//      (sandbox="allow-scripts"여도 postMessage는 허용됨)
//   3. ResizeObserver = 화면 폭이 변해 내용 배치가 바뀌면 다시 측정해서 전송
//
// 주의 — documentElement(body가 아닌 html)의 scrollHeight를 쓰면 안 된다.
//   html의 scrollHeight는 "컨텐츠 높이와 iframe 뷰포트 높이 중 큰 값"을 반환한다.
//   부모가 넣어둔 예비 height가 컨텐츠보다 크면 뷰포트가 그만큼 커지고,
//   측정값도 뷰포트 높이로 부풀려져 여백이 생긴 채로 고정된다.
//   반면 body는 높이가 auto라서 컨텐츠 높이 그대로 반환된다.
// ============================================
(function () {
  'use strict';

  var last = 0;

  function send() {
    var height = document.body.scrollHeight;
    // 1~2px 오차는 무시해서 불필요한 메시지를 줄인다
    if (Math.abs(height - last) < 2) return;
    last = height;
    parent.postMessage({ type: 'demo:height', height: height }, '*');
  }

  // body를 관찰한다. html을 관찰하면 부모가 iframe 높이를 바꿀 때마다
  // (뷰포트 크기 변화로 html 크기가 따라 바뀌므로) 불필요하게 관찰되지만,
  // body의 크기는 컨텐츠 배치가 실제로 바뀔 때만 변한다.
  new ResizeObserver(send).observe(document.body);
  window.addEventListener('load', send);
  send();
})();

