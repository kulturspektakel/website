import {type CSSProperties, useState} from 'react';
import {Box, Button, FloatingPanel, HStack, IconButton, Portal, Spinner, Stack, Text} from '@chakra-ui/react'; // prettier-ignore
import {FaPlay, FaStop} from 'react-icons/fa6';
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
import {ProgressBar, ProgressRoot} from '../chakra-snippets/progress';
import {toaster} from '../chakra-snippets/toaster';
import {
  CALIBRATION_SAMPLES,
  CALIBRATION_SECONDS,
  type CalibrationResult,
  railedBands,
  SETTLE_SAMPLES,
  trimsForResult,
} from './bandCalibration';
import {CAL_MAX_DB} from './bluetooth';
import {CalibrationResultChart} from './CalibrationResultChart';
import {InputLevelMeter} from './InputLevelMeter';
import {useBluetooth} from './context';
import {useDeviceView} from './deviceView';
import {outputChannelOptions} from './referenceMic';
import {errorToast} from './toast';

// Which microphone on this computer to draw over the monitor's spectrum, the file that says
// what its levels are worth — and, with both of those settled, measuring one instrument against
// the other over thirty seconds of pink noise.
//
// A floating panel and not a dialog, for the reason the trim one is: the whole point is watching
// the band chart while you change something in here, and a modal would cover the thing being
// watched. It is also what scopes the feature — the microphone is opened when this opens and
// released when it closes, so there is no way to leave a page quietly listening, no way to leave
// a room being blasted, and nothing to remember to switch off.
//
// Choices and no numbers, in every row of it. There is nothing to type because there is nothing
// here a person knows better than the instruments do: a recognised microphone and its own
// calibration file settle the response curve and the level between them (see
// sensitivityFromSensFactor), and what the monitor is out by is measured rather than estimated.
// What is left is saying clearly when that has *not* happened, which is what the alerts below
// are for — a spectrum drawn at a made-up sensitivity looks exactly like one drawn at a real
// one, and so does a calibration curve computed from it.

// The "no microphone" row, and the "no calibration" one. A sentinel rather than an empty
// string, so that picking it is an ordinary value like any other rather than the select's
// blank state.
const NONE = 'none';

export function ReferenceMicPanel({device}: {device: string}) {
  const {referenceMic} = useDeviceView();
  // The monitor's own trims are written from in here, so this panel needs the Bluetooth
  // slice as well as the microphone one. From the context because the connection is the
  // section's rather than this panel's — one pairing serves every page under /crew/noise.
  // `device` is a prop instead: that one is this page's identity, and the route owns it.
  const bluetooth = useBluetooth();
  // Which input's volume notice has been read. Per input rather than a plain flag, because
  // the thing it asks about is per input — every source has its own level in the system
  // settings — so switching microphones is the one case where the notice is news again. Kept
  // here and not in the slice: nothing outside this panel shows it, and it is the reader
  // saying "yes, I have checked", which is worth exactly as long as the page.
  const [volumeChecked, setVolumeChecked] = useState<string | null>(null);
  // Whether trims are on their way to the monitor. Local for the reason above it: it lasts
  // as long as one round-trip and nothing outside this panel shows it.
  const [applying, setApplying] = useState(false);
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
    calibration,
    noisePlaying,
    toggleNoise,
    outputs,
    output,
    outputSelectable,
    selectOutput,
    outputChannels,
    channel,
    selectChannel,
    inputLaeq,
  } = referenceMic;
  const running = calibration.phase === 'running';
  // Bound once: it gates the block below, feeds the chart, and is what the button applies.
  const result = calibration.result;

  // Whether the monitor this page is about is the one on the other end of the Bluetooth
  // connection — not merely whether *something* is connected. The write path only checks that
  // a connection exists (see useBleDevice), so a looser test here would quietly trim whichever
  // monitor happened to be paired, using a measurement of a different one.
  const btConnected = bluetooth.deviceName === device;

  // Send the run's finding to the monitor as trims.
  //
  // Reading first, because the finding is a correction to the trims that were in force while it
  // was measured rather than a set of trims in its own right (see trimsForResult, which owns the
  // arithmetic and the sign). A monitor keeps its trims across sessions, so there is nearly
  // always something there to correct: a blind write of the difference would be right only on
  // a monitor that had never been calibrated before.
  const applyToDevice = async (result: CalibrationResult) => {
    setApplying(true);
    try {
      const current = await bluetooth.readCalibration();
      await bluetooth.writeCalibration(
        trimsForResult(current, result.difference),
      );
      // Everything the finding still had to say, said here, because the next line throws it
      // away: which bands the range could not reach — without which the daylight they still
      // show on a second run reads as the write having failed — and that a second run is the
      // thing to do next, which the chart is no longer on screen to invite.
      const railed = railedBands(current, result.difference);
      toaster.create({
        type: 'success',
        title: 'Calibration applied',
        description:
          railed > 0
            ? `${railed} band${railed === 1 ? '' : 's'} hit the ±${CAL_MAX_DB} dB limit and are still short. Measure again to check the rest landed.`
            : 'Measure again to check it landed.',
      });
      // The finding described the monitor as it was trimmed a moment ago, and it is not
      // trimmed that way any more: the same correction taken off twice lands as far the other
      // side of the reference as it started (see trimsForResult). So it goes, rather than
      // staying on screen behind a button that must now refuse.
      calibration.clear();
    } catch (e) {
      errorToast('Calibration could not be applied')(e);
    } finally {
      setApplying(false);
    }
  };

  return (
    <FloatingPanel.Root
      open={panelOpen}
      onOpenChange={(e) => {
        if (!e.open) close();
      }}
      // Width only, really: wide enough that the chart's 31 bands still get a label under
      // every other one (see bandAxis), and the panel's to remember and resize from there.
      // The height in both of these is what the machine would apply and what the override
      // on the positioner below turns off — the panel is as tall as whatever state it is
      // currently in, which is a range from three selects to a finished run's chart.
      defaultSize={{width: 400, height: 520}}
      minSize={{width: 300, height: 220}}
    >
      <Portal>
        <FloatingPanel.Positioner
          // The machine writes the panel's size into these two custom properties, and the
          // content takes its height from --height — so replacing that one value with `auto`
          // is the whole of "as tall as the content". Inline, because that is where the
          // machine's own value is and a class would lose to it; --width is left alone.
          style={{'--height': 'auto'} as CSSProperties}
        >
          <FloatingPanel.Content
            fontVariantNumeric="tabular-nums"
            // Still bounded, or a long enough state runs off the bottom of the screen. From
            // where the panel currently is rather than from the viewport's full height, so
            // that what the cap leaves out is always the part that would have been off
            // screen anyway — and never below the height the panel used to refuse to go
            // under, so that dragging it to the very bottom edge cannot collapse it.
            maxH="max(220px, calc(100dvh - var(--y) - 2rem))"
          >
            <FloatingPanel.Header>
              <FloatingPanel.DragTrigger>
                <FloatingPanel.Title>Calibration</FloatingPanel.Title>
              </FloatingPanel.DragTrigger>
              <FloatingPanel.Control>
                <FloatingPanel.CloseTrigger asChild>
                  <CloseButton size="xs" />
                </FloatingPanel.CloseTrigger>
              </FloatingPanel.Control>
            </FloatingPanel.Header>
            <FloatingPanel.Body overflowY="auto">
              <Stack gap="4">
                {/* Everything about the microphone end, under one label: which input, the file
                    that says what its levels are worth, and whether the two of them add up to a
                    reading. One section rather than four, because none of it is a separate
                    decision — a file belongs to an input (see CalStore.devices), and the alerts
                    at the bottom are about exactly the pair above them. */}
                <Field label="Input">
                  <Stack gap="2" w="full">
                    <NativeSelectRoot size="sm" disabled={starting || running}>
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
                          {value: NONE, label: 'None'},
                          ...options.map((o) => ({
                            value: o.deviceId,
                            label: o.label,
                          })),
                        ]}
                      />
                    </NativeSelectRoot>

                    {starting && (
                      <Box display="flex" alignItems="center" gap="2">
                        <Spinner size="xs" />
                        <Text fontSize="xs" color="fg.subtle">
                          Opening microphone…
                        </Text>
                      </Box>
                    )}

                    {/* The unit's own response curve, and the header that sets its level. Not in
                        the repo, because it belongs to one physical capsule rather than to the
                        project — so it is dropped in here and kept in this browser under the
                        serial number in its own header. That serial is the only place the number
                        exists: the microphone does not disclose it, in the browser or over USB,
                        so which file goes with which input is learned here once and remembered.

                        Absent until there is an input, rather than present and refusing: which
                        file applies is recorded against the input it applies to, so with none
                        picked there is nowhere to put the answer — and a control that can only
                        refuse says nothing the empty select above has not already said. */}
                    {selected != null && serials.length > 0 && (
                      /* Shown whenever there is anything to pick from, including while one is
                         already in use: nothing else can change which file applies, and an
                         automatic pairing that chose wrong would otherwise be unreachable. */
                      <NativeSelectRoot size="sm" disabled={running}>
                        <NativeSelectField
                          value={calSerial ?? NONE}
                          onChange={(e) =>
                            useCal(
                              e.target.value === NONE ? null : e.target.value,
                            )
                          }
                          items={[
                            {value: NONE, label: 'No calibration file'},
                            ...serials.map((s) => ({value: s, label: s})),
                          ]}
                        />
                      </NativeSelectRoot>
                    )}
                    {/* Only while no file is in use — with one picked there is nothing to add,
                        and an invitation to add one reads as something still outstanding. Pick
                        "No calibration file" above to get it back and replace the file.

                        Chakra's own, rather than a dashed box with drag handlers on it: the
                        component brings the drag-active styling, filters by type, and — the
                        part hand-rolling had simply not got — makes the target clickable and
                        reachable from the keyboard, so a calibration file is not something
                        only a mouse can supply. */}
                    {selected != null && calSerial == null && (
                      <FileUploadRoot
                        w="full"
                        maxFiles={1}
                        disabled={running}
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
                              errorToast('File could not be read'),
                            );
                        }}
                        // Otherwise the wrong file type is a drop that does nothing at all,
                        // which reads as the panel being broken rather than as a refusal.
                        onFileReject={() =>
                          toaster.create({
                            type: 'error',
                            title: 'Not a .txt file',
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
                              Drag the calibration file here
                            </Text>
                          }
                          description={
                            <Text fontSize="xs">.txt from miniDSP</Text>
                          }
                        />
                      </FileUploadRoot>
                    )}

                    {/* Whether what this input reports can be read as a level at all. Both
                        halves have to be there — a microphone we know the calibration
                        convention of, and that unit's own file — and either one missing leaves a
                        curve whose shape is worth something and whose numbers are not. Said out
                        loud, because nothing about the drawn line looks any different, and
                        directly under the two controls that decide it. */}
                    {selected != null &&
                      (calibrated ? (
                        /* The one condition nothing here can check. The file's figure is quoted
                           at full input volume, and no browser can read the system's setting —
                           so a slider somebody moved is a level silently wrong by however much
                           it moved, with everything else still looking right.

                           Dismissable, unlike the other alerts here: each of those describes a
                           state that is still true for as long as it is on screen, and this is
                           one errand to run once. Until it has been, it stays — and after, it
                           goes, because this panel floats over the chart it exists to be read
                           against, and every line of it is a line of that chart covered. */
                        volumeChecked !== selected.deviceId && (
                          <Alert
                            status="info"
                            size="sm"
                            title="System volume"
                            endElement={
                              <CloseButton
                                size="xs"
                                alignSelf="flex-start"
                                onClick={() =>
                                  setVolumeChecked(selected.deviceId)
                                }
                              />
                            }
                          >
                            The input has to be at maximum in the system
                            settings, or the levels are wrong. 0 dBFS is{' '}
                            {sensitivityDb.toFixed(1)} dB — above that the
                            microphone clips.
                          </Alert>
                        )
                      ) : (
                        <Alert
                          status="warning"
                          size="sm"
                          title={
                            mic == null
                              ? 'Not a reference microphone'
                              : 'No calibration file'
                          }
                        >
                          {mic == null
                            ? `${selected.label} is not a known measurement microphone. The curve shows the shape only; the dB values mean nothing.`
                            : `No file is on record for this ${mic.name}. Without one the microphone's sensitivity and its own response are missing — the dB values mean nothing.`}
                        </Alert>
                      ))}

                    {/* Processing the browser would not turn off, or a sample rate it would not
                        honour. Both change what this input's readings mean, and neither is
                        visible anywhere else. */}
                    {warning && (
                      <Alert status="error" size="sm" title="Recording">
                        {warning}
                      </Alert>
                    )}

                    {/* What the choices above actually produce. Last in the section, under the
                        alerts rather than over them: those say what the numbers are worth, and
                        a level shown above its own caveat invites reading it before them. */}
                    {selected != null && (
                      <InputLevelMeter inputLaeq={inputLaeq} />
                    )}
                  </Stack>
                </Field>

                {/* The other end: where the pink noise comes out, and the run that measures the
                    monitor against the microphone with it.

                    Pink noise because it is the signal both instruments read as a flat line —
                    equal power per octave is equal power per third-octave band, which is the
                    grid the whole section works in (see pinkNoise.ts) — so any daylight between
                    the two spectra is the thing being looked for rather than a property of the
                    signal.

                    No volume anywhere in here: it plays at full scale (see startNoise) and the
                    only level left is the system's, which no browser can read or set, so a
                    slider would be a second unknown rather than a control. */}
                <Field label="Output">
                  <Stack gap="2" w="full">
                    {/* Which speakers, and a button to hear them. The two belong on one row
                        because they are one question — is the noise coming out of the right
                        thing — and the answer is available before committing to thirty seconds
                        of measurement.

                        The select is absent where AudioContext.setSinkId is (still)
                        Chromium-only; the button is not, because the noise still plays, wherever
                        the system sends it. Both are out of reach during a run: moving the sound
                        to another output, or switching it off, halfway through an average is not
                        a thing to do by accident. */}
                    <HStack gap="2" w="full">
                      {outputSelectable && outputs.length > 0 && (
                        <NativeSelectRoot size="sm" flex="1" disabled={running}>
                          <NativeSelectField
                            value={output ?? NONE}
                            onChange={(e) =>
                              void selectOutput(
                                e.target.value === NONE ? null : e.target.value,
                              )
                            }
                            items={[
                              {value: NONE, label: 'System output'},
                              ...outputs.map((o) => ({
                                value: o.deviceId,
                                label: o.label,
                              })),
                            ]}
                          />
                        </NativeSelectRoot>
                      )}
                      {/* Which socket of it, when it has more than one — a pair does, and
                          anything an interface offers does several times over. Absent at one
                          channel, where there is nothing to choose, and absent until a context
                          exists to be asked how many there are: `outputChannels` is the
                          device's own count and not this panel's idea of one.

                          Beside the device rather than under it, because the two together are
                          one address — and out of reach during a run for the reason the device
                          is: moving the signal to another socket halfway through an average
                          measures two things and labels them one. */}
                      {outputChannels > 1 && (
                        <NativeSelectRoot size="sm" flex="1" disabled={running}>
                          <NativeSelectField
                            value={channel == null ? NONE : String(channel)}
                            onChange={(e) =>
                              selectChannel(
                                e.target.value === NONE
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                            items={[
                              /* The default, and the one a measurement wants: a mono buffer
                                 sent to every channel is the pair heard together, which is
                                 the signal a run's thirty seconds are an average of. Naming
                                 one channel halves the power reaching the microphone and
                                 moves where it comes from, so this row is the way back to a
                                 result that means what the panel says it does. */
                              {value: NONE, label: 'All channels'},
                              ...outputChannelOptions(outputChannels).map(
                                (c) => ({
                                  value: String(c.channel),
                                  label: c.label,
                                }),
                              ),
                            ]}
                          />
                        </NativeSelectRoot>
                      )}
                      <IconButton
                        size="sm"
                        variant="outline"
                        disabled={running}
                        aria-label={
                          noisePlaying ? 'Stop pink noise' : 'Play pink noise'
                        }
                        title={
                          noisePlaying ? 'Stop pink noise' : 'Play pink noise'
                        }
                        colorPalette={noisePlaying ? 'accent' : undefined}
                        onClick={() => void toggleNoise()}
                      >
                        {noisePlaying ? <FaStop /> : <FaPlay />}
                      </IconButton>
                    </HStack>

                    {running ? (
                      <>
                        {/* The whole run, settle seconds included. They are shown as progress
                            rather than held back, because a bar that sits still for the three
                            seconds after a press reads as a control that did not work — and
                            they are labelled for what they are rather than counted, since they
                            are not part of the average. */}
                        <ProgressRoot
                          size="sm"
                          value={calibration.seconds}
                          max={CALIBRATION_SECONDS}
                          colorPalette="accent"
                        >
                          <ProgressBar />
                        </ProgressRoot>
                        <Text fontSize="xs" color="fg.subtle">
                          {calibration.seconds < SETTLE_SAMPLES
                            ? 'Settling…'
                            : `${calibration.seconds - SETTLE_SAMPLES} / ${CALIBRATION_SAMPLES} s`}
                        </Text>
                        {/* No icon on either of the run's buttons, unlike the noise toggle
                            above: a second play triangle two rows down would be the same mark
                            for "make a sound" and "take a measurement". */}
                        <Button
                          size="sm"
                          w="full"
                          variant="outline"
                          onClick={calibration.cancel}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Solid, which is to say primary, only while there is nothing
                            measured: then it is the thing this panel is open to do and
                            everything above it is the setting-up. Blue rather than the
                            section's yellow because the panel is a light surface (see
                            theme-crew, and the accent's light half).

                            With a result on screen it steps back to outline, because the
                            primary action has moved: what to do with a finding is apply it,
                            and measuring a second time is how you check that or disagree with
                            it. Two solid buttons in one panel would be asking the reader to
                            pick between them. */}
                        <Button
                          size="sm"
                          w="full"
                          variant={result == null ? 'solid' : 'outline'}
                          disabled={!calibration.ready}
                          onClick={() => void calibration.start()}
                        >
                          {result == null
                            ? 'Start calibration'
                            : 'Measure again'}
                        </Button>
                        {/* Which half is missing, when one is. A disabled button with no reason
                            beside it is the same information as no button, and the two halves
                            fail for quite different reasons — one is a choice above, the other
                            is a monitor that is not transmitting. */}
                        {!calibration.ready && (
                          <Text fontSize="xs" color="fg.subtle">
                            {selected == null
                              ? 'Pick an input to measure against.'
                              : 'Waiting for both the monitor and the microphone.'}
                          </Text>
                        )}
                      </>
                    )}

                    {/* The finding, for as long as it is about the input that is still picked
                        (see resetCalibration). Under the button rather than replacing it: the
                        obvious next thing to do with a calibration curve is to take it again
                        and see whether it comes out the same. */}
                    {result != null && !running && (
                      <>
                        <CalibrationResultChart result={result} />
                        {/* The finding, made the monitor's. Under the chart because that is the
                            order the decision is made in — you look at the curve, and then you
                            either accept it or measure again with the button above.

                            Not automatic on a run finishing, deliberately: a result is a
                            measurement, and whether the room it was taken in was the room worth
                            calibrating against is the one judgement no accumulator can make. */}
                        {/* Primary for the same reason, and there is no contest between
                            the two: they are the two ends of one errand — measure the
                            monitor, then write what was measured to it — and only one of
                            them is on screen with anything to do at a time. */}
                        <Button
                          size="sm"
                          w="full"
                          loading={applying}
                          disabled={!btConnected}
                          onClick={() => void applyToDevice(result)}
                        >
                          Apply calibration
                        </Button>
                        {!btConnected && (
                          <Text fontSize="xs" color="fg.subtle">
                            Connect to {device} over Bluetooth to apply these
                            trims.
                          </Text>
                        )}
                      </>
                    )}
                  </Stack>
                </Field>
              </Stack>
            </FloatingPanel.Body>
            {/* The two side handles rather than all eight: with the height coming from the
                content, a vertical drag has nothing left to set. */}
            <FloatingPanel.ResizeTrigger axis="e" />
            <FloatingPanel.ResizeTrigger axis="w" />
          </FloatingPanel.Content>
        </FloatingPanel.Positioner>
      </Portal>
    </FloatingPanel.Root>
  );
}
