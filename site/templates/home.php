<?php snippet( 'header') ?>

<section class="container news-container" role="main">
	<?php if (!$archive) { ?>
		<ul class="news">
			<?php $i=0; ?>
			<?php foreach($page->children()->sortBy('date', 'desc')->limit(5) as $p) { ?>
			<li>
				<hgroup>
					<?php snippet('date',array('date' => $p->date())) ?>
					<h2>
						<a href="<?= $p->url() ?>">
							<?=html($p->title()) ?>
						</a>
					</h2>
				</hgroup>
				<article>
					<?=kirbytext($p->text()) ?>
				</article>
			</li>
			<?php $i++ ?>
			<?php } ?>
		</ul>
		<p class="archive">
			<a href="archiv">ältere Artikel anzeigen</a>
		</p>
	<?php } else { ?>
		<ul class="news archive">
			<?php $i=0; ?>
			<?php foreach($page->children()->sortBy('date', 'desc') as $p) { ?>
			<li style="opacity: <?= 1-($i/$page->children()->count())*.7 ?>">
				<hgroup>
					<?php snippet('date',array('date' => $p->date())) ?>
					<h2>
						<a href="<?= $p->url() ?>">
							<?php echo html($p->title()); ?>
						</a>
					</h2>
				</hgroup>
			</li>
			<?php $i++ ?>
			<?php } ?>
		</ul>
	<?php } ?>
</section>

<?php //snippet('instagram') ?>

<?php //snippet('map') ?>

<?php snippet( 'footer') ?>