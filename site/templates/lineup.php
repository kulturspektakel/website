<?php
  go($page->children()->filterBy('visibility','true')->sortBy('title', 'desc')->first());
?>
