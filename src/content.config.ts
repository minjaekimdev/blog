import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 블로그 글 컬렉션
 * - article: 기술 아티클
 * - retrospective: 회고
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(['article', 'retrospective']),
    tags: z.array(z.string()).default([]),
    thumbnail: z.string().optional(),
    pinned: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
