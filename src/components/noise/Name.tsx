import {Badge} from '@chakra-ui/react';
import {type ReactNode} from 'react';

// A name from the data — a device, a place, a project, a comment's own words — where it is
// spoken inside a dialog's own sentences, set apart so it reads as the thing being talked
// about rather than as more of the sentence. One component, so how a name is set is one
// decision: change it here and every dialog follows.
//
// Chakra's subtle badge in blue — the colour of a selection everywhere else on the page, so a
// name reads as a picked value rather than as emphasis. At the size and line height of the
// sentence it sits in, title or body, rather than the badge's own smaller type, so a line with
// a name in it keeps its height; nowrap, so a name is never split across two lines.
export function Name({children}: {children: ReactNode}) {
  return (
    <Badge
      variant="subtle"
      colorPalette="blue"
      fontSize="inherit"
      lineHeight="inherit"
      fontWeight="medium"
      verticalAlign="baseline"
      whiteSpace="nowrap"
    >
      {children}
    </Badge>
  );
}
