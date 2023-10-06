import {useEffect} from 'react';
import ReactPixel from 'react-facebook-pixel';

export default function MetaPixel() {
  useEffect(() => {
    ReactPixel.init('568483009893821');
    ReactPixel.pageView();
  }, []);
  return (
    <>
      <noscript>
        <img
          alt="Meta pixel"
          height="1"
          width="1"
          style={{display: 'none'}}
          src="https://www.facebook.com/tr?id=568483009893821&ev=PageView&noscript=1"
        />
      </noscript>
    </>
  );
}
