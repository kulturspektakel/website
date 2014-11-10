<?php snippet( 'header') ?>

<section class="container news-container news-container-single" role="main">
	<div class="news">
		<hgroup>
			<? snippet('date', array('date' => $page->date())) ?>
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