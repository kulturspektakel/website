<?php
  snippet('header', [
    'og_image' => $page->images()->first()->thumb(['width' => 1200, 'autoOrient' => true])->url(),
    'og_description' => $page->text()->excerpt(30, 'words').'...'
  ]);
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
