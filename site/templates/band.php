<?php
$vars = array('og_description' => $page->shortdescription());
if ($page->hasImages()) {
  $vars['og_image'] = $page->images()->first()->thumb(['width' => 1200])->url();
}
snippet('header', $vars);
?>

<section class="container">
  <h1>
    <?=$page->title() ?>
  </h1>

  <div class="row">
    <div class="col-xs-12 visible-xs-block">
      <div class="band-stagetime <?= $page->stage() ?>">
        <span class="light">
          <?=substr($page->day(),0,2) ?>
        </span>
        <?=substr($page->time(), 0, 5) ?>
        <br />
        <span class="light band-stagetime-stage">
          <?=stagenames($page->stage()) ?> <a href="<?php echo $page->parent()->url(); ?>"><?php echo $page->parent()->title(); ?></a>
        </span>
      </div>
    </div>
    <div class="col-sm-8">
      <?php if ($page->hasImages()) {
        echo '<img class="band-photo" src="'.$page->images()->first()->thumb(['width' => 1200])->url().'" />';
      } ?>
      <?php
        if (strlen($page->description())>0) {
          echo kirbytext($page->description());
        } else if ($page->shortdescription()) {
          echo kirbytext($page->shortdescription());
        }
      ?>
    </div>
    <div class="col-sm-4">
      <div class="row">
        <div class="col-xs-12 hidden-xs">
          <div class="band-stagetime <?= $page->stage() ?>">
            <span class="light">
              <?=substr($page->day(),0,2) ?>
            </span>
            <?=substr($page->time(), 0, 5) ?>
            <br />
            <span class="light band-stagetime-stage">
              <?=stagenames($page->stage()) ?> <a href="<?php echo $page->parent()->url(); ?>"><?php echo $page->parent()->title(); ?></a>
            </span>
          </div>
        </div>
      </div>
      <div class="row band-socialmedia">
        <?php if(strlen($page->website())>0) { ?>
        <div class="col-xs-4">
          <a href="<?=$page->website() ?>" target="_blank" class="square-box">
            <div class='square-content'><div><span><i class="fa fa-globe"></i></span></div></div>
          </a>
        </div>
        <?php } ?>
        <?php if(strlen($page->facebook())>0) { ?>
        <div class="col-xs-4">
          <a href="<?=$page->facebook() ?>" target="_blank" class="square-box">
            <div class='square-content'><div><span><i class="fa fa-facebook"></i></span></div></div>
          </a>
        </div>
        <?php } ?>
        <?php if(strlen($page->youtube())>0) { ?>
        <div class="col-xs-4">
          <a href="<?=$page->youtube() ?>" target="_blank" class="square-box">
            <div class='square-content'><div><span><i class="fa fa-youtube"></i></span></div></div>
          </a>
        </div>
        <?php } ?>
        <?php if(strlen($page->soundcloud())>0) { ?>
        <div class="col-xs-4">
          <a href="<?=$page->soundcloud() ?>" target="_blank" class="square-box">
            <div class='square-content'><div><span><i class="fa fa-soundcloud"></i></span></div></div>
          </a>
        </div>
        <?php } ?>
        <?php if(strlen($page->twitter())>0) { ?>
        <div class="col-xs-4">
          <a href="<?=$page->twitter() ?>" target="_blank" class="square-box">
            <div class='square-content'><div><span><i class="fa fa-twitter"></i></span></div></div>
          </a>
        </div>
        <?php } ?>
        <?php if(strlen($page->instagram())>0) { ?>
        <div class="col-xs-4">
          <a href="<?=$page->instagram() ?>" target="_blank" class="square-box">
            <div class='square-content'><div><span><i class="fa fa-instagram"></i></span></div></div>
          </a>
        </div>
        <?php } ?>
        <?php if(strlen($page->spotify())>0) { ?>
        <div class="col-xs-4">
          <a href="<?=$page->spotify() ?>" target="_blank" class="square-box">
            <div class='square-content'><div><span><i class="fa fa-spotify"></i></span></div></div>
          </a>
        </div>
        <?php } ?>
      </div>

    </div>
  </div>
</section>

<?php snippet( 'footer') ?>
