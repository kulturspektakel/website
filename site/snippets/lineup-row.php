<div class="col-sm-4 day-col day-<?=$tag ?>">
  <h2>
    <?=$tag ?>
  </h2>
  <ul class="bandlist">
    <?php foreach ($bands as $band) { ?>
    <li data-stage="<?= $band->stage() ?>" class="has-content"  id="<?= $band->slug() ?>">
      <?php if($band->hasImages()): ?>
      <div class="band-image">
        <img data-src="<?= $band->images()->first()->thumb(['width' => 300])->url() ?>" />
      </div>
      <?php endif ?>
      <div class="band-info">
        <h3>
          <span class="light">
            <?=substr($band->time(), 0, 5) ?>
          </span>
          <?php
            if ($band->title() == "TBA") {
              echo '<span style="filter: blur(5px)">Is geheim</span>';
            } else {
              echo $band->title();
            }
          ?>
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
          ?>
            <ul class="band-social">
              <?php if(strlen($band->website())>0) { ?>
                <li>
                  <a href="<?=$band->website() ?>" target="_blank">
                    <i class="fa fa-globe"></i>
                  </a>
                </li>
              <?php } ?>
              <?php if(strlen($band->facebook())>0) { ?>
                <li>
                  <a href="<?=$band->facebook() ?>" target="_blank">
                    <i class="fa fa-facebook"></i>
                  </a>
                </li>
              <?php } ?>
              <?php if(strlen($band->youtube())>0) { ?>
                <li>
                  <a href="<?=$band->youtube() ?>" target="_blank">
                    <i class="fa fa-youtube"></i>
                  </a>
                </li>
              <?php } ?>
              <?php if(strlen($band->bandcamp())>0) { ?>
                <li>
                  <a href="<?=$band->bandcamp() ?>" target="_blank">
                    <i class="fa fa-bandcamp"></i>
                  </a>
                </li>
              <?php } ?>
              <?php if(strlen($band->soundcloud())>0) { ?>
                <li>
                  <a href="<?=$band->soundcloud() ?>" target="_blank">
                    <i class="fa fa-soundcloud"></i>
                  </a>
                </li>
              <?php } ?>
              <?php if(strlen($band->twitter())>0) { ?>
                <li>
                  <a href="<?=$band->twitter() ?>" target="_blank">
                    <i class="fa fa-twitter"></i>
                  </a>
                </li>
              <?php } ?>
              <?php if(strlen($band->instagram())>0) { ?>
                <li>
                  <a href="<?=$band->instagram() ?>" target="_blank">
                    <i class="fa fa-instagram"></i>
                  </a>
                </li>
              <?php } ?>
              <?php if(strlen($band->spotify())>0) { ?>
                <li>
                  <a href="<?=$band->spotify() ?>" target="_blank">
                    <i class="fa fa-spotify"></i>
                  </a>
                </li>
              <?php } ?>
            </ul>
          <?php } ?>
          <?php if (!$band->shortdescription()->empty() && !$band->description()->empty()) {?>
            <a class="more-info" href="<?= $band->url() ?>">mehr Informationen</a>
          <?php } ?>
        </div>
      </div>
      <a href="<?= $band->url() ?>" class="<?php if (strlen($band->shortdescription())==0 && !$band->hasImages()) {echo "no-content";}?>">
      </a>
    </li>
    <?php } ?>
  </ul>
</div>
