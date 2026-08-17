import {useCallback, useEffect, useState} from 'react';
import {Button, Input, Stack, Text} from '@chakra-ui/react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
import {Field} from '../chakra-snippets/field';
import {PasswordInput} from '../chakra-snippets/password-input';
import {toaster} from '../chakra-snippets/toaster';
import {errorToast} from './toast';
import {type BluetoothSlice} from './noise';

export function WifiDialog({
  open,
  onClose,
  bluetooth,
  deviceName,
}: {
  open: boolean;
  onClose: () => void;
  bluetooth: BluetoothSlice;
  deviceName: string;
}) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const {writeWifi} = bluetooth;

  // Start from a blank form each time the dialog opens; we never read the
  // device's current credentials back (the characteristic is write-only).
  useEffect(() => {
    if (open) {
      setSsid('');
      setPassword('');
    }
  }, [open]);

  const apply = useCallback(async () => {
    setSaving(true);
    try {
      await writeWifi(ssid, password);
      toaster.create({type: 'success', title: 'Wi-Fi saved'});
      onClose();
    } catch (e) {
      errorToast('Wi-Fi could not be saved')(e);
    } finally {
      setSaving(false);
    }
  }, [ssid, password, writeWifi, onClose]);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wi-Fi – {deviceName}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap="4">
            <Field label="SSID" required>
              <Input
                value={ssid}
                maxLength={32}
                autoComplete="off"
                onChange={(e) => setSsid(e.target.value)}
              />
            </Field>
            <Field label="Password" optionalText="(empty = open network)">
              <PasswordInput
                value={password}
                maxLength={63}
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Text fontSize="sm" color="fg.muted">
              The device restarts after saving, to connect to the new network.
            </Text>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={apply}
            loading={saving}
            disabled={ssid.trim().length === 0}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
