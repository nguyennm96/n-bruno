import React from 'react';
import StyledWrapper from './StyledWrapper';

/**
 * Skeleton loading placeholder.
 * Use whenever async content is loading to prevent empty flash.
 *
 * @param {string} width  - CSS width value (default: '100%')
 * @param {string} height - CSS height value (default: '1rem')
 * @param {string} borderRadius - CSS border-radius value (default: theme.border.radius.base)
 */
const Skeleton = ({ width, height, borderRadius, className, style }) => {
  return (
    <StyledWrapper
      $width={width}
      $height={height}
      $borderRadius={borderRadius}
      className={className}
      style={style}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
