// ── 사이트 전역 설정 ────────────────────────────────────────────
export const SITE = {
  /** 헤더 좌측 브랜드명 */
  name: 'minjaekim.dev',
  /** 브랜드 옆 작은 태그 */
  tag: 'devlog',
  title: 'minjaekim.dev | devlog',
  description: '프론트엔드 개발자 김민재의 개발 블로그',
  author: '김민재',
  url: 'https://minjaekim.dev',
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
