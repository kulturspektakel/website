<?php
if (function_exists('panel')) {
  panel()->routes(array(
    array(
      'pattern' => '(login)',
      'action'  => function() {
        $redirectURL = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . '/panel/login';
        if (isset($_GET['code'])) {
          $client_id = c::get('slack_client_id');
          $client_secret = c::get('slack_client_secret');
          $teamID = c::get('slack_team_id');
          $response = file_get_contents('https://slack.com/api/oauth.access?code='.$_GET['code'].'&client_id='.$client_id.'&client_secret='.$client_secret.'&redirect_uri='.urlencode($redirectURL));
          $response = json_decode($response, true);

          if (array_key_exists('error', $response) || empty($response['user']['email']) || $response['team']['id'] != $teamID) {
            echo $response['error'];
          } else if ($kirbyUser = site()->user($response['user']['name'])) {
            if ($kirbyUser->loginPasswordless()) {
              go('/panel');
            }
          } else {
            $kirbyUser = site()->users()->create([
              'username'  => $response['user']['name'],
              'email'     => $response['user']['email'],
              'password'  => str::random(24),
              'role'      => 'admin',
            ]);
            $kirbyUser->loginPasswordless();
            go('/panel');
          }
        } else {
          echo '<a style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%)" href="https://slack.com/oauth/authorize?scope=identity.basic,identity.email,identity.team,identity.avatar&client_id=3495902661.316840614818&redirect_uri='.$redirectURL.'"><img alt="Sign in with Slack" height="40" width="172" src="https://platform.slack-edge.com/img/sign_in_with_slack.png" srcset="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack@2x.png 2x" /></a>';
        }
      }
    )
  ));
}
?>
