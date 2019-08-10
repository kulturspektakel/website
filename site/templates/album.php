<?php snippet('header') ?>

    <section class="container">
    	<?=snippet('album',array( 'album'=>$page)) ?>
    </section>

    <header>
      <?php
      // in this line of code, `cover` does not call the field of the same name but the `cover` method defined in the page model
      // before we use the `crop()` file method, we make sure to check if the file exists to prevent errors
      if ($cover = $page->cover()): ?>
      <figure class="album-cover">
        <?= $cover->crop(1024, 768) ?>
        <figcaption>
          <!-- The `or()` method is great to provide a fallback value if a field is empty -->
          <h1><?= $page->headline()->or($page->title()) ?></h1>
        </figcaption>
      </figure>
      <?php endif ?>
    </header>

    <div class="album-text text">
      <?= $page->description()->kt() ?>

      <?php if ($page->tags()->isNotEmpty()): ?>
      <p class="album-tags tags"><?= $page->tags() ?></p>
      <?php endif ?>
    </div>

    <ul class="album-gallery"<?= attr(['data-even' => $gallery->isEven(), 'data-count' => $gallery->count()], ' ') ?>>
      <?php foreach ($gallery as $image): ?>
      <li>
        <figure>
          <a href="<?= $image->link()->or($image->url()) ?>">
            <?= $image->crop(800, 1000) ?>
          </a>
        </figure>
      </li>
      <?php endforeach ?>
    </ul>
  </article>
</main>

<?php snippet('footer') ?>
