import {
  createContext,
  useContext,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {Text} from '@chakra-ui/react';
import {type NoiseRecording_Record as NoiseRecord} from '../proto/noise';

export const TOPIC = 'noise/+/record';
export const ACTIVE_WINDOW_MS = 10_000;
export const WINDOW_S = 300;
export const GAP_THRESHOLD_S = 15;

export const SERIES = [
  {key: 'laeq1s', label: 'LAeq', stroke: '#2b8cbe'},
  {key: 'lceq1s', label: 'LCeq', stroke: '#74a9cf'},
  {key: 'lafmax1s', label: 'LAFmax', stroke: '#e6550d'},
  {key: 'lcfmax1s', label: 'LCFmax', stroke: '#a63603'},
  {key: 'lcpeak1s', label: 'LCpeak', stroke: '#756bb1'},
] as const satisfies ReadonlyArray<{
  key: keyof Pick<
    NoiseRecord,
    'laeq1s' | 'lceq1s' | 'lafmax1s' | 'lcfmax1s' | 'lcpeak1s'
  >;
  label: string;
  stroke: string;
}>;

export const decodeDb = (byte: number) => 20 + byte / 2;

export type DeviceState = {
  lastSeen: number;
  latest: NoiseRecord;
  laeq15m: number;
  lceq15m: number;
  batteryMv?: number;
};
export type DeviceBuffer = number[][];

export type LautstaerkeCtx = {
  connected: boolean;
  devices: Record<string, DeviceState>;
  bus: EventTarget;
  deviceData: MutableRefObject<Record<string, DeviceBuffer>>;
  now: number;
};

export const LautstaerkeContext = createContext<LautstaerkeCtx | null>(null);

export function useLautstaerkeCtx() {
  const ctx = useContext(LautstaerkeContext);
  if (!ctx) {
    throw new Error(
      'useLautstaerkeCtx must be used inside the /lautstaerke layout',
    );
  }
  return ctx;
}

export function MqttGate({children}: {children: ReactNode}) {
  const ctx = useLautstaerkeCtx();
  if (!ctx.connected) {
    return <Text color="gray.500">MQTT nicht verbunden…</Text>;
  }
  return <>{children}</>;
}
