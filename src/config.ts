// ── 사이트 전역 설정 ────────────────────────────────────────────
export const SITE = {
  /** 헤더 좌측 브랜드명 */
  name: 'minjaekim.blog',
  title: 'minjaekim.blog',
  description: '프론트엔드 개발자 김민재의 개발 블로그',
  author: '김민재',
  url: 'https://minjaekimdev.vercel.app',
};

// ── 연락처 ─────────────────────────────────────────────────────
// 푸터와 소개(Contact) 페이지에서 함께 사용한다.
export const CONTACT = {
  email: 'minjaekimm1@gmail.com',
  /** 화면에 보여줄 전화번호 */
  phoneDisplay: '010-3048-8058',
  /** 전화 걸기 링크용 국제 표기 */
  phoneHref: 'tel:+821030488058',
  linkedin:
    'https://www.linkedin.com/in/%EB%AF%BC%EC%9E%AC-%EA%B9%80-a731033a7/',
};

// ── 홈 히어로 문구 ──────────────────────────────────────────────
export const HERO = {
  name: '김민재',
  greeting: '안녕하세요, 프론트엔드 개발자 김민재입니다.',
};

// ── 작성자 식별 ────────────────────────────────────────────────
// .env의 AUTHOR_GITHUB_USERNAME 값을 읽는다.
// 댓글 시스템에서 이 계정에만 답글 권한을 부여한다.
export const AUTHOR_GITHUB_USERNAME =
  (import.meta.env.AUTHOR_GITHUB_USERNAME as string | undefined) ?? '';
