<?php snippet( 'header') ?>

<section class="container" role="main">
  <p>
    <?=kirbytext($page->text()) ?>
  </p>

  <?php $i=0 ; foreach ($page->children()->flip() as $p) { snippet('mehr-event',array('p'=> $p,'i'=>$i)); $i++; } ?>
</section>

<?php snippet( 'footer') ?>
