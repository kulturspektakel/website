<?php

return [
  'pattern' => '/robots.txt',
  'action'  => function () {
    enforceContactlessDomain($this);
    return new Response("User-agent: *\nDisallow: /", "text/plain");
  }
];
