import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  useFloating,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
  autoUpdate,
  offset,
  flip,
  shift
} from '@floating-ui/react';
import StyledWrapper from './StyledWrapper';

const Dropdown = ({
  icon,
  children,
  onCreate,
  placement,
  transparent,
  visible,
  appendTo,
  onMouseEnter,
  onMouseLeave,
  onClickOutside,
  style,
  // Consume unknown Tippy-specific props to avoid passing to DOM

  interactive,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const floatingElRef = useRef(null);
  const onShowRef = useRef(null);
  const onHideRef = useRef(null);
  const isControlledRef = useRef(visible !== undefined);
  const onClickOutsideRef = useRef(onClickOutside);

  const isControlled = visible !== undefined;

  useEffect(() => { isControlledRef.current = isControlled; }, [isControlled]);
  useEffect(() => { onClickOutsideRef.current = onClickOutside; }, [onClickOutside]);

  const open = isControlled ? visible : isOpen;

  const handleOpenChange = useCallback((nextOpen, event) => {
    if (!isControlledRef.current) {
      setIsOpen(nextOpen);
    } else if (!nextOpen) {
      onClickOutsideRef.current?.(null, event);
    }
  }, []);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: handleOpenChange,
    placement: placement || 'bottom-end',
    strategy: 'fixed',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  });

  const click = useClick(context, { enabled: !isControlled });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  // Fire onShow/onHide compat callbacks
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      onShowRef.current?.();
    } else if (!open && prevOpenRef.current) {
      onHideRef.current?.();
    }
    prevOpenRef.current = open;
  }, [open]);

  // Combined ref for floating element
  const setFloatingRef = useCallback((node) => {
    refs.setFloating(node);
    floatingElRef.current = node;
  }, [refs]);

  // Expose compat instance via onCreate (once on mount)
  useEffect(() => {
    if (!onCreate) return;
    const instance = {
      hide: () => { if (!isControlledRef.current) setIsOpen(false); else onClickOutsideRef.current?.(null, null); },
      show: () => { if (!isControlledRef.current) setIsOpen(true); },
      get popper() { return floatingElRef.current; },
      setProps: ({ onShow, onHide } = {}) => {
        if (onShow) onShowRef.current = onShow;
        if (onHide) onHideRef.current = onHide;
      }
    };
    onCreate(instance);
  }, [onCreate]);

  // Always use a real wrapper div as the reference so Floating UI always gets a valid
  // bounding rect, regardless of whether `icon` forwards refs or not.
  // display: inline-flex shrinkwraps to content with minimal layout impact.
  const trigger = (
    <div ref={refs.setReference} {...getReferenceProps()} style={{ display: 'inline-flex' }}>
      {icon}
    </div>
  );

  return (
    <>
      {trigger}
      {open && (
        <FloatingPortal>
          <StyledWrapper
            ref={setFloatingRef}
            className="dropdown"
            transparent={transparent}
            tabIndex={-1}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{ ...floatingStyles, ...(style || {}) }}
            {...getFloatingProps()}
            {...props}
          >
            {children}
          </StyledWrapper>
        </FloatingPortal>
      )}
    </>
  );
};

export default Dropdown;
