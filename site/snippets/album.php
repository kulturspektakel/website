<?php if (!isset($number)) { $number = 0; } ?>
<section class="<?php if ($number>0) echo " old "; ?>">
  <a href="<?= $album->url() ?>" class="album-title">
    <h2>
      <?= $album->title() ?>
    </h2>
    <?= $album->images()->count() ?> Fotos vom <?= $album->date()->toDate("d.m.Y") ?>
  </a>
  <ul class="album">
    <?php $i=0 ;?>
    <?php foreach($album->images() as $image) { ?>
    <li <?php
      if ($number==0 && $i == 11) {
        echo ' id="more"';
      }
      if ($number>0 && $i == 11) {
        echo ' class="more-link"';
      } elseif ($number>0 && $i>11) {
        echo ' class="more"';
      } ?>>
      <a <?php if ($number>0 && $i == 11) {echo 'data-album="'.$album->url().'"';} ?> href="<?= $image->thumb(['width' => 1200, 'autoOrient' => true])->url() ?>" rel="<?= $album->url() ?>" title="<?= $album->title() ?>">
        <img data-src="<?= $image->thumb(['width' => 250,'height' => 250, 'crop' => true, 'autoOrient' => true])->url() ?>" />
      </a>
    </li>
    <?php $i++; ?>
    <?php } ?>
  </ul>
</section>
