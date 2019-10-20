panel.plugin('kulturspektakel/contactless', {
  components: {
    'k-structure-field-preview': {
      props: {
        value: String,
      },
      template: '<p class="k-structure-table-text">{{ value.map(p => p.name).join(", ") }}</p>'
    }
  }
});
