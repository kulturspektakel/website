<?php snippet( 'header') ?>

<section class="container news-container" role="main">
	<?php if (!$archive) { ?>
		<ul class="news">
			<? $i=0; ?>
			<? foreach($page->children()->sortBy('date', 'desc')->limit(5) as $p): ?>
			<li>
				<hgroup>
					<? snippet('date',array('date' => $p->date())) ?>
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
			<? $i++ ?>
			<?php endforeach ?>
		</ul>
		<p class="archive">
			<a href="archiv">ältere Artikel anzeigen</a>
		</p>
	<?php } else { ?>
		<ul class="news archive">
			<? $i=0; ?>
			<? foreach($page->children()->sortBy('date', 'desc') as $p): ?>
			<li style="opacity: <?= 1-($i/$page->children()->count())*.7 ?>">
				<hgroup>
					<? snippet('date',array('date' => $p->date())) ?>
					<h2>
						<a href="<?= $p->url() ?>">
							<?=html($p->title()) ?>
						</a>
					</h2>
				</hgroup>
			</li>
			<? $i++ ?>
			<?php endforeach ?>
		</ul>
	<?php } ?>
</section>

<?php //snippet('instagram') ?>

<?php //snippet('map') ?>

<?php snippet( 'footer') ?>