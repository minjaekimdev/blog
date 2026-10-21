// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // TODO: 실제 배포 도메인으로 변경하세요 (RSS/Sitemap에 사용됩니다)
  site: 'https://minjae.dev',
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
