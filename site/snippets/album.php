<section class="<? if ($number>0) echo " old "; ?>">
	<a href="<?= $album->url() ?>" class="album-title">
		<h2>
			<?=$ album->title() ?>
		</h2>
		<?=$album->images()->count() ?> Fotos vom <?=d ate( "d.m.Y", strtotime($album->datum())) ?>
	</a>
	<ul class="album">
		<? $i=0 ;?>
		<? foreach($album->images() as $image) { ?>
		<li class="<? if ($number>0 && $i>11) {echo " more ";}?>">
			<a href="<?= $image->url() ?>" rel="<?= $album->url() ?>" title="<?= $album->title() ?>">
				<img data-src="<?= thumb($image,array('width' => 250,'height' => 250, 'crop' => true))->url() ?>" />
			</a>
		</li>
		<? $i++; ?>
		<? } ?>
	</ul>
</section>