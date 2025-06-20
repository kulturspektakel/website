import {Wrapper} from '@googlemaps/react-wrapper';
import React, {useRef, useEffect} from 'react';

type Props = {
  latitude: number;
  longitude: number;
  apiKey: string;
};

function GoogleMaps(props: Props) {
  return (
    <Wrapper apiKey={props.apiKey}>
      <MapComponent {...props} />
    </Wrapper>
  );
}

export default React.memo(GoogleMaps);

function MapComponent({latitude, longitude}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const location = new window.google.maps.LatLng(latitude, longitude);
    const map = new window.google.maps.Map(ref.current, {
      center: location,
      zoom: 11,
      gestureHandling: 'cooperative',
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
    });
    new window.google.maps.Marker({
      position: location,
      icon: {
        url: '/marker.png',
        size: new window.google.maps.Size(52, 74),
        origin: new window.google.maps.Point(0, 0),
        anchor: new window.google.maps.Point(13, 37),
        scaledSize: new window.google.maps.Size(26, 37),
      },
      map,
    });
  });

  return <div ref={ref} style={{height: '100%'}} />;
}
