<?php
	snippet( 'header', array(
		'og_image' => thumb($page->images()->first(), array('width' => 1200, 'autoOrient' => true))->url(),
		'og_description' => excerpt($page->text(), 30, 'words').'...'
	));
?>

<section class="container news-container news-container-single" role="main">
	<div class="news">
		<hgroup>
			<?php snippet('date', array('date' => $page->date())) ?>
			<h1>
				<?php echo html($page->title()) ?>
			</h1>
		</hgroup>
		<article>
			<?php echo kirbytext($page->text()) ?>
		</article>
	</div>
</section>

<?php snippet( 'footer') ?>
