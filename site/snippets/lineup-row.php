<div class="col-sm-4 day-col day-<?=$tag ?>">
  <h2>
    <?=$tag ?>
  </h2>
  <ul class="bandlist">
    <?php foreach ($bands as $band) { ?>
    <li data-stage="<?= $band->stage() ?>" class="<?php if (!$band->shortdescription()->empty() || !$band->description()->empty() || $band->hasImages()) {echo "has-content";}?>"  id="<?= $band->slug() ?>">
      <?php if($band->hasImages()): ?>
      <div class="band-image">
        <img data-src="<?= $band->images()->first()->thumb(['width' => 300])->url() ?>" />
      </div>
      <?php endif ?>
      <div class="band-info">
        <h3>
          <span class="light">
            <?=$band->time() ?>
          </span>
          <?=$band->title() ?>
        </h3>
        <div class="band-stage <?= $band->stage() ?>">
          <div class="band-stage-name" data-toggle="tooltip" data-placement="right" title="<?= stagenames($band->stage()) ?>">
            <?=$band->stage() ?>
          </div>
          <div class="band-stage-close">
            <i class="fa fa-chevron-up"></i>
          </div>
        </div>
        <div class="band-genre">
          <?=$band->genre() ?></div>
        <div class="band-description">
          <?php
          if (strlen($band->shortdescription())>0) {
            echo cleanKirbytext($band->shortdescription());
          } else {
            echo cleanKirbytext($band->description()->excerpt(300));
          } ?>
          <a class="more-info" href="<?= $band->url() ?>">mehr Informationen</a>
        </div>
      </div>
      <a href="<?= $band->url() ?>" class="<?php if (strlen($band->shortdescription())==0 && !$band->hasImages()) {echo "no-content";}?>">
      </a>
    </li>
    <?php } ?>
  </ul>
</div>
