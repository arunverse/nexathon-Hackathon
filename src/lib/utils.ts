export function cn(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  return classes
    .flatMap((cls) => {
      if (!cls) return []
      if (typeof cls === 'string') return [cls]
      return Object.entries(cls)
        .filter(([, v]) => v)
        .map(([k]) => k)
    })
    .join(' ')
}
