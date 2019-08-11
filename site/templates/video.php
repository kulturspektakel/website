<?php snippet( 'header') ?>

<main class="content" role="main">
  <section class="container">
    <?=snippet('album', ['album' => $page]) ?>
  </section>
</main>

<?php snippet('footer') ?>
