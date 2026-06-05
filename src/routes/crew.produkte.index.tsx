import {createFileRoute, redirect} from '@tanstack/react-router';
import {Text} from '@chakra-ui/react';
import {listProductLists} from './crew.produkte';

export const Route = createFileRoute('/crew/produkte/')({
  loader: async () => {
    const lists = await listProductLists();
    const target = lists.find((l) => l.active) ?? lists[0];
    if (target) {
      throw redirect({
        to: '/crew/produkte/$listId',
        params: {listId: String(target.id)},
      });
    }
  },
  component: ProdukteIndex,
});

function ProdukteIndex() {
  return (
    <Text color="fg.muted">
      Wähle oben eine Produktliste aus oder lege eine neue an.
    </Text>
  );
}
