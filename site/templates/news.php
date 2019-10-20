<?php
  $header = [
    'og_description' => $page->text()->excerpt(30, 'words').'...'
  ];
  $firstImage = $page->images()->first();
  if (isset($firstImage)) {
    $header['og_image'] = $firstImage->thumb(['width' => 1200, 'autoOrient' => true])->url();
  }

  snippet('header', $header);
?>

<section class="container news-container news-container-single" role="main">
  <div class="news">
    <hgroup>
      <?php snippet('date', array('date' => $page->date())) ?>
      <h1>
        <?= html($page->title()) ?>
      </h1>
    </hgroup>
    <article>
      <?= kirbytext($page->text()) ?>
    </article>
  </div>
</section>

<?php snippet( 'footer') ?>
