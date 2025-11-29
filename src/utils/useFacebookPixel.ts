import {useEffect, useState} from 'react';
import {FacebookPixel} from 'react-use-facebook-pixel';

// to prevent pixel reinitialization on every rerender
let facebookPixelSingleton: FacebookPixel | null = null;
const useFacebookPixel = () => {
  const [facebookPixel, setFacebookPixel] = useState<FacebookPixel | null>(
    null,
  );

  useEffect(() => {
    if (!facebookPixelSingleton) {
      const initializeFacebookPixel = async () => {
        const pixel = new FacebookPixel({
          pixelID: '568483009893821',
        });

        pixel.init({});
        pixel.trackEvent('PageView');

        facebookPixelSingleton = pixel;
        setFacebookPixel(pixel);
      };

      initializeFacebookPixel();
    }
  }, []);

  return facebookPixel;
};

export default useFacebookPixel;
