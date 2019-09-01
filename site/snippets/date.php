<?php setlocale(LC_ALL, 'de_DE'); ?>
<div class="date">
  <div class="day">
    <?=$date->toDate('%d') ?>
  </div>
  <?=$date->toDate('%b') ?>
  <?=$date->toDate('%y') ?>
</div>
