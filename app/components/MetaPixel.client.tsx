export default function MetaPixel() {
  if (typeof window === 'undefined') {
    throw Error('Chat should only render on the client.');
  }
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '807706852681161');
          fbq('track', 'PageView');
          `,
        }}
      ></script>
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
