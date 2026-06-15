import {Wrapper} from '@googlemaps/react-wrapper';
import React, {useEffect, useRef} from 'react';

type LatLng = {latitude: number; longitude: number};

type Props = {
  latitude: number;
  longitude: number;
  apiKey: string;
  zoom?: number;
  // When set, a second (plain) marker is dropped at the primary location and
  // the Kult pin marks `secondaryMarker`, with the viewport fit to both points.
  // Without it the primary location alone is shown with the Kult pin.
  secondaryMarker?: LatLng;
};

function GoogleMaps(props: Props) {
  return (
    <Wrapper apiKey={props.apiKey}>
      <MapComponent {...props} />
    </Wrapper>
  );
}

export default React.memo(GoogleMaps);

const KULT_ICON = {
  url: '/marker.png',
  size: [52, 74] as const,
  anchor: [13, 37] as const,
  scaledSize: [26, 37] as const,
};

function MapComponent({
  latitude,
  longitude,
  zoom = 11,
  secondaryMarker,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const maps = window.google.maps;
    const primary = new maps.LatLng(latitude, longitude);
    const map = new maps.Map(ref.current, {
      center: primary,
      zoom,
      gestureHandling: 'cooperative',
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      mapTypeId: maps.MapTypeId.ROADMAP,
    });
    const kultIcon = {
      url: KULT_ICON.url,
      size: new maps.Size(...KULT_ICON.size),
      origin: new maps.Point(0, 0),
      anchor: new maps.Point(...KULT_ICON.anchor),
      scaledSize: new maps.Size(...KULT_ICON.scaledSize),
    };

    if (secondaryMarker) {
      new maps.Marker({position: primary, map});
      const secondary = new maps.LatLng(
        secondaryMarker.latitude,
        secondaryMarker.longitude,
      );
      new maps.Marker({position: secondary, icon: kultIcon, map});
      const bounds = new maps.LatLngBounds(primary);
      bounds.extend(secondary);
      map.fitBounds(bounds);
    } else {
      new maps.Marker({position: primary, icon: kultIcon, map});
    }
  }, [latitude, longitude, zoom, secondaryMarker]);

  return <div ref={ref} style={{height: '100%'}} />;
}
