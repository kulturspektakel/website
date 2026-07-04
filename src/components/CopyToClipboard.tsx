import {useEffect, useRef, useState} from 'react';
import {Box, type BoxProps} from '@chakra-ui/react';
import {Tooltip} from './chakra-snippets/tooltip';

// Clickable wrapper that copies `text` to the clipboard instead of doing
// whatever the wrapped element would normally do (e.g. open a mail client).
// Shows a short "Kopiert!" confirmation via a tooltip. Renders as a button so
// it's keyboard-accessible; callers style it through the spread Box props.
export function CopyToClipboard({
  text,
  children,
  ...props
}: {
  text: string;
  children: React.ReactNode;
} & BoxProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The modal can unmount mid-copy (e.g. arrow-navigating to the next band),
  // so cancel a pending reset rather than setting state on an unmounted tree.
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      // Force the tooltip open immediately with the "Kopiert!" confirmation,
      // then let it fall back to the hover-driven "Kopieren" label.
      setCopied(true);
      setOpen(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    });
  };

  return (
    <Tooltip
      content={copied ? 'Kopiert!' : 'Kopieren'}
      showArrow
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      openDelay={0}
      closeDelay={0}
    >
      <Box asChild cursor="pointer" textAlign="inherit" {...props}>
        <button type="button" onClick={handleCopy}>
          {children}
        </button>
      </Box>
    </Tooltip>
  );
}
