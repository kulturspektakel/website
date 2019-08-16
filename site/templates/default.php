<?php snippet('header') ?>

<section class="container">
	<?= $page->text()->kirbytext() ?>
</section>

<?php foreach ($page->children() as $subpage) {
  snippet('subpage', ['page' => $subpage]);
} ?>

<?php snippet('footer') ?>
