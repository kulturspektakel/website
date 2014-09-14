<?php snippet( 'header') ?>

<section class="container news-container news-container-single" role="main">
	<div class="news">
		<hgroup>
			<div class="date">
				<div class="day">
					<?=d ate( 'd',strtotime($page->datum())) ?></div>
				<?=d ate( 'M',strtotime($page->datum())) ?>
					<?=d ate( 'y',strtotime($page->datum())) ?>
			</div>
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