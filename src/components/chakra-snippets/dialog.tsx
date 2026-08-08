import {Dialog as ChakraDialog, Portal, Theme} from '@chakra-ui/react';
import {CloseButton} from './close-button';
import * as React from 'react';

interface DialogContentProps extends ChakraDialog.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  backdrop?: boolean;
  // Force a colour mode on the dialog, whatever the page around it is using. The
  // only addition to this file (a vendored snippet) beyond the upstream original,
  // and deliberately a capability rather than a policy: unset renders no wrapper at
  // all, so a caller that doesn't ask for this is byte-for-byte unchanged.
  appearance?: 'light' | 'dark';
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(props, ref) {
  const {
    children,
    portalled = true,
    portalRef,
    backdrop = true,
    appearance,
    ...rest
  } = props;

  const content = (
    <>
      {backdrop && <ChakraDialog.Backdrop />}
      <ChakraDialog.Positioner>
        <ChakraDialog.Content ref={ref} {...rest} asChild={false}>
          {children}
        </ChakraDialog.Content>
      </ChakraDialog.Positioner>
    </>
  );

  return (
    <Portal disabled={!portalled} container={portalRef}>
      {appearance ? (
        // Inside the portal, because that is where the DOM lands — a wrapper around
        // DialogRoot would not contain it. Around the positioner rather than between
        // it and the content, so the positioner's own layout is untouched; it is a
        // plain block div around two fixed elements, so it adds no layout and no
        // stacking context. hasBackground={false} because the panel paints itself —
        // without it this would lay a full-bleed sheet over the page.
        <Theme appearance={appearance} hasBackground={false}>
          {content}
        </Theme>
      ) : (
        content
      )}
    </Portal>
  );
});

export const DialogCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraDialog.CloseTriggerProps
>(function DialogCloseTrigger(props, ref) {
  return (
    <ChakraDialog.CloseTrigger
      position="absolute"
      top="2"
      insetEnd="2"
      {...props}
      asChild
    >
      <CloseButton size="sm" ref={ref}>
        {props.children}
      </CloseButton>
    </ChakraDialog.CloseTrigger>
  );
});

export const DialogRoot = ChakraDialog.Root;
export const DialogFooter = ChakraDialog.Footer;
export const DialogHeader = ChakraDialog.Header;
export const DialogBody = ChakraDialog.Body;
export const DialogBackdrop = ChakraDialog.Backdrop;
export const DialogTitle = ChakraDialog.Title;
export const DialogDescription = ChakraDialog.Description;
export const DialogTrigger = ChakraDialog.Trigger;
export const DialogActionTrigger = ChakraDialog.ActionTrigger;
