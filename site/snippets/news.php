<ul class="news">
	<? $i=0; ?>
	<? foreach($page->children()->flip()->limit(5) as $p): ?>
	<li class="<? if ($i==0) {echo " active ";} ?>">
		<hgroup class="a<?= $i ?>">
			<div class="date">
				<div class="day">
					<?=d ate( 'd',strtotime($p->datum())) ?>
				</div>
				<?=d ate( 'M',strtotime($p->datum())) ?>
				<?=d ate( 'y',strtotime($p->datum())) ?>
			</div>
			<h2>
				<a href="<?= $p->url() ?>">
					<?=h tml($p->title()) ?>
				</a>
			</h2>
		</hgroup>
		<article>
			<?=k irbytext($p->text()) ?>
		</article>
	</li>
	<? $i++ ?>
	<?php endforeach ?>
</ul>
<!--p class="center">
	<a href="/archiv">ältere Artikel im Archiv</a>
</p!-->
