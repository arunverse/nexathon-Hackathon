import React from 'react'

export interface EbextaLogoProps {
  /**
   * 'horizontal' = Mark + EBEXTA wordmark side by side (standard header/nav layout)
   * 'mark' = Just the stylized BX emblem
   * 'stacked' = Mark centered above EBEXTA wordmark (primary logo variant)
   */
  variant?: 'horizontal' | 'mark' | 'stacked'

  /**
   * 'dark' = white text / bright cyan-blue gradient for dark backgrounds
   * 'light' = dark #111727 text / blue gradient for light backgrounds
   * 'auto' = uses light or dark according to dark mode
   */
  theme?: 'dark' | 'light' | 'auto'

  /**
   * Pre-set sizing or custom height in px
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number

  className?: string
  style?: React.CSSProperties
  alt?: string
  priority?: boolean
  onClick?: () => void
}

const SIZE_MAP: Record<string, { height: number; markHeight: number }> = {
  xs: { height: 20, markHeight: 20 },
  sm: { height: 26, markHeight: 26 },
  md: { height: 32, markHeight: 32 },
  lg: { height: 42, markHeight: 42 },
  xl: { height: 56, markHeight: 56 },
}

export function EbextaLogo({
  variant = 'horizontal',
  theme = 'auto',
  size = 'md',
  className = '',
  style = {},
  alt = 'EBEXTA Verified B2B Intelligence',
  priority = false,
  onClick,
}: EbextaLogoProps) {
  const isNumeric = typeof size === 'number'
  const preset = isNumeric ? null : (SIZE_MAP[size] || SIZE_MAP.md)
  const targetHeight = isNumeric ? size : preset!.height
  const markHeight = isNumeric ? size : preset!.markHeight

  if (variant === 'mark') {
    return (
      <img
        src="/ebexta-mark.png"
        alt={alt}
        height={markHeight}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onClick={onClick}
        className={`inline-block shrink-0 object-contain ${className}`}
        style={{
          height: markHeight,
          width: 'auto',
          aspectRatio: '1 / 1',
          ...style,
        }}
      />
    )
  }

  if (variant === 'stacked') {
    return (
      <span
        className={`inline-flex items-center justify-center select-none ${className}`}
        style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
        onClick={onClick}
      >
        {theme === 'auto' ? (
          <>
            <img
              src="/ebexta-primary-light.png"
              alt={alt}
              height={targetHeight}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="ebexta-logo-light dark:hidden inline-block object-contain"
              style={{ height: targetHeight, width: 'auto', ...style }}
            />
            <img
              src="/ebexta-primary-dark.png"
              alt={alt}
              height={targetHeight}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="ebexta-logo-dark hidden dark:inline-block object-contain"
              style={{ height: targetHeight, width: 'auto', ...style }}
            />
          </>
        ) : (
          <img
            src={theme === 'dark' ? '/ebexta-primary-dark.png' : '/ebexta-primary-light.png'}
            alt={alt}
            height={targetHeight}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="inline-block object-contain"
            style={{ height: targetHeight, width: 'auto', ...style }}
          />
        )}
      </span>
    )
  }

  // Horizontal variant (default)
  // When theme is 'auto', we can render the dark logo for dark-theme pages or let classes control it
  const src =
    theme === 'dark'
      ? '/ebexta-horizontal-dark.png'
      : theme === 'light'
      ? '/ebexta-horizontal-light.png'
      : '/ebexta-horizontal-light.png'

  return (
    <span
      className={`inline-flex items-center select-none ${className}`}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
      onClick={onClick}
    >
      {theme === 'auto' ? (
        <>
          {/* Light mode */}
          <img
            src="/ebexta-horizontal-light.png"
            alt={alt}
            height={targetHeight}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="ebexta-logo-light dark:hidden inline-block object-contain"
            style={{ height: targetHeight, width: 'auto' }}
          />
          {/* Dark mode */}
          <img
            src="/ebexta-horizontal-dark.png"
            alt={alt}
            height={targetHeight}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="ebexta-logo-dark hidden dark:inline-block object-contain"
            style={{ height: targetHeight, width: 'auto' }}
          />
        </>
      ) : (
        <img
          src={src}
          alt={alt}
          height={targetHeight}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="inline-block object-contain"
          style={{ height: targetHeight, width: 'auto' }}
        />
      )}
    </span>
  )
}

export default EbextaLogo
