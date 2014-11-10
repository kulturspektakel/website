<section class="<?php if ($number>0) echo " old "; ?>">
	<a href="<?= $album->url() ?>" class="album-title">
		<h2>
			<?=$album->title() ?>
		</h2>
		<?=$album->images()->count() ?> Fotos vom <?=date( "d.m.Y", $album->date()) ?>
	</a>
	<ul class="album">
		<?php $i=0 ;?>
		<?php foreach($album->images() as $image) { ?>
		<li class="<?php if ($number>0 && $i>11) {echo " more ";}?>">
			<a href="<?= thumb($image,array('width' => 1200))->url() ?>" rel="<?= $album->url() ?>" title="<?= $album->title() ?>">
				<img data-src="<?= thumb($image,array('width' => 250,'height' => 250, 'crop' => true))->url() ?>" />
			</a>
		</li>
		<?php $i++; ?>
		<?php } ?>
	</ul>
</section>