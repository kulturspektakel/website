<div class="row more-event">

  <div class="col-sm-4 col-photo <?php if ($i%2==1) {echo " col-sm-push-8 ";} ?>">
    <div class="honeycomb">
    <?php if ($p->hasImages()) echo '<img src="'.$p->images()->first()->thumb(array('width' => 800, 'height' => '800', 'crop' => true))->url().'" />'; ?>
    </div>
  </div>

  <div class="col-sm-8 col-info <?php if ($i%2==1) {echo " col-sm-pull-4 ";} ?>">
    <div class="col-info-inner">
      <h2>
        <?=$p->title() ?>
      </h2>
      <div class="date">
        <?=$p->datum() ?>
      </div>
      <div class="text">
        <?=kirbytext($p->text()) ?>
      </div>
    </div>
  </div>

</div>
