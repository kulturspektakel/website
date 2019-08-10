<?php snippet('header'); ?>

<section class="container news-container" role="main">
  <?php if (!isset($archive)) { ?>
    <ul class="news">
      <?php
      $i = 0;
      foreach (
        $page
          ->children()
          ->sortBy('date', 'desc')
          ->limit(5)
        as $p
      ) { ?>
      <li>
        <hgroup>
          <?php snippet('date', array('date' => $p->date())); ?>
          <h2>
            <a href="<?= $p->url() ?>">
              <?= $p->title()->html() ?>
            </a>
          </h2>
        </hgroup>
        <article>
          <?= $p->text()->kirbytext() ?>
        </article>
      </li>
      <?php $i++;}
      ?>
    </ul>
    <p class="archive-btn">
      <a href="archiv">ältere Artikel anzeigen</a>
    </p>
  <?php } else { ?>
    <ul class="news archive">
      <?php
        $i = 0;
        $lastyear = '';
        foreach ($page->children()->filter(function ($page) {return $page->date();})->sortBy('date', 'desc') as $p) {
          if ($lastyear != $p->date()->toDate('Y')) {
      ?>
          <li class="heading"><h2><?= $p->date()->toDate('Y') ?></h2></li>
        <?php } ?>
        <li style="opacity: <?= 1 - ($i / $page->children()->count()) * 0.7 ?>">
          <hgroup>
            <?php snippet('date', ['date' => $p->date()]); ?>
            <h2>
              <a href="<?= $p->url() ?>">
                <?= $p->title()->html() ?>
              </a>
            </h2>
          </hgroup>
        </li>
        <?php
          $i++;
          $lastyear = $p->date()->toDate('Y');
        } ?>
    </ul>
  <?php } ?>
</section>

<?php snippet('footer'); ?>
