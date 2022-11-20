<?php snippet('header') ?>

<section class="container">
  <?= kirbytext($page->text()) ?>
  <?php $posters = $page->competitionPosters()->yaml(); ?>
  <?php if (count($posters) > 0) { ?>
  <ul class="plakat-liste">
    <?php foreach($posters as $poster) { ?>
      <li style="background-image: url('<?=$page->image(basename($poster['image']))->thumb(['width' => 400])->url() ?>')">
        <a class="open-gallery" href="/content/<?= $poster['image']; ?>"></a>
      </li>
    <?php } ?>
  </ul>
  <hr />
  <h1>Kult-Plakat-Archiv</h1>
  <?php } ?>

  <ul class="plakat-liste">
    <?php $posters = $page->posters()->yaml(); ?>
    <?php foreach($posters as $poster) { ?>
      <li style="background-image: url('<?=strlen($poster['image']) > 0 ? $page->image(basename($poster['image']))->thumb(['width' => 400])->url(): '' ?>')">
        <?php if (strlen($poster['image'])==0) { ?><h2 class="fallback-year"><?php echo $poster['year']; ?></h2><?php } else { ?>
          <a class="open-gallery" href="/<?= $page->url().'/'.$poster['image'] ?>"></a>
        <?php } ?>
        <div class="poster" >
          <?php if (strlen($poster['designer'])==0 && strlen($poster['motiv'])==0) { ?>
            <span class="missing"><?php echo kirbytext($page->missing()) ?></span>
          <?php } else { ?>
            <h2><?php echo $poster['year']; ?></h2>
            <?php if (strlen($poster['designer'])>0) { ?><strong>Entwurf:</strong> <?php echo $poster['designer']; ?><br /><?php } ?>
            <?php if (strlen($poster['motiv'])>0) { ?><strong>Motiv:</strong> <?php echo $poster['motiv']; ?><?php } ?>
          <?php } ?>
        </div>
      </li>
    <?php } ?>
  </ul>
  <hr />

</section>

<?php snippet('footer') ?>
