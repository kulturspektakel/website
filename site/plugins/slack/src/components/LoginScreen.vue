<template>
  <center>
    <a :href="url">
      <img alt="Sign in with Slack" height="40" width="172" src="https://platform.slack-edge.com/img/sign_in_with_slack.png" srcset="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack@2x.png 2x" />
    </a>
  </center>
</template>

<script>
export default {
  data() {
    return {
      url: undefined
    }
  },
  created() {
    fetch('/slack-clientid').then(res => res.json()).then(res => {
      this.url = `https://slack.com/oauth/authorize?scope=identity.basic,identity.email&client_id=${res.clientId}&redirect_uri=${location.origin}/slack-login`;
    })
  }
};

</script>
