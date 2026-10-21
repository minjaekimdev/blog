/** 날짜를 YYYY-MM-DD 형태로 변환합니다. */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 카테고리 키를 한글 라벨로 변환합니다. */
export function categoryLabel(category: string): string {
  return category === 'retrospective' ? '회고' : '아티클';
}
