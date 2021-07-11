<section id="<?php echo strtolower($page->title()) ?>" class="container subpage <?php echo strtolower($page->title()) ?>">
  <?= $page->intro()->kirbytext() ?>
  <div class="row">
    <?php
      $cols = array();
      if (!$page->col1()->isEmpty()) array_push($cols, $page->col1());
      if (!$page->col2()->isEmpty()) array_push($cols, $page->col2());
      if (!$page->col3()->isEmpty()) array_push($cols, $page->col3());
      if (!$page->col4()->isEmpty()) array_push($cols, $page->col4());

      foreach ($cols as $col) { ?>
        <div class="col-sm-<?= 12/count($cols) ?> <?php if(count($cols)==4) echo "col-xs-6"; ?>">
          <?= $col->kirbytext() ?>
        </div>
    <?php } ?>
  </div>
  <?= $page->outro()->kirbytext() ?>
</section>
