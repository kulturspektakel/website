<?php

return [
  'pattern' => '/',
  'action'  => function () {
    enforceContactlessDomain($this);
    return new Response("<h1>kult.ca\$h</h1>");
  }
];
