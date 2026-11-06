// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // 배포 도메인 (RSS/Sitemap에 사용됩니다). 도메인 구매 시 이 값만 바꾸면 됩니다.
  site: 'https://minjaekimdev.vercel.app',
  markdown: {
    shikiConfig: {
      // 라이트/다크 테마에 따라 코드 하이라이트가 바뀌도록 dual-theme 설정
      themes: {
        light: 'github-light',
        dark: 'one-dark-pro',
      },
    },
  },
});
