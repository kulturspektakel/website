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
import {type BluetoothSlice} from './context';

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
      toaster.create({type: 'success', title: 'WLAN gespeichert'});
      onClose();
    } catch (e) {
      toaster.create({
        type: 'error',
        title: 'WLAN konnte nicht gespeichert werden',
        description: e instanceof Error ? e.message : String(e),
      });
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
          <DialogTitle>WLAN – {deviceName}</DialogTitle>
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
            <Field label="Passwort" optionalText="(leer = offenes Netz)">
              <PasswordInput
                value={password}
                maxLength={63}
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Text fontSize="sm" color="gray.500">
              Das Gerät startet nach dem Speichern neu, um sich mit dem neuen
              Netzwerk zu verbinden.
            </Text>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={apply}
            loading={saving}
            disabled={ssid.trim().length === 0}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
