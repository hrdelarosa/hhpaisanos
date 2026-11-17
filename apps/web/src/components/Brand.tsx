export function Brand({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  return variant === 'full' ? (
    <img
      src="/paisanos.webp"
      alt="Heroínas y Héroes Paisanos"
      width="2048"
      height="1024"
      className="h-auto w-full object-contain"
    />
  ) : (
    <img
      src="/paisanos-logo.webp"
      alt="Heroínas y Héroes Paisanos"
      width="1330"
      height="1182"
      className="h-10 w-12 shrink-0 object-contain"
    />
  );
}
