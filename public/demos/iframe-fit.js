// ============================================
// 블로그 글(부모) 쪽: 데모가 보내온 높이 메시지를 받아 iframe 높이를 맞추는 스크립트
//
// 사용법: 글 본문에서 iframe 바로 아래에 아래 한 줄을 추가
//   <script src="/demos/iframe-fit.js"></script>
//
// 한 페이지에 iframe이 여러 개여도, "메시지를 보낸 바로 그 iframe"만 찾아서
// 높이를 적용하므로 그대로 재사용할 수 있다.
// ============================================
(function () {
  'use strict';

  window.addEventListener('message', function (e) {
    var msg = e.data;
    // 우리가 약속한 형식의 메시지만 처리한다
    if (!msg || msg.type !== 'demo:height' || typeof msg.height !== 'number') return;

    // 메시지를 보낸 window(e.source)와 일치하는 iframe을 찾아 높이를 적용한다.
    // 창 객체끼리의 "같은 창인가?" 비교는 서로 다른 출처(크로스 오리진)여도 허용된다.
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i].contentWindow === e.source) {
        iframes[i].style.height = msg.height + 'px';
        return;
      }
    }
  });
})();
