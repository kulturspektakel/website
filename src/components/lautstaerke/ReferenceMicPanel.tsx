import {Box, FloatingPanel, Portal, Spinner, Stack, Text} from '@chakra-ui/react'; // prettier-ignore
import {Alert} from '../chakra-snippets/alert';
import {CloseButton} from '../chakra-snippets/close-button';
import {Field} from '../chakra-snippets/field';
import {
  FileUploadDropzone,
  FileUploadRoot,
} from '../chakra-snippets/file-upload';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../chakra-snippets/native-select';
import {toaster} from '../chakra-snippets/toaster';
import {useDeviceView} from './deviceView';
import {errorToast} from './toast';

// Which microphone on this computer to draw over the monitor's spectrum, and the file that
// says what its levels are worth.
//
// A floating panel and not a dialog, for the reason the calibration one is: the whole point
// is watching the band chart while you change something in here, and a modal would cover
// the thing being watched. It is also what scopes the feature — the microphone is opened
// when this opens and released when it closes, so there is no way to leave a page quietly
// listening, and nothing to remember to switch off.
//
// Two choices and no numbers. There is nothing to type because there is nothing here a
// person knows better than the file does: a recognised microphone and its own calibration
// file settle both the response curve and the level between them (see
// sensitivityFromSensFactor). What is left is saying clearly when that has *not* happened,
// which is what the alerts below are for — a spectrum drawn at a made-up sensitivity looks
// exactly like one drawn at a real one.

// The "no microphone" row, and the "no calibration" one. A sentinel rather than an empty
// string, so that picking it is an ordinary value like any other rather than the select's
// blank state.
const NONE = 'none';

export function ReferenceMicPanel() {
  const {referenceMic} = useDeviceView();
  const {
    panelOpen,
    close,
    options,
    selected,
    mic,
    calibrated,
    sensitivityDb,
    starting,
    warning,
    select,
    calSerial,
    serials,
    importCal,
    useCal,
  } = referenceMic;

  return (
    <FloatingPanel.Root
      open={panelOpen}
      onOpenChange={(e) => {
        if (!e.open) close();
      }}
      defaultSize={{width: 340, height: 300}}
      minSize={{width: 300, height: 220}}
    >
      <Portal>
        <FloatingPanel.Positioner>
          <FloatingPanel.Content fontVariantNumeric="tabular-nums">
            <FloatingPanel.Header>
              <FloatingPanel.DragTrigger>
                <FloatingPanel.Title>Referenzmikrofon</FloatingPanel.Title>
              </FloatingPanel.DragTrigger>
              <FloatingPanel.Control>
                <FloatingPanel.CloseTrigger asChild>
                  <CloseButton size="xs" />
                </FloatingPanel.CloseTrigger>
              </FloatingPanel.Control>
            </FloatingPanel.Header>
            <FloatingPanel.Body overflowY="auto">
              <Stack gap="4">
                <Field label="Eingang">
                  <NativeSelectRoot size="sm" disabled={starting}>
                    <NativeSelectField
                      value={selected?.deviceId ?? NONE}
                      onChange={(e) =>
                        void select(
                          e.target.value === NONE
                            ? null
                            : (options.find(
                                (o) => o.deviceId === e.target.value,
                              ) ?? null),
                        )
                      }
                      items={[
                        {value: NONE, label: 'Keins'},
                        ...options.map((o) => ({
                          value: o.deviceId,
                          label: o.label,
                        })),
                      ]}
                    />
                  </NativeSelectRoot>
                </Field>

                {/* The unit's own response curve, and the header that sets its level. Not in
                    the repo, because it belongs to one physical capsule rather than to the
                    project — so it is dropped in here and kept in this browser under the
                    serial number in its own header. That serial is the only place the number
                    exists: the microphone does not disclose it, in the browser or over USB,
                    so which file goes with which input is learned here once and remembered. */}
                {/* Disabled until there is an input, and not merely as tidiness: which file
                    applies is recorded against the input it applies to (see CalStore.devices),
                    so with none picked there is nowhere to put the answer. Better a control
                    that says it is not ready than one that takes a file and appears to lose
                    it. */}
                <Field
                  label="Kalibrierungsdatei"
                  disabled={selected == null}
                  helperText={
                    selected == null
                      ? 'Zuerst einen Eingang wählen.'
                      : undefined
                  }
                >
                  <Stack gap="2" w="full">
                    {/* Shown whenever there is anything to pick from, including while one is
                        already in use: nothing else can change which file applies, and an
                        automatic pairing that chose wrong would otherwise be unreachable. */}
                    {serials.length > 0 && (
                      <NativeSelectRoot size="sm" disabled={selected == null}>
                        <NativeSelectField
                          value={calSerial ?? NONE}
                          onChange={(e) =>
                            useCal(
                              e.target.value === NONE ? null : e.target.value,
                            )
                          }
                          items={[
                            {value: NONE, label: 'Keine'},
                            ...serials.map((s) => ({value: s, label: s})),
                          ]}
                        />
                      </NativeSelectRoot>
                    )}
                    {/* Only while no file is in use — with one picked there is nothing to add,
                        and an invitation to add one reads as something still outstanding.
                        Pick "Keine" above to get it back and replace the file.

                        Chakra's own, rather than a dashed box with drag handlers on it: the
                        component brings the drag-active styling, filters by type, and — the
                        part hand-rolling had simply not got — makes the target clickable and
                        reachable from the keyboard, so a calibration file is not something
                        only a mouse can supply. */}
                    {calSerial == null && (
                      <FileUploadRoot
                        w="full"
                        maxFiles={1}
                        disabled={selected == null}
                        // Both spellings: macOS reports these as text/plain, but a file that
                        // arrives with no type at all still matches on its extension.
                        accept={{'text/plain': ['.txt']}}
                        onFileAccept={({files}) => {
                          const file = files[0];
                          if (file == null) return;
                          void file
                            .text()
                            .then(
                              importCal,
                              errorToast('Datei konnte nicht gelesen werden'),
                            );
                        }}
                        // Otherwise the wrong file type is a drop that does nothing at all,
                        // which reads as the panel being broken rather than as a refusal.
                        onFileReject={() =>
                          toaster.create({
                            type: 'error',
                            title: 'Keine .txt-Datei',
                          })
                        }
                      >
                        <FileUploadDropzone
                          // The root lays its children out with align-items:flex-start, so
                          // without this the dashed box is only as wide as its own text.
                          w="full"
                          minH="0"
                          py="3"
                          gap="1"
                          // The recipe already colours the drag-active border and fill from
                          // colorPalette — which is gray by default, i.e. near-white against
                          // this section's ground. Pointing it at the section's accent is the
                          // whole fix; the recipe keeps deciding how it is used.
                          colorPalette="accent"
                          label={
                            <Text fontSize="xs">
                              Kalibrierungsdatei hierher ziehen
                            </Text>
                          }
                          description={
                            <Text fontSize="xs">.txt von miniDSP</Text>
                          }
                        />
                      </FileUploadRoot>
                    )}
                  </Stack>
                </Field>

                {starting && (
                  <Box display="flex" alignItems="center" gap="2">
                    <Spinner size="xs" />
                    <Text fontSize="xs" color="fg.subtle">
                      Mikrofon wird geöffnet…
                    </Text>
                  </Box>
                )}

                {/* Whether what is on the chart can be read as a level at all. Both halves
                    have to be there — a microphone we know the calibration convention of,
                    and that unit's own file — and either one missing leaves a curve whose
                    shape is worth something and whose numbers are not. Said out loud,
                    because nothing about the drawn line looks any different. */}
                {selected != null &&
                  (calibrated ? (
                    /* The one condition nothing here can check. The file's figure is quoted
                       at full input volume, and no browser can read the system's setting —
                       so a slider somebody moved is a level silently wrong by however much
                       it moved, with everything else still looking right. */
                    <Alert status="info" size="sm" title="Systemlautstärke">
                      Der Eingang muss in den Systemeinstellungen auf Maximum
                      stehen, sonst stimmen die Pegel nicht. 0 dBFS entspricht{' '}
                      {sensitivityDb.toFixed(1)} dB — darüber übersteuert das
                      Mikrofon.
                    </Alert>
                  ) : (
                    <Alert
                      status="warning"
                      size="sm"
                      title={
                        mic == null
                          ? 'Kein Referenzmikrofon'
                          : 'Keine Kalibrierungsdatei'
                      }
                    >
                      {mic == null
                        ? `${selected.label} ist kein bekanntes Messmikrofon. Die Kurve zeigt nur den Verlauf, die dB-Werte sind bedeutungslos.`
                        : `Für dieses ${mic.name} ist keine Datei hinterlegt. Ohne sie fehlen die Empfindlichkeit und die Eigenkurve des Mikrofons — die dB-Werte sind bedeutungslos.`}
                    </Alert>
                  ))}

                {/* Processing the browser would not turn off, or a sample rate it would not
                    honour. Both change what the curve means, and neither is visible
                    anywhere else. */}
                {warning && (
                  <Alert status="error" size="sm" title="Aufnahme">
                    {warning}
                  </Alert>
                )}

                {selected == null && (
                  <Text fontSize="xs" color="fg.subtle">
                    Ohne Eingang zeigt das Frequenzdiagramm nur das Gerät.
                  </Text>
                )}
              </Stack>
            </FloatingPanel.Body>
            <FloatingPanel.ResizeTriggers />
          </FloatingPanel.Content>
        </FloatingPanel.Positioner>
      </Portal>
    </FloatingPanel.Root>
  );
}
