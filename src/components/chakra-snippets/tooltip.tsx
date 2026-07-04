import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react"
import * as React from "react"

export interface TooltipProps extends ChakraTooltip.RootProps {
  showArrow?: boolean
  portalled?: boolean
  portalRef?: React.RefObject<HTMLElement>
  content: React.ReactNode
  contentProps?: ChakraTooltip.ContentProps
  disabled?: boolean
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(props, ref) {
    const {
      showArrow,
      children,
      disabled,
      portalled = true,
      content,
      contentProps,
      portalRef,
      ...rest
    } = props

    // Each tooltip mounts its own Ark state machine + listeners. In lists/tables
    // with a tooltip per row that's the dominant mount/re-render cost, even
    // though most rows are never hovered. So for uncontrolled tooltips we defer
    // the entire machine until the first hover/focus: until then we render just
    // the child with lightweight activation handlers. The interaction that
    // mounts the tooltip also opens it (we start `open` true), so it appears on
    // that same hover rather than requiring a second one — the only visible
    // difference is the first show skips `openDelay`.
    //
    // Ark's own `lazyMount`/`unmountOnExit` don't help here: they only defer the
    // Content portal, while `Tooltip.Root` still spins up a Zag state machine +
    // trigger listeners per instance — which is the exact per-row cost we avoid
    // by not rendering `Tooltip.Root` at all until activation.
    const [activated, setActivated] = React.useState(false)
    const [open, setOpen] = React.useState(false)

    // Consumers that drive `open`/`defaultOpen` themselves opt out of lazy
    // mounting and keep full control — they're one-off tooltips, not the
    // per-row case this optimises.
    const controlled = rest.open !== undefined || rest.defaultOpen !== undefined

    if (disabled) return children

    if (!controlled && !activated && React.isValidElement(children)) {
      const el = children as React.ReactElement<{
        onPointerEnter?: React.PointerEventHandler
        onFocus?: React.FocusEventHandler
      }>
      const activate = () => {
        setActivated(true)
        setOpen(true)
      }
      return React.cloneElement(el, {
        onPointerEnter: (e) => {
          el.props.onPointerEnter?.(e)
          // Skip touch: tooltips are hover/focus affordances and shouldn't pop
          // on a tap (matches Ark's default, which never opens on touch).
          if (e.pointerType !== "touch") activate()
        },
        onFocus: (e) => {
          el.props.onFocus?.(e)
          activate()
        },
      })
    }

    // Once activated we own open/onOpenChange (starts open from the activating
    // interaction, then follows Ark's hover/focus + delays). Controlled
    // consumers keep their own open/onOpenChange via `rest`.
    const openProps: Partial<ChakraTooltip.RootProps> = controlled
      ? {}
      : { open, onOpenChange: (e) => setOpen(e.open) }

    return (
      <ChakraTooltip.Root {...rest} {...openProps}>
        <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
        <Portal disabled={!portalled} container={portalRef}>
          <ChakraTooltip.Positioner>
            <ChakraTooltip.Content ref={ref} {...contentProps}>
              {showArrow && (
                <ChakraTooltip.Arrow>
                  <ChakraTooltip.ArrowTip />
                </ChakraTooltip.Arrow>
              )}
              {content}
            </ChakraTooltip.Content>
          </ChakraTooltip.Positioner>
        </Portal>
      </ChakraTooltip.Root>
    )
  },
)
