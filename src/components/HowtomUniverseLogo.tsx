interface HowtomUniverseLogoProps {
  compact?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

function PlanetO({ wordmark = false }: { wordmark?: boolean }) {
  return (
    <span
      className={`howtom-logo-planet${wordmark ? ' howtom-logo-planet--wordmark' : ''}`}
      aria-hidden="true"
    >
      <span className="howtom-logo-ring-back" />
      <span className="howtom-logo-planet-body" />
      <span className="howtom-logo-ring-front" />
    </span>
  );
}

/**
 * HOWTOM 유니버스 브랜드 워드마크.
 * 이미지 파일 없이 HTML + CSS만으로 렌더링합니다.
 *
 * - 펼친 사이드바: H + 행성 O + WTOM / 유니버스
 * - 접힌 사이드바: H + 행성 O + W
 */
export function HowtomUniverseLogo({ compact = false, theme = 'dark', className = '' }: HowtomUniverseLogoProps) {
  return (
    <span
      className={`howtom-css-logo ${compact ? 'is-compact' : ''} theme-${theme} ${className}`.trim()}
      aria-label="HOWTOM 유니버스"
      role="img"
    >
      {compact ? (
        <span className="howtom-mini-brand" aria-hidden="true">
          <span className="howtom-mini-letter">H</span>
          <PlanetO />
          <span className="howtom-mini-letter">W</span>
        </span>
      ) : (
        <>
          <span className="howtom-css-logo-word" aria-hidden="true">
            <span className="howtom-full-letter">H</span>
            <PlanetO wordmark />
            <span className="howtom-full-letter">WTOM</span>
          </span>
          <span className="howtom-css-logo-korean" aria-hidden="true">
            <span>유</span><span>니</span><span>버</span><span>스</span>
          </span>
        </>
      )}
    </span>
  );
}
