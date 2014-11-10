<?php snippet('header') ?>

<section class="container">
	<? $i = 0;?>
	<? foreach($page->children()->sortBy('date', 'desc') as $album) { ?>
		<? if ($album->template()=="album") { ?>
			<?= snippet('album',array('album' => $album, 'number' => $i)) ?>
		<? } elseif ($album->template()=="video") { ?>
			<?= snippet('video',array('video' => $album, 'number' => $i)) ?>
		<? } ?>
		<? $i++; ?>
	<? } ?>
</section>

<?php snippet('footer') ?>