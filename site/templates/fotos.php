<?php snippet('header') ?>

	<main class="content" role="main">
		<section class="container">
			<? foreach($page->children() as $album) { ?>
				<? if ($album->template()=="album") { ?>
					<?= snippet('album',array('album' => $album)) ?>
				<? } elseif ($album->template()=="video") { ?>
					<?= snippet('video',array('video' => $album)) ?>
				<? } ?>
			<? } ?>
		</section>
	</main>

<?php snippet('footer') ?>