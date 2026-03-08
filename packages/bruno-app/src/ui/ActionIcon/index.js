import { useId } from 'react';
import { Tooltip } from 'react-tooltip';
import { useTheme } from 'providers/Theme';
import StyledWrapper from './StyledWrapper';

/**
 * ActionIcon - A reusable icon button component
 *
 * @param {Object} props
 * @param {ReactNode} props.children - The icon component to render
 * @param {string} props.variant - Visual variant: 'subtle' (default), 'filled', 'outline', etc.
 * @param {string} props.size - Size of the button: 'sm', 'md', 'lg', etc. (default: 'md')
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.className - Additional CSS class names
 * @param {string} props.component - Polymorphic component (default: 'button')
 * @param {string} props.label - Tooltip text, aria-label, and title (preferred)
 * @param {string} [props.ariaLabel] - Accessibility label (falls back to label)
 * @param {string} props.colorOnHover - Color to apply to icon on hover/focus
 * @param {string} props.color - Color to override the default variant color
 * @param {Object} props.style - Style object to override the default variant style
 * @param {string} props.tooltipPlace - Tooltip placement: 'top' (default), 'bottom', 'left', 'right'
 * @param {Object} props...rest - Other props passed to the underlying element
 */
const ActionIcon = ({
  children,
  variant = 'subtle',
  size = 'md',
  disabled = false,
  className = '',
  component: Component = 'button',
  label,
  'aria-label': ariaLabel,
  colorOnHover,
  color,
  style,
  tooltipPlace = 'top',
  ...rest
}) => {
  const uid = useId();
  const tooltipId = label ? `action-icon-tooltip-${uid.replace(/:/g, '')}` : undefined;
  const { theme } = useTheme();

  const classNames = ['action-icon', className].filter(Boolean).join(' ');

  return (
    <>
      <StyledWrapper
        as={Component}
        id={tooltipId}
        $variant={variant}
        $size={size}
        $colorOnHover={colorOnHover}
        $color={color}
        disabled={disabled}
        className={classNames}
        aria-label={ariaLabel || label}
        style={style}
        {...rest}
      >
        {children}
      </StyledWrapper>
      {label && tooltipId && (
        <Tooltip
          anchorId={tooltipId}
          content={label}
          place={tooltipPlace}
          noArrow
          delayShow={300}
          opacity={1}
          border={`1px solid ${theme?.border?.border1 || 'rgba(255,255,255,0.08)'}`}
          style={{
            fontSize: '0.7rem',
            fontWeight: 500,
            letterSpacing: '0.01em',
            padding: '4px 8px',
            borderRadius: '4px',
            zIndex: 99999,
            backgroundColor: theme?.background?.surface2 || '#1e1e1e',
            color: theme?.text || '#e2e2e2',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            pointerEvents: 'none'
          }}
        />
      )}
    </>
  );
};

export default ActionIcon;
