import {getImageProps} from 'next/image';

// Keep the original desktop photograph and CMS URL. Only small screens use
// Next's verified, cached image pipeline; uploaded/remote media stays untouched.
export function ResponsivePhoto({src, alt = '', sizes = '100vw', width, height, ...props}) {
  const local = typeof src === 'string' && src.startsWith('/images/') && !src.endsWith('.svg');
  const optimized = local ? getImageProps({src, alt, width: Number(width) || 1200, height: Number(height) || 800, sizes, quality: 75}).props : null;
  return <picture style={{display: 'contents'}}>
    {optimized && <source media="(max-width: 767px)" srcSet={optimized.srcSet} sizes={sizes} />}
    <img {...props} src={src} alt={alt} width={width} height={height} />
  </picture>;
}
