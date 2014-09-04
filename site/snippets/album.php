<a href="<?= $album->url() ?>" class="album-title">
	<h2><?= $album->title() ?></h2>
	<?=$album->images()->count() ?> Fotos vom <?= date("d.m.Y", strtotime($album->datum())) ?>
</a>
<ul class="album">
<? foreach($album->images() as $image) { ?>
	<li><a href="<?= $image->url() ?>" rel="<?= $album->url() ?>" ><img data-src="<?= thumb($image,array('width' => 250,'height' => 250, 'crop' => true))->url() ?>" /></a></li>
<? } ?>
</ul>