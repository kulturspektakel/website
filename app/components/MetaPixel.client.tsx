import {useEffect} from 'react';
import ReactPixel from 'react-facebook-pixel';

export default function MetaPixel() {
  useEffect(() => {
    ReactPixel.init('807706852681161');
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
          src="https://www.facebook.com/tr?id=807706852681161&ev=PageView&noscript=1"
        />
      </noscript>
    </>
  );
}
