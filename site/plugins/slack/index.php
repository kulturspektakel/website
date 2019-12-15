<?php

function slackMessage($message) {
  $url = kirby()->option('slack.webhook');
  $options = [
    'http' => [
      'header'  => "Content-type: application/json\r\n",
      'method'  => 'POST',
      'content' => json_encode(['text' => $message])
    ]
  ];
  $context  = stream_context_create($options);
  $result = file_get_contents($url, false, $context);
}

Kirby::plugin('kulturspektakel/slack', [
  'routes' => [
    [
      'pattern' => 'slack-login',
      'action'  => function () {
        $url = 'https://slack.com/api/oauth.access?client_id='.kirby()->option('slack.clientId').
          '&client_secret='.kirby()->option('slack.clientSecret').
          '&redirect_uri='.kirby()->site()->url().'/slack-login'.
          '&code='.get('code');
        $r = json_decode(file_get_contents($url), true);
        $access_token = $r['access_token'];

        $url = 'https://slack.com/api/users.identity?token='.$access_token;
        $slackUser = json_decode(file_get_contents($url), true);

        kirby()->impersonate('kirby');
        $user = kirby()->users()->findByKey($slackUser['user']['email']);
        if (!$user) {
          $user = kirby()->users()->create([
            'name'  => $slackUser['user']['name'],
            'email' => $slackUser['user']['email'],
            'id' => $slackUser['user']['id'],
            'role'  => 'admin',
            'language'  => 'de',
          ]);
        }

        $user->loginPasswordless();
        return go("panel");
      }
    ],
    [
      'pattern' => 'slack-clientid',
      'action'  => function () {
        return [
          'clientId' => kirby()->option('slack.clientId')
        ];
      }
    ]
  ],
  'hooks' => [
    'page.create:after' => function ($newPage, $oldPage) {
      if ($this->user()->isKirby()) {
        return;
      }
      $message = "Neue Seite von *<@".$this->user()->id().">* angelegt: <".$newPage->url()."|".$newPage->title().">";
      try {
        slackMessage($message);
      } catch(Exception $e) {}
    },
    'page.update:after' => function ($page) {
      if ($this->user()->isKirby()) {
        return;
      }
      $message = "Seite von *<@".$this->user()->id().">* aktualisiert: <".$page->url()."|".$page->title().">";
      try {
        slackMessage($message);
      } catch(Exception $e) {}
    }
  ]
]);
?>
