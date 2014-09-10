<?php snippet('header') ?>
  <section class="container">
    <h1><?php echo html($page->title()) ?></h1>
    <?php echo kirbytext($page->text()) ?>
  </section>

<?php snippet('footer') ?>