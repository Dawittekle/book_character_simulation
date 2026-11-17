import React from 'react';
import './Skeleton.css';

/**
 * Base Lorely Skeleton block
 */
export default function Skeleton({
  className = '',
  width,
  height,
  borderRadius,
  style = {},
  ...props
}) {
  const inlineStyle = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...(borderRadius !== undefined
      ? { borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius }
      : {}),
    ...style,
  };

  return (
    <div
      className={`lorely-skeleton ${className}`.trim()}
      style={inlineStyle}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Skeleton Line for text and headers
 * length: 'short' (40%) | 'medium' (70%) | 'long' (95%) | undefined (100%)
 */
Skeleton.Line = function SkeletonLine({
  count = 1,
  length,
  height = 14,
  className = '',
  style = {},
  ...props
}) {
  const lengthClass = length ? length : '';
  const heightStyle = height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {};

  if (count <= 1) {
    return (
      <div
        className={`lorely-skeleton lorely-skeleton-line ${lengthClass} ${className}`.trim()}
        style={{ ...heightStyle, ...style }}
        aria-hidden="true"
        {...props}
      />
    );
  }

  return (
    <div className="lorely-skeleton-line-group" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => {
        // Subtle variation on the last line if count > 1 and no explicit length
        const isLast = index === count - 1;
        const lineLength = length || (isLast ? 'medium' : '');
        return (
          <div
            key={index}
            className={`lorely-skeleton lorely-skeleton-line ${lineLength} ${className}`.trim()}
            style={{ ...heightStyle, ...style }}
            {...props}
          />
        );
      })}
    </div>
  );
};

/**
 * Skeleton Circle for avatars, circular icons, badges
 */
Skeleton.Circle = function SkeletonCircle({
  size = 48,
  className = '',
  style = {},
  ...props
}) {
  const dimension = typeof size === 'number' ? `${size}px` : size;
  return (
    <div
      className={`lorely-skeleton lorely-skeleton-circle ${className}`.trim()}
      style={{
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
};

/**
 * Skeleton Card for book items in Discover / Library grids
 */
Skeleton.Card = function SkeletonCard({
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      className={`lorely-skeleton-card ${className}`.trim()}
      style={style}
      aria-hidden="true"
      data-testid="skeleton-card"
      {...props}
    >
      <div className="lorely-skeleton lorely-skeleton-cover" />
      <div className="lorely-skeleton-card-info">
        <Skeleton.Line length="long" height={16} />
        <Skeleton.Line length="short" height={12} />
      </div>
    </div>
  );
};

/**
 * Skeleton Table for admin dashboards and data views
 */
Skeleton.Table = function SkeletonTable({
  rows = 5,
  columns = 6,
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      className="admin-table-wrapper"
      data-testid="skeleton-table"
      aria-hidden="true"
    >
      <table
        className={`lorely-skeleton-table admin-telemetry-table ${className}`.trim()}
        style={style}
        {...props}
      >
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, c) => (
              <th key={`sk-th-${c}`}>
                <Skeleton.Line length="medium" height={14} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={`sk-tr-${r}`}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={`sk-td-${r}-${c}`}>
                  <Skeleton.Line length={c === 0 ? 'long' : 'medium'} height={14} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
