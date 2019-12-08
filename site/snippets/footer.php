  </main>
  <footer class="footer" role="contentinfo">
    <div class="container">
      <div class="row">
        <div class="col-sm-6 col-sm-push-6 footer-icons">
          <div class="icons-right">
            <?=kirbytext($site->sociallinks()) ?>
          </div>
        </div>
        <div class="col-sm-6 col-sm-pull-6 footer-infos">
          <img src="/assets/img/logo.svg" class="hidden-xs" />
          <h3>Kulturspektakel Gauting e.V.</h3>
          <p>
            <?=kirbytext($site->infotext()) ?>
          </p>
          <div class="links">
            <?=kirbytext($site->footerlinks()) ?>
          </div>
        </div>
      </div>
    </div>
  </footer>
</div>

<script>
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

  ga('create', 'UA-1451591-11', 'auto');
  ga('send', 'pageview');
</script>
<!-- Facebook Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','//connect.facebook.net/en_US/fbevents.js');
// Insert Your Facebook Pixel ID below.
fbq('init', '568483009893821');
fbq('track', 'PageView');
</script>
<!-- Insert Your Facebook Pixel ID below. -->
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=568483009893821&amp;ev=PageView&amp;noscript=1"
/></noscript>
<!-- End Facebook Pixel Code -->
<script>
  window.ALGOLIA_APP_ID = "<?=kirby()->option('algolia')['app'] ?>";
  window.ALGOLIA_API_KEY = "<?=kirby()->option('algolia')['api_key'] ?>";
  window.ALGOLIA_INDEX = "<?=kirby()->option('algolia')['index'] ?>";
</script>
<?php
  echo js(array(
    '/assets/build/index.js',
  ));
?>
</body>
</html>
