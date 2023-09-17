import {Modal, ModalOverlay, ModalContent} from '@chakra-ui/react';

export default function BandModal() {
  return (
    <Modal isOpen={true}>
      <ModalOverlay />
      <ModalContent>test</ModalContent>
    </Modal>
  );
}
